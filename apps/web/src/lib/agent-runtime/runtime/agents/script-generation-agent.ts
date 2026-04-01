import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { SegmentScriptDraft, SegmentScriptDraftLine } from "../../context";
import { validateStructuredOutput } from "../../tools/validation-tools";
import { normalizeSegmentScriptDraft } from "../script-production/helpers/script-draft-normalizer";

export interface ScriptGenerationPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface ScriptGenerationAgentInput {
  segmentId: string;
  segmentText: string;
  prompts: ScriptGenerationPrompts;
}

export interface ScriptGenerationAgentResult {
  segmentScriptDraft: SegmentScriptDraft;
  rawResponse: string;
  provider: string;
  model: string;
}

interface ScriptGenerationAgentDeps {
  adapter: LLMAdapter;
  now?: () => Date;
}

interface ScriptGenerationErrorContext {
  rawResponse: string;
  provider: string;
  model: string;
}

interface ScriptGenerationExecutionError extends Error {
  output?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

const asOrderInSegment = (value: unknown): number | null => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
};

const parseObject = (rawText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(rawText);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonPayload = (content: string): Record<string, unknown> => {
  const direct = parseObject(content);
  if (direct) {
    return direct;
  }

  const fencedBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedBlock?.[1]) {
    const fromFence = parseObject(fencedBlock[1]);
    if (fromFence) {
      return fromFence;
    }
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const fromBraces = parseObject(content.slice(start, end + 1));
    if (fromBraces) {
      return fromBraces;
    }
  }

  throw new Error("Invalid script generation payload: expected JSON object");
};

const toDraftLine = (value: unknown): SegmentScriptDraftLine => {
  const result = validateStructuredOutput({
    value,
    requiredKeys: ["id", "sourceText", "text", "speaker", "orderInSegment"],
  });
  if (!result.valid) {
    throw new Error(
      `Invalid script line: missing keys ${result.missingKeys.join(", ")}`
    );
  }

  if (!isRecord(value)) {
    throw new Error("Invalid script line: line must be an object");
  }

  const id = asText(value.id);
  const sourceText = asText(value.sourceText);
  const text = asText(value.text);
  const speaker = asText(value.speaker) ?? "未知";
  const orderInSegment = asOrderInSegment(value.orderInSegment);

  if (!id || !sourceText || !text || orderInSegment === null) {
    throw new Error("Invalid script line: required fields are empty or invalid");
  }

  return {
    id,
    sourceText,
    text,
    speaker,
    orderInSegment,
  };
};

const assertContiguousOrderInSegment = (lines: SegmentScriptDraftLine[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.orderInSegment !== index) {
      throw new Error(
        "Invalid script line: orderInSegment must start at 0 and increment by 1"
      );
    }
  }
};

const toSegmentScriptDraft = (params: {
  content: string;
  segmentId: string;
  segmentText: string;
  now: () => Date;
}): SegmentScriptDraft => {
  const payload = extractJsonPayload(params.content);
  const topLevel = validateStructuredOutput({
    value: payload,
    requiredKeys: ["lines"],
  });
  if (!topLevel.valid) {
    throw new Error("Invalid script generation payload: lines is required");
  }

  if (!Array.isArray(payload.lines)) {
    throw new Error("Invalid script generation payload: lines must be an array");
  }
  if (payload.lines.length === 0) {
    throw new Error(
      "Invalid script generation payload: lines must not be empty"
    );
  }

  const normalizedDraft = normalizeSegmentScriptDraft({
    segmentText: params.segmentText,
    draft: {
      segmentId: params.segmentId,
      lines: payload.lines.map((line) => toDraftLine(line)),
      createdAt: params.now().toISOString(),
    },
  });
  const lines = normalizedDraft.lines;
  assertContiguousOrderInSegment(lines);

  return normalizedDraft;
};

const renderUserPrompt = (
  template: string,
  params: { segmentText: string }
) => template.split("{{segment_text}}").join(params.segmentText);

const asErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "segment_scripting_parse_failed";
};

const toScriptGenerationError = (params: {
  error: unknown;
  context: ScriptGenerationErrorContext;
}): ScriptGenerationExecutionError => {
  const wrapped = new Error(asErrorMessage(params.error)) as ScriptGenerationExecutionError;
  wrapped.output = {
    failedArtifact: {
      kind: "segment-scripting-failure",
      rawResponse: params.context.rawResponse,
      provider: params.context.provider,
      model: params.context.model,
      message: wrapped.message,
    },
  };

  return wrapped;
};

export const createScriptGenerationAgent = (deps: ScriptGenerationAgentDeps) => ({
  async execute(
    input: ScriptGenerationAgentInput
  ): Promise<ScriptGenerationAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt: renderUserPrompt(input.prompts.userPrompt, {
        segmentText: input.segmentText,
      }),
      metadata: {
        source: "agent_runtime.segment_scripting",
        stageId: "segment_scripting",
      },
    });

    const now = deps.now ?? (() => new Date());

    try {
      const segmentScriptDraft = toSegmentScriptDraft({
        content: response.content,
        segmentId: input.segmentId,
        segmentText: input.segmentText,
        now,
      });

      return {
        segmentScriptDraft: {
          ...segmentScriptDraft,
          rawResponse: response.content,
          provider: response.provider,
          model: response.model,
        },
        rawResponse: response.content,
        provider: response.provider,
        model: response.model,
      };
    } catch (error) {
      throw toScriptGenerationError({
        error,
        context: {
          rawResponse: response.content,
          provider: response.provider,
          model: response.model,
        },
      });
    }
  },
});
