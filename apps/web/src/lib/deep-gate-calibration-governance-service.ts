// 一旦我被更新，请更新我的开头注释
// input: 阈值治理请求参数/服务导入
// output: payload 解析与服务入口导出
// pos: 阈值治理聚合入口
import { ValidationError } from "@/lib/error-handler";
import { DEFAULT_DEEP_GATE_TEMPLATE } from "@/lib/quality-gate/types";
import {
  asBoolean,
  asInteger,
  asNumber,
  asRecord,
  asString,
  clampScore,
  normalizeTemplate,
  parseVerdict,
} from "@/lib/deep-gate-calibration-governance/parsers";
import {
  CalibrationSample,
  DEFAULT_SAMPLE_LIMIT,
  EvaluateDeepGateCalibrationPayload,
  MAX_CHANGE_NOTE_LENGTH,
  MAX_OPERATOR_LENGTH,
  MAX_SAMPLE_LIMIT,
  MIN_SAMPLE_LIMIT,
  PublishDeepGateCalibrationPayload,
  RollbackDeepGateCalibrationPayload,
  SUPPORTED_VERDICTS,
} from "@/lib/deep-gate-calibration-governance/types";

export {
  evaluateDeepGateCalibrationForBook,
  publishDeepGateCalibrationForBook,
  rollbackDeepGateCalibrationForBook,
} from "@/lib/deep-gate-calibration-governance/service";

export type {
  EvaluateDeepGateCalibrationPayload,
  PublishDeepGateCalibrationPayload,
  RollbackDeepGateCalibrationPayload,
} from "@/lib/deep-gate-calibration-governance/types";

const normalizeOperator = ({
  value,
  path,
  required,
}: {
  value: unknown;
  path: string;
  required?: boolean;
}): string | null => {
  const operator = asString(value);
  if (!operator) {
    if (required) {
      throw new ValidationError(`${path} 不能为空`);
    }
    return null;
  }
  if (operator.length > MAX_OPERATOR_LENGTH) {
    throw new ValidationError(`${path} 不能超过 ${MAX_OPERATOR_LENGTH} 字符`);
  }
  return operator;
};

const normalizeChangeNote = (value: unknown): string | null => {
  const note = asString(value);
  if (!note) {
    return null;
  }
  if (note.length > MAX_CHANGE_NOTE_LENGTH) {
    throw new ValidationError(`changeNote 不能超过 ${MAX_CHANGE_NOTE_LENGTH} 字符`);
  }
  return note;
};

const normalizeSample = (value: unknown, index: number): CalibrationSample => {
  const record = asRecord(value);
  if (!record) {
    throw new ValidationError(`samples[${index}] 必须是对象`);
  }

  const q4Score = asNumber(record.q4Score);
  if (q4Score === undefined) {
    throw new ValidationError(`samples[${index}].q4Score 必须是数字`);
  }

  const q5Score = asNumber(record.q5Score);
  if (q5Score === undefined) {
    throw new ValidationError(`samples[${index}].q5Score 必须是数字`);
  }

  const expectedVerdict = parseVerdict(record.expectedVerdict);
  if (!expectedVerdict) {
    throw new ValidationError(
      `samples[${index}].expectedVerdict 仅支持 ${SUPPORTED_VERDICTS.join("/")}`
    );
  }

  return {
    q4Score: clampScore(q4Score),
    q5Score: clampScore(q5Score),
    expectedVerdict,
    issueType: (asString(record.issueType) || "UNKNOWN").toUpperCase(),
    source: (asString(record.source) || "unknown").toLowerCase(),
    fallbackUsed: asBoolean(record.fallbackUsed) || false,
  };
};

const normalizeSamples = (value: unknown): CalibrationSample[] | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new ValidationError("samples 必须是数组");
  }
  return value.map((sample, index) => normalizeSample(sample, index));
};

export const parseEvaluateDeepGateCalibrationPayload = (
  body: unknown
): EvaluateDeepGateCalibrationPayload => {
  const payload = asRecord(body) || {};
  const sampleLimit = asInteger(payload.sampleLimit) || DEFAULT_SAMPLE_LIMIT;
  if (sampleLimit < MIN_SAMPLE_LIMIT || sampleLimit > MAX_SAMPLE_LIMIT) {
    throw new ValidationError(
      `sampleLimit 必须在 ${MIN_SAMPLE_LIMIT}-${MAX_SAMPLE_LIMIT} 之间`
    );
  }
  const sampleSetId = asString(payload.sampleSetId) || null;
  const samples = normalizeSamples(payload.samples);
  if (sampleSetId && samples) {
    throw new ValidationError("sampleSetId 与 samples 不能同时传入");
  }

  return {
    sampleLimit,
    samples,
    sampleSetId,
    baselineTemplate: payload.baselineTemplate
      ? normalizeTemplate(payload.baselineTemplate, DEFAULT_DEEP_GATE_TEMPLATE)
      : null,
    candidateTemplate: payload.candidateTemplate
      ? normalizeTemplate(payload.candidateTemplate, DEFAULT_DEEP_GATE_TEMPLATE)
      : null,
    createReplayTask: asBoolean(payload.createReplayTask) ?? true,
    replayDryRun: asBoolean(payload.replayDryRun) ?? true,
    createdBy: normalizeOperator({
      value: payload.createdBy || payload.operator,
      path: "createdBy",
    }),
    reviewedBy: normalizeOperator({
      value: payload.reviewedBy || payload.reviewer,
      path: "reviewedBy",
    }),
    changeNote: normalizeChangeNote(payload.changeNote || payload.note),
  };
};

export const parsePublishDeepGateCalibrationPayload = (
  body: unknown
): PublishDeepGateCalibrationPayload => {
  const payload = asRecord(body) || {};
  const reportId = asString(payload.reportId);
  if (!reportId) {
    throw new ValidationError("reportId 不能为空");
  }

  const expectedVersion = asInteger(payload.expectedVersion);
  if (expectedVersion !== undefined && expectedVersion < 0) {
    throw new ValidationError("expectedVersion 必须是 >= 0 的整数");
  }

  return {
    reportId,
    publishedBy: normalizeOperator({
      value: payload.publishedBy || payload.operator,
      path: "publishedBy",
    }),
    reviewedBy: normalizeOperator({
      value: payload.reviewedBy || payload.reviewer,
      path: "reviewedBy",
      required: true,
    }),
    changeNote: normalizeChangeNote(payload.changeNote || payload.note),
    expectedVersion: expectedVersion ?? null,
  };
};

export const parseRollbackDeepGateCalibrationPayload = (
  body: unknown
): RollbackDeepGateCalibrationPayload => {
  const payload = asRecord(body) || {};
  const targetVersion = asInteger(payload.targetVersion);
  if (!targetVersion || targetVersion < 1) {
    throw new ValidationError("targetVersion 必须是 >= 1 的整数");
  }

  const expectedVersion = asInteger(payload.expectedVersion);
  if (expectedVersion !== undefined && expectedVersion < 0) {
    throw new ValidationError("expectedVersion 必须是 >= 0 的整数");
  }

  return {
    targetVersion,
    rolledBackBy: normalizeOperator({
      value: payload.rolledBackBy || payload.operator,
      path: "rolledBackBy",
    }),
    reviewedBy: normalizeOperator({
      value: payload.reviewedBy || payload.reviewer,
      path: "reviewedBy",
      required: true,
    }),
    changeNote: normalizeChangeNote(payload.changeNote || payload.note),
    expectedVersion: expectedVersion ?? null,
  };
};
