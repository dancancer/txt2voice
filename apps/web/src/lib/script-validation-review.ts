export const SCRIPT_VALIDATION_ISSUE_TYPE = "SCRIPT_VALIDATION";

export type ScriptValidationSubtype =
  | "COVERAGE"
  | "DIALOGUE_NARRATION_CONFLICT"
  | "BOUNDARY_DRIFT"
  | "ORDER_OR_DUPLICATION"
  | "SOURCE_TRACE_MISSING"
  | "EMPTY_EXTRACTION"
  | "DIALOGUE_TOO_LONG"
  | "LLM_PARSE_FAILURE"
  | "OTHER";

export const SCRIPT_VALIDATION_SUBTYPE_OPTIONS: Array<{
  value: ScriptValidationSubtype;
  label: string;
}> = [
  { value: "COVERAGE", label: "覆盖率不足" },
  { value: "DIALOGUE_NARRATION_CONFLICT", label: "对白/旁白冲突" },
  { value: "BOUNDARY_DRIFT", label: "改写/边界漂移" },
  { value: "ORDER_OR_DUPLICATION", label: "顺序/重复抽取" },
  { value: "SOURCE_TRACE_MISSING", label: "缺少原文切片" },
  { value: "EMPTY_EXTRACTION", label: "空台本输出" },
  { value: "DIALOGUE_TOO_LONG", label: "台词过长" },
  { value: "LLM_PARSE_FAILURE", label: "LLM 解析失败" },
  { value: "OTHER", label: "其他脚本问题" },
];

const SCRIPT_VALIDATION_SUBTYPE_LABELS = new Map(
  SCRIPT_VALIDATION_SUBTYPE_OPTIONS.map((item) => [item.value, item.label])
);

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
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
};

const normalizeSubtype = (value: string): ScriptValidationSubtype | null => {
  const normalized = value.trim().toUpperCase();
  if (SCRIPT_VALIDATION_SUBTYPE_LABELS.has(normalized as ScriptValidationSubtype)) {
    return normalized as ScriptValidationSubtype;
  }
  return null;
};

export const resolveScriptValidationSubtype = (
  issueDetail: unknown
): ScriptValidationSubtype => {
  const record = asRecord(issueDetail);
  const explicitSubtype = normalizeSubtype(asString(record?.scriptSubtype));
  if (explicitSubtype) {
    return explicitSubtype;
  }

  const errorCode = asString(record?.errorCode).toUpperCase();
  if (errorCode === "DIALOGUE_TOO_LONG") {
    return "DIALOGUE_TOO_LONG";
  }
  if (errorCode === "LLM_JSON_PARSE_FAILED") {
    return "LLM_PARSE_FAILURE";
  }

  const issueCodes = asStringArray(record?.issueCodes).map((code) => code.toUpperCase());

  if (issueCodes.includes("MISSING_SOURCE_TEXT")) {
    return "SOURCE_TRACE_MISSING";
  }
  if (issueCodes.includes("QUOTED_NARRATION")) {
    return "DIALOGUE_NARRATION_CONFLICT";
  }
  if (issueCodes.includes("TEXT_SOURCE_MISMATCH")) {
    return "BOUNDARY_DRIFT";
  }
  if (issueCodes.includes("SOURCE_NOT_FOUND")) {
    return "ORDER_OR_DUPLICATION";
  }
  if (issueCodes.includes("LOW_COVERAGE") || issueCodes.includes("NON_WHITESPACE_GAP")) {
    return "COVERAGE";
  }
  if (issueCodes.includes("EMPTY_DIALOGUES") || issueCodes.includes("EMPTY_TEXT")) {
    return "EMPTY_EXTRACTION";
  }

  return "OTHER";
};

export const getScriptValidationSubtypeLabel = (value: string | null | undefined): string => {
  const subtype = normalizeSubtype(value || "") || "OTHER";
  return SCRIPT_VALIDATION_SUBTYPE_LABELS.get(subtype) || "其他脚本问题";
};
