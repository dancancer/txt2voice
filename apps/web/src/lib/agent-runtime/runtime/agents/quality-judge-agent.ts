import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { QualityVerdict, SegmentScriptDraft, ValidationReport } from "../../context";
import { validateStructuredOutput } from "../../tools/validation-tools";

export interface QualityJudgePrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface QualitySignals {
  forceManualReview?: boolean;
  upstreamWarnings?: string[];
}

export interface QualityJudgeAgentInput {
  segmentId: string;
  segmentScriptDraft: SegmentScriptDraft;
  validationReport: ValidationReport;
  qualitySignals?: QualitySignals;
  failedArtifact?: unknown;
  prompts: QualityJudgePrompts;
}

export interface QualityJudgeAgentResult {
  verdict: QualityVerdict;
  confidence: number;
  summary: string;
  rawResponse: string;
  provider: string;
  model: string;
}

interface QualityJudgeAgentDeps {
  adapter: LLMAdapter;
}

const AUTO_PASS_SCORE_THRESHOLD = 0.8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

const asScore = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || value > 1) {
    return null;
  }
  return Number(value.toFixed(4));
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
    const parsed = parseObject(fencedBlock[1]);
    if (parsed) {
      return parsed;
    }
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = parseObject(content.slice(start, end + 1));
    if (parsed) {
      return parsed;
    }
  }

  throw new Error("Invalid quality verdict payload: expected JSON object");
};

const asReasonList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const toQualityJudgeResult = (params: {
  segmentId: string;
  content: string;
  provider: string;
  model: string;
}): QualityJudgeAgentResult => {
  const payload = extractJsonPayload(params.content);
  const topLevel = validateStructuredOutput({
    value: payload,
    requiredKeys: ["score", "confidence", "reasons"],
  });
  if (!topLevel.valid) {
    throw new Error(
      `Invalid quality verdict payload: missing keys ${topLevel.missingKeys.join(", ")}`
    );
  }

  const score = asScore(payload.score);
  const confidence = asScore(payload.confidence);
  const reasons = asReasonList(payload.reasons);
  const summary = asText(payload.summary) ?? "quality_assessment_generated";

  if (score === null) {
    throw new Error("Invalid quality verdict payload: score must be in [0, 1]");
  }
  if (confidence === null) {
    throw new Error("Invalid quality verdict payload: confidence must be in [0, 1]");
  }
  if (reasons.length === 0) {
    throw new Error("Invalid quality verdict payload: reasons must not be empty");
  }

  return {
    verdict: {
      segmentId: params.segmentId,
      verdict: score >= AUTO_PASS_SCORE_THRESHOLD ? "pass" : "fail",
      score,
      reasons,
    },
    confidence,
    summary,
    rawResponse: params.content,
    provider: params.provider,
    model: params.model,
  };
};

const stringifyJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify(String(value));
  }
};

const renderUserPrompt = (
  template: string,
  params: {
    segmentScriptDraft: SegmentScriptDraft;
    validationReport: ValidationReport;
    qualitySignals?: QualitySignals;
    failedArtifact?: unknown;
  }
) =>
  template
    .split("{{segment_script_draft_json}}")
    .join(stringifyJson(params.segmentScriptDraft))
    .split("{{validation_report_json}}")
    .join(stringifyJson(params.validationReport))
    .split("{{quality_signals_json}}")
    .join(stringifyJson(params.qualitySignals ?? {}))
    .split("{{failed_artifact_json}}")
    .join(stringifyJson(params.failedArtifact ?? null));

export const createQualityJudgeAgent = (deps: QualityJudgeAgentDeps) => ({
  async execute(input: QualityJudgeAgentInput): Promise<QualityJudgeAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt: renderUserPrompt(input.prompts.userPrompt, {
        segmentScriptDraft: input.segmentScriptDraft,
        validationReport: input.validationReport,
        qualitySignals: input.qualitySignals,
        failedArtifact: input.failedArtifact,
      }),
      metadata: {
        source: "agent_runtime.quality_judgement",
        stageId: "quality_judgement",
      },
    });

    return toQualityJudgeResult({
      segmentId: input.segmentId,
      content: response.content,
      provider: response.provider,
      model: response.model,
    });
  },
});
