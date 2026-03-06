// 一旦我被更新，请更新我的开头注释
// input: 请求体/metadata 原始对象
// output: 规范化 payload、模板和治理状态
// pos: 阈值治理解析与状态模块
import { Prisma } from "@/lib/prisma";
import {
  DEFAULT_DEEP_GATE_TEMPLATE,
  DeepGateThresholdTemplate,
  QualityGateVerdict,
} from "@/lib/quality-gate/types";
import {
  CalibrationSampleWithReference,
  DeepGateCalibrationReportRecord,
  DeepGateCalibrationSampleSetRecord,
  DeepGateThresholdGovernanceState,
  DeepGateThresholdReleaseRecord,
  EvaluationComparison,
  EvaluationSummary,
  SUPPORTED_VERDICTS,
} from "@/lib/deep-gate-calibration-governance/types";

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? value : null;
};

export const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

export const asInteger = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

export const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

export const roundRate = (value: number): number => {
  return Number(value.toFixed(4));
};

export const parseVerdict = (value: unknown): QualityGateVerdict | null => {
  const raw = asString(value)?.toLowerCase();
  if (!raw) {
    return null;
  }
  return SUPPORTED_VERDICTS.find((verdict) => verdict === raw) || null;
};

export const normalizeTemplate = (
  value: unknown,
  fallback: DeepGateThresholdTemplate
): DeepGateThresholdTemplate => {
  const record = asRecord(value);
  if (!record) {
    return fallback;
  }

  const candidate: DeepGateThresholdTemplate = {
    ...fallback,
  };

  const q4PassScore = asNumber(record.q4PassScore);
  const q4ManualReviewScore = asNumber(record.q4ManualReviewScore);
  const q5PassScore = asNumber(record.q5PassScore);
  const q5ManualReviewScore = asNumber(record.q5ManualReviewScore);
  const chapterPassScore = asNumber(record.chapterPassScore);
  const chapterRepairScore = asNumber(record.chapterRepairScore);
  const hardFailScore = asNumber(record.hardFailScore);
  const falsePositiveDelta = asNumber(record.falsePositiveDelta);

  if (q4PassScore !== undefined) {
    candidate.q4PassScore = clampScore(q4PassScore);
  }
  if (q4ManualReviewScore !== undefined) {
    candidate.q4ManualReviewScore = clampScore(q4ManualReviewScore);
  }
  if (q5PassScore !== undefined) {
    candidate.q5PassScore = clampScore(q5PassScore);
  }
  if (q5ManualReviewScore !== undefined) {
    candidate.q5ManualReviewScore = clampScore(q5ManualReviewScore);
  }
  if (chapterPassScore !== undefined) {
    candidate.chapterPassScore = clampScore(chapterPassScore);
  }
  if (chapterRepairScore !== undefined) {
    candidate.chapterRepairScore = clampScore(chapterRepairScore);
  }
  if (hardFailScore !== undefined) {
    candidate.hardFailScore = clampScore(hardFailScore);
  }
  if (falsePositiveDelta !== undefined) {
    candidate.falsePositiveDelta = clampScore(falsePositiveDelta);
  }

  candidate.q4ManualReviewScore = Math.min(
    candidate.q4ManualReviewScore,
    candidate.q4PassScore
  );
  candidate.q5ManualReviewScore = Math.min(
    candidate.q5ManualReviewScore,
    candidate.q5PassScore
  );
  candidate.chapterRepairScore = Math.min(
    candidate.chapterRepairScore,
    candidate.chapterPassScore
  );
  candidate.hardFailScore = Math.min(
    candidate.hardFailScore,
    candidate.q4ManualReviewScore,
    candidate.q5ManualReviewScore
  );

  return candidate;
};

const parseReportRecords = (value: unknown): DeepGateCalibrationReportRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const toSummary = (entry: unknown): EvaluationSummary | null => {
    return asRecord(entry) ? (entry as unknown as EvaluationSummary) : null;
  };
  const toComparison = (entry: unknown): EvaluationComparison | null => {
    return asRecord(entry) ? (entry as unknown as EvaluationComparison) : null;
  };

  return value
    .map((item) => asRecord(item))
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const id = asString(record.id);
      const status = asString(record.status);
      const createdAt = asString(record.createdAt);
      if (!id || !createdAt || (status !== "evaluated" && status !== "published")) {
        return null;
      }
      const normalized: DeepGateCalibrationReportRecord = {
        id,
        status,
        createdAt,
        createdBy: asString(record.createdBy) || null,
        reviewedBy: asString(record.reviewedBy) || null,
        changeNote: asString(record.changeNote) || null,
        sampleSize: asInteger(record.sampleSize) || 0,
        baselineTemplate: normalizeTemplate(
          record.baselineTemplate,
          DEFAULT_DEEP_GATE_TEMPLATE
        ),
        candidateTemplate: normalizeTemplate(
          record.candidateTemplate,
          DEFAULT_DEEP_GATE_TEMPLATE
        ),
        baselineSummary: toSummary(record.baselineSummary),
        candidateSummary: toSummary(record.candidateSummary),
        comparison: toComparison(record.comparison),
        publishedVersion: asInteger(record.publishedVersion) || null,
        sampleSetId: asString(record.sampleSetId) || null,
        replayTaskId: asString(record.replayTaskId) || null,
        replayTaskStatus:
          asString(record.replayTaskStatus) === "queued" ||
          asString(record.replayTaskStatus) === "completed" ||
          asString(record.replayTaskStatus) === "failed"
            ? (asString(record.replayTaskStatus) as "queued" | "completed" | "failed")
            : null,
      };
      return normalized;
    })
    .filter((record): record is DeepGateCalibrationReportRecord => Boolean(record));
};

const parseSampleWithReference = (
  value: unknown
): CalibrationSampleWithReference | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const audioFileId = asString(record.audioFileId);
  const expectedVerdict = parseVerdict(record.expectedVerdict);
  const q4Score = asNumber(record.q4Score);
  const q5Score = asNumber(record.q5Score);

  if (!audioFileId || !expectedVerdict || q4Score === undefined || q5Score === undefined) {
    return null;
  }

  return {
    audioFileId,
    qualityResultId: asString(record.qualityResultId) || null,
    q4Score: clampScore(q4Score),
    q5Score: clampScore(q5Score),
    expectedVerdict,
    issueType: (asString(record.issueType) || "UNKNOWN").toUpperCase(),
    source: (asString(record.source) || "unknown").toLowerCase(),
    fallbackUsed: asBoolean(record.fallbackUsed) || false,
  };
};

const parseSampleSetRecords = (value: unknown): DeepGateCalibrationSampleSetRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const id = asString(record.id);
      const createdAt = asString(record.createdAt);
      if (!id || !createdAt) {
        return null;
      }

      const samples = Array.isArray(record.samples)
        ? record.samples
            .map((sample) => parseSampleWithReference(sample))
            .filter((sample): sample is CalibrationSampleWithReference => Boolean(sample))
        : [];
      const audioFileIds =
        Array.isArray(record.audioFileIds) && record.audioFileIds.length > 0
          ? record.audioFileIds.filter((audioFileId): audioFileId is string =>
              typeof audioFileId === "string" ? audioFileId.trim().length > 0 : false
            )
          : Array.from(new Set(samples.map((sample) => sample.audioFileId)));
      const qualityResultIds =
        Array.isArray(record.qualityResultIds) && record.qualityResultIds.length > 0
          ? record.qualityResultIds.filter((qualityResultId): qualityResultId is string =>
              typeof qualityResultId === "string"
                ? qualityResultId.trim().length > 0
                : false
            )
          : Array.from(
              new Set(
                samples
                  .map((sample) => sample.qualityResultId)
                  .filter((qualityResultId): qualityResultId is string =>
                    typeof qualityResultId === "string"
                  )
              )
            );

      return {
        id,
        createdAt,
        createdBy: asString(record.createdBy) || null,
        sampleLimit: asInteger(record.sampleLimit) || samples.length,
        sampleSize: asInteger(record.sampleSize) || samples.length,
        source: (asString(record.source) || "quality_results_snapshot").toLowerCase(),
        audioFileIds,
        qualityResultIds,
        samples,
        latestReplayTaskId: asString(record.latestReplayTaskId) || null,
      } satisfies DeepGateCalibrationSampleSetRecord;
    })
    .filter((record): record is DeepGateCalibrationSampleSetRecord => Boolean(record));
};

const parseReleaseRecords = (value: unknown): DeepGateThresholdReleaseRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asRecord(item))
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const id = asString(record.id);
      const status = asString(record.status);
      const changeType = asString(record.changeType);
      const createdAt = asString(record.createdAt);
      const version = asInteger(record.version);
      if (
        !id ||
        !createdAt ||
        !version ||
        (status !== "active" && status !== "superseded") ||
        (changeType !== "publish" && changeType !== "rollback")
      ) {
        return null;
      }
      return {
        id,
        version,
        status,
        changeType,
        reportId: asString(record.reportId) || null,
        template: normalizeTemplate(record.template, DEFAULT_DEEP_GATE_TEMPLATE),
        createdAt,
        publishedBy: asString(record.publishedBy) || null,
        reviewedBy: asString(record.reviewedBy) || null,
        changeNote: asString(record.changeNote) || null,
        previousVersion: asInteger(record.previousVersion) || null,
        rollbackTargetVersion: asInteger(record.rollbackTargetVersion) || null,
      } satisfies DeepGateThresholdReleaseRecord;
    })
    .filter((record): record is DeepGateThresholdReleaseRecord => Boolean(record));
};

export const readGovernanceState = (
  metadata: Prisma.JsonValue | null | undefined
): {
  rootMetadata: Record<string, unknown>;
  qualityCheckMetadata: Record<string, unknown>;
  governance: DeepGateThresholdGovernanceState;
} => {
  const rootMetadata = asRecord(metadata) || {};
  const qualityCheckMetadata = asRecord(rootMetadata.qualityCheck) || {};
  const governanceRecord = asRecord(qualityCheckMetadata.deepGateThresholdGovernance) || {};
  const reports = parseReportRecords(governanceRecord.reports);
  const releases = parseReleaseRecords(governanceRecord.releases);
  const sampleSets = parseSampleSetRecords(governanceRecord.sampleSets);
  const computedActiveVersion = releases
    .filter((release) => release.status === "active")
    .reduce((maxVersion, release) => Math.max(maxVersion, release.version), 0);

  return {
    rootMetadata,
    qualityCheckMetadata,
    governance: {
      reports,
      releases,
      sampleSets,
      activeVersion: asInteger(governanceRecord.activeVersion) || computedActiveVersion,
      activeReleaseId: asString(governanceRecord.activeReleaseId) || null,
      lastEvaluatedReportId: asString(governanceRecord.lastEvaluatedReportId) || null,
    },
  };
};

export const buildRecommendationTemplate = ({
  qualityCheckMetadata,
  baseline,
}: {
  qualityCheckMetadata: Record<string, unknown>;
  baseline: DeepGateThresholdTemplate;
}): DeepGateThresholdTemplate => {
  const calibrationRecord = asRecord(qualityCheckMetadata.deepGateCalibration);
  const recommendation = asRecord(calibrationRecord?.recommendation);
  if (!recommendation) {
    return baseline;
  }
  return normalizeTemplate(
    {
      q4PassScore: asNumber(recommendation.q4PassScore),
      q4ManualReviewScore: asNumber(recommendation.q4ManualReviewScore),
      q5PassScore: asNumber(recommendation.q5PassScore),
      q5ManualReviewScore: asNumber(recommendation.q5ManualReviewScore),
    },
    baseline
  );
};
