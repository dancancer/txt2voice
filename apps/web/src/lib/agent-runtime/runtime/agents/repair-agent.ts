import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  RepairDecision,
  SegmentScriptDraft,
  SegmentScriptDraftLine,
} from "../../context";
import { validateStructuredOutput } from "../../tools/validation-tools";

export interface RepairAgentPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface RepairAgentInput {
  segmentId: string;
  segmentText: string;
  failedArtifact: unknown;
  prompts: RepairAgentPrompts;
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

const renderUserPrompt = (
  template: string,
  params: {
    segmentText: string;
    failedArtifact: unknown;
  }
) =>
  template
    .split("{{segment_text}}")
    .join(params.segmentText)
    .split("{{failed_artifact_json}}")
    .join(stringifyArtifact(params.failedArtifact));

export const createRepairAgent = (deps: RepairAgentDeps) => ({
  async execute(input: RepairAgentInput): Promise<RepairAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt: renderUserPrompt(input.prompts.userPrompt, {
        segmentText: input.segmentText,
        failedArtifact: input.failedArtifact,
      }),
      metadata: {
        source: "agent_runtime.segment_repair",
        stageId: "segment_repair",
        failureCategory: "format_repair",
      },
    });
    const now = deps.now ?? (() => new Date());
    const repairedDraft = toSegmentScriptDraft({
      content: response.content,
      segmentId: input.segmentId,
      now,
    });

    return {
      decision: {
        segmentId: input.segmentId,
        action: "retry",
        reason: "format_repair",
        retryable: true,
      },
      repairedDraft,
      rawResponse: response.content,
      provider: response.provider,
      model: response.model,
    };
  },
});
