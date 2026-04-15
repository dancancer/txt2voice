import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  RepairDecision,
  SegmentScriptDraft,
  SegmentScriptDraftLine,
} from "../../context";
import { validateStructuredOutput } from "../../tools/validation-tools";
import { renderPromptTemplate } from "../prompt-template";

export interface RepairAgentPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface RepairAgentInput {
  segmentId: string;
  segmentText: string;
  failedArtifact: unknown;
  failureKind?: "format_repair" | "semantic_retry";
  modelPolicy: string;
  prompts: RepairAgentPrompts;
  renderedUserPrompt?: string;
}

export interface RepairAgentResult {
  decision: RepairDecision;
  repairedDraft?: SegmentScriptDraft;
  rawResponse?: string;
  provider?: string;
  model?: string;
}

interface RepairAgentDeps {
  adapter: LLMAdapter;
  now?: () => Date;
}

interface RepairErrorContext {
  rawResponse: string;
  provider: string;
  model: string;
}

interface RepairExecutionError extends Error {
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

  throw new Error("Invalid repair payload: expected JSON object");
};

const toDraftLine = (value: unknown): SegmentScriptDraftLine => {
  const result = validateStructuredOutput({
    value,
    requiredKeys: ["id", "sourceText", "text", "speaker", "orderInSegment"],
  });
  if (!result.valid) {
    throw new Error(
      `Invalid repair payload line: missing keys ${result.missingKeys.join(", ")}`
    );
  }

  if (!isRecord(value)) {
    throw new Error("Invalid repair payload line: line must be an object");
  }

  const id = asText(value.id);
  const sourceText = asText(value.sourceText);
  const text = asText(value.text);
  const speaker = asText(value.speaker);
  const orderInSegment = asOrderInSegment(value.orderInSegment);

  if (!id || !sourceText || !text || !speaker || orderInSegment === null) {
    throw new Error("Invalid repair payload line: required fields are invalid");
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
        "Invalid repair payload line: orderInSegment must start at 0 and increment by 1"
      );
    }
  }
};

const toSegmentScriptDraft = (params: {
  content: string;
  segmentId: string;
  now: () => Date;
}): SegmentScriptDraft => {
  const payload = extractJsonPayload(params.content);
  const topLevel = validateStructuredOutput({
    value: payload,
    requiredKeys: ["lines"],
  });
  if (!topLevel.valid) {
    throw new Error("Invalid repair payload: lines is required");
  }

  if (!Array.isArray(payload.lines)) {
    throw new Error("Invalid repair payload: lines must be an array");
  }
  if (payload.lines.length === 0) {
    throw new Error("Invalid repair payload: lines must not be empty");
  }

  const lines = payload.lines.map((line) => toDraftLine(line));
  assertContiguousOrderInSegment(lines);

  return {
    segmentId: params.segmentId,
    lines,
    createdAt: params.now().toISOString(),
  };
};

const stringifyArtifact = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const renderRepairUserPrompt = (
  template: string,
  params: {
    segmentText: string;
    failedArtifact: unknown;
    characterMemorySummary?: string;
    characterResolutionHints?: string;
  }
) =>
  renderRepairUserPromptFromVariables(template, {
    segment_text: params.segmentText,
    failed_artifact_json: stringifyArtifact(params.failedArtifact),
    character_memory_summary: params.characterMemorySummary || "",
    character_resolution_hints: params.characterResolutionHints || "",
  });

export const renderRepairUserPromptFromVariables = (
  template: string,
  variables: {
    segment_text: string;
    failed_artifact_json: string;
    character_memory_summary?: string;
    character_resolution_hints?: string;
  }
) =>
  renderPromptTemplate(template, {
    segment_text: variables.segment_text,
    failed_artifact_json: variables.failed_artifact_json,
    character_memory_summary: variables.character_memory_summary || "",
    character_resolution_hints: variables.character_resolution_hints || "",
  });

const asErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "segment_repair_parse_failed";
};

const tryExtractStructuredResult = (
  rawResponse: string
): Record<string, unknown> | null => {
  try {
    return extractJsonPayload(rawResponse);
  } catch {
    return null;
  }
};

const toRepairExecutionError = (params: {
  error: unknown;
  context: RepairErrorContext;
}): RepairExecutionError => {
  const wrapped = new Error(asErrorMessage(params.error)) as RepairExecutionError;
  wrapped.output = {
    failedArtifact: {
      kind: "segment-repair-failure",
      rawResponse: params.context.rawResponse,
      structuredResult: tryExtractStructuredResult(params.context.rawResponse),
      provider: params.context.provider,
      model: params.context.model,
      message: wrapped.message,
    },
  };

  return wrapped;
};

export const createRepairAgent = (deps: RepairAgentDeps) => ({
  async execute(input: RepairAgentInput): Promise<RepairAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt:
        input.renderedUserPrompt ??
        renderRepairUserPrompt(input.prompts.userPrompt, {
          segmentText: input.segmentText,
          failedArtifact: input.failedArtifact,
        }),
      modelPolicy: input.modelPolicy,
      metadata: {
        source: "agent_runtime.segment_repair",
        stageId: "segment_repair",
        segmentId: input.segmentId,
        failureCategory: input.failureKind ?? "format_repair",
      },
    });
    const now = deps.now ?? (() => new Date());

    try {
      const repairedDraft = toSegmentScriptDraft({
        content: response.content,
        segmentId: input.segmentId,
        now,
      });

      return {
        decision: {
          segmentId: input.segmentId,
          action: "retry",
          reason: input.failureKind ?? "format_repair",
          retryable: true,
        },
        repairedDraft: {
          ...repairedDraft,
          rawResponse: response.content,
          provider: response.provider,
          model: response.model,
        },
        rawResponse: response.content,
        provider: response.provider,
        model: response.model,
      };
    } catch (error) {
      throw toRepairExecutionError({
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
