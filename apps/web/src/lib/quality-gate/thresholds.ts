// 一旦我被更新，请更新我的开头注释
// input: 任务/书籍阈值配置与章节样本
// output: Deep Gate 阈值模板与章节上下文
// pos: 质量门控阈值模块

import {
  ChapterGateContext,
  ChapterGateSample,
  DeepGateThresholdResolution,
  DeepGateThresholdTemplate,
  DEFAULT_DEEP_GATE_TEMPLATE,
} from "@/lib/quality-gate/types";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const normalizeRoleType = (value: string): string => {
  const normalized = (value || "narration").trim().toLowerCase();
  return normalized || "narration";
};

const normalizeVoiceProfileId = (value: string): string => {
  const normalized = (value || "").trim();
  return normalized;
};

const parseTemplate = (
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

export const resolveDeepGateThresholdTemplate = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata: unknown;
  bookMetadata: unknown;
}): DeepGateThresholdResolution => {
  const bookRoot = asRecord(bookMetadata);
  const bookQuality = asRecord(bookRoot?.qualityCheck);
  const taskRoot = asRecord(taskMetadata);

  const bookTemplate = parseTemplate(
    bookQuality?.deepGateThresholdTemplate,
    DEFAULT_DEEP_GATE_TEMPLATE
  );
  const taskTemplate = parseTemplate(
    taskRoot?.deepGateThresholdTemplate || taskRoot?.thresholdTemplate,
    bookTemplate
  );

  const source = taskRoot?.deepGateThresholdTemplate || taskRoot?.thresholdTemplate
    ? "task_override"
    : bookQuality?.deepGateThresholdTemplate
      ? "book_metadata"
      : "default";

  return {
    template: taskTemplate,
    source,
  };
};

export const buildChapterGateContextMap = (
  samples: ChapterGateSample[]
): Map<string, ChapterGateContext> => {
  const chapterBuckets = new Map<
    string,
    {
      totalScore: number;
      sampleCount: number;
      roleBuckets: Map<string, { totalScore: number; sampleCount: number }>;
      voiceBuckets: Map<string, { totalScore: number; sampleCount: number }>;
    }
  >();

  for (const sample of samples) {
    if (!sample.chapterId || !Number.isFinite(sample.charsPerSecond)) {
      continue;
    }

    const existing = chapterBuckets.get(sample.chapterId) || {
      totalScore: 0,
      sampleCount: 0,
      roleBuckets: new Map<string, { totalScore: number; sampleCount: number }>(),
      voiceBuckets: new Map<string, { totalScore: number; sampleCount: number }>(),
    };

    existing.totalScore += sample.charsPerSecond;
    existing.sampleCount += 1;

    const roleType = normalizeRoleType(sample.roleType);
    const roleBucket = existing.roleBuckets.get(roleType) || {
      totalScore: 0,
      sampleCount: 0,
    };
    roleBucket.totalScore += sample.charsPerSecond;
    roleBucket.sampleCount += 1;
    existing.roleBuckets.set(roleType, roleBucket);

    const voiceProfileId = normalizeVoiceProfileId(sample.voiceProfileId);
    if (voiceProfileId) {
      const voiceBucket = existing.voiceBuckets.get(voiceProfileId) || {
        totalScore: 0,
        sampleCount: 0,
      };
      voiceBucket.totalScore += sample.charsPerSecond;
      voiceBucket.sampleCount += 1;
      existing.voiceBuckets.set(voiceProfileId, voiceBucket);
    }

    chapterBuckets.set(sample.chapterId, existing);
  }

  const result = new Map<string, ChapterGateContext>();
  for (const [chapterId, bucket] of chapterBuckets.entries()) {
    const roleTypeAverages: Record<string, number> = {};
    const voiceProfileAverages: Record<string, number> = {};

    for (const [roleType, roleBucket] of bucket.roleBuckets.entries()) {
      roleTypeAverages[roleType] = Number(
        (roleBucket.totalScore / roleBucket.sampleCount).toFixed(4)
      );
    }

    for (const [voiceProfileId, voiceBucket] of bucket.voiceBuckets.entries()) {
      voiceProfileAverages[voiceProfileId] = Number(
        (voiceBucket.totalScore / voiceBucket.sampleCount).toFixed(4)
      );
    }

    result.set(chapterId, {
      chapterId,
      sampleCount: bucket.sampleCount,
      averageCharsPerSecond: Number(
        (bucket.totalScore / bucket.sampleCount).toFixed(4)
      ),
      roleTypeAverages,
      voiceProfileAverages,
    });
  }

  return result;
};
