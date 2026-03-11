import { getScriptValidationSubtypeLabel } from "@/lib/script-validation-review";

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
  hasDetails: boolean;
}

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

  return {
    subtypeLabel: getScriptValidationSubtypeLabel(issueSubtype),
    summary,
    stage,
    errorCode,
    coverageLabel,
    issueCodes,
    issueMessages,
    issuePreviews,
    segmentPreview,
    hasDetails:
      Boolean(summary) ||
      Boolean(stage) ||
      Boolean(errorCode) ||
      Boolean(coverageLabel) ||
      issueCodes.length > 0 ||
      issuePreviews.length > 0 ||
      Boolean(segmentPreview),
  };
};
