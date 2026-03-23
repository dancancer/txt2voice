import {
  getScriptValidationSubtypeLabel,
  resolveScriptValidationSubtype,
  type ScriptValidationSubtype,
} from "@/lib/script-validation-review";

export type ScriptValidationRecommendedAction =
  | "approve"
  | "reject"
  | "regenerate";

export const SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS: Array<{
  value: ScriptValidationRecommendedAction;
  label: string;
}> = [
  { value: "regenerate", label: "重生" },
  { value: "approve", label: "通过" },
  { value: "reject", label: "驳回" },
];

export interface ScriptValidationDetailView {
  subtypeLabel: string;
  summary: string;
  stage: string;
  errorCode: string;
  coverageLabel: string | null;
  issueCodes: string[];
  issueMessages: string[];
  issuePreviews: string[];
  segmentPreview: string;
  segmentContent: string;
  rawResponse: string;
  structuredResult: Record<string, unknown> | null;
  actionHints: string[];
  recommendedAction: ScriptValidationRecommendedAction | null;
  recommendedActionLabel: string;
  hasDetails: boolean;
}

const SCRIPT_VALIDATION_GUIDANCE: Partial<
  Record<
    ScriptValidationSubtype,
    {
      actionHints: string[];
      recommendedAction: ScriptValidationRecommendedAction | null;
    }
  >
> = {
  COVERAGE: {
    actionHints: [
      "优先重生台本，确认这一段是否需要更小粒度切段。",
      "若连续失败，回看完整问题列表与原文预览，确认是否存在稳定漏句。",
    ],
    recommendedAction: "regenerate",
  },
  EMPTY_EXTRACTION: {
    actionHints: [
      "优先重生台本，确认这一段是否需要更小粒度切段。",
      "若连续失败，回看完整问题列表与原文预览，确认是否存在稳定漏句。",
    ],
    recommendedAction: "regenerate",
  },
  SOURCE_TRACE_MISSING: {
    actionHints: [
      "优先重生台本，检查每句是否都返回了 sourceText 原文切片。",
      "若仍失败，回查 prompt 与模型输出，确认没有把原文改写成摘要。",
    ],
    recommendedAction: "regenerate",
  },
  DIALOGUE_NARRATION_CONFLICT: {
    actionHints: [
      "先核对白/旁白边界，再决定是否直接重生台本。",
      "若问题集中在引号句，重点检查归属语、对白正文与旁白是否被混抽。",
    ],
    recommendedAction: "regenerate",
  },
  BOUNDARY_DRIFT: {
    actionHints: [
      "先核对白/旁白边界，再决定是否直接重生台本。",
      "若问题集中在引号句，重点检查归属语、对白正文与旁白是否被混抽。",
    ],
    recommendedAction: "regenerate",
  },
  ORDER_OR_DUPLICATION: {
    actionHints: [
      "优先重生台本，重点检查是否存在重复抽取或顺序漂移。",
      "若重复出现同类问题，回看 issue previews，确认是否需要更小粒度切段。",
    ],
    recommendedAction: "regenerate",
  },
  DIALOGUE_TOO_LONG: {
    actionHints: [
      "优先重生台本，确认该段是否需要进一步拆分后再生成。",
      "若仍超长，回看分段策略，避免整段对白被压成单句。",
    ],
    recommendedAction: "regenerate",
  },
  LLM_PARSE_FAILURE: {
    actionHints: [
      "优先重生台本，观察是否只是一次性 LLM 解析抖动。",
      "若重复失败，检查模型响应截断与 JSON 修复链路。",
    ],
    recommendedAction: "regenerate",
  },
  OTHER: {
    actionHints: ["先查看完整问题列表与原文预览，再决定通过或重生。"],
    recommendedAction: null,
  },
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
};

const asCoverageLabel = (value: unknown): string | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return `${(value * 100).toFixed(1)}%`;
};

const normalizeSummary = (value: string): string => {
  return value.replace(/^段落台本校验失败[:：]?\s*/, "").trim();
};

export const getScriptValidationRecommendedActionLabel = (
  action: ScriptValidationRecommendedAction | null
): string => {
  if (action === "approve") {
    return "通过";
  }
  if (action === "reject") {
    return "驳回";
  }
  if (action === "regenerate") {
    return "重生";
  }
  return "";
};

export const listScriptValidationSubtypesByRecommendedAction = (
  action: ScriptValidationRecommendedAction
): ScriptValidationSubtype[] => {
  return (
    Object.entries(SCRIPT_VALIDATION_GUIDANCE)
      .filter(([, config]) => config?.recommendedAction === action)
      .map(([subtype]) => subtype as ScriptValidationSubtype)
  );
};

export const buildScriptValidationDetailView = (params: {
  issueSubtype: string | null;
  issueDetail: unknown;
}): ScriptValidationDetailView => {
  const { issueSubtype, issueDetail } = params;
  const detail = asRecord(issueDetail);
  const issueMessages = asStringArray(detail?.issueMessages);
  const issuePreviews = asStringArray(detail?.issuePreviews);
  const issueCodes = asStringArray(detail?.issueCodes);
  const fallbackMessage = normalizeSummary(asString(detail?.message));
  const summary = issueMessages[0] || fallbackMessage;
  const stage = asString(detail?.stage);
  const errorCode = asString(detail?.errorCode);
  const coverageLabel = asCoverageLabel(detail?.coverageRatio);
  const segmentPreview = asString(detail?.segmentPreview);
  const segmentContent = asString(detail?.segmentContent);
  const rawResponse = asString(detail?.rawResponse);
  const structuredResult =
    detail?.structuredResult &&
    typeof detail.structuredResult === "object" &&
    !Array.isArray(detail.structuredResult)
      ? (detail.structuredResult as Record<string, unknown>)
      : null;
  const subtype = resolveScriptValidationSubtype({
    ...(detail ?? {}),
    scriptSubtype: issueSubtype || asString(detail?.scriptSubtype),
  });
  const guidance = SCRIPT_VALIDATION_GUIDANCE[subtype] || SCRIPT_VALIDATION_GUIDANCE.OTHER;
  const actionHints = guidance?.actionHints || [];
  const recommendedAction = guidance?.recommendedAction || null;

  return {
    subtypeLabel: getScriptValidationSubtypeLabel(subtype),
    summary,
    stage,
    errorCode,
    coverageLabel,
    issueCodes,
    issueMessages,
    issuePreviews,
    segmentPreview,
    segmentContent,
    rawResponse,
    structuredResult,
    actionHints,
    recommendedAction,
    recommendedActionLabel: getScriptValidationRecommendedActionLabel(
      recommendedAction
    ),
    hasDetails:
      Boolean(summary) ||
      Boolean(stage) ||
      Boolean(errorCode) ||
      Boolean(coverageLabel) ||
      issueCodes.length > 0 ||
      issuePreviews.length > 0 ||
      Boolean(segmentPreview) ||
      Boolean(segmentContent) ||
      Boolean(rawResponse) ||
      Boolean(structuredResult),
  };
};
