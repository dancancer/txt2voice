import type { Prisma } from "@/lib/prisma";
import type { CombinedQualityDecision } from "@/lib/quality-gate";
import { persistChapterQualityAudit } from "@/lib/quality-check/persistence";
import type { FastGateVerdict } from "@/lib/quality-check/shared-types";

export interface ChapterAuditAccumulator {
  chapterId: string;
  checked: number;
  passCount: number;
  repairCount: number;
  manualReviewCount: number;
  hardFailCount: number;
  issueTypeCounts: Record<string, number>;
  scoreSum: number;
  q4ScoreSum: number;
  q5ScoreSum: number;
  charsPerSecondValues: number[];
  voiceProfileBuckets: Record<string, number[]>;
}

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const updateIssueTypeCount = (
  bucket: Record<string, number>,
  issueType: string
): void => {
  bucket[issueType] = (bucket[issueType] || 0) + 1;
};

const pushVoiceProfileStats = (
  bucket: Record<string, number[]>,
  voiceProfileId: string | null,
  charsPerSecond: number
): void => {
  if (!voiceProfileId) {
    return;
  }

  const normalizedId = voiceProfileId.trim();
  if (!normalizedId) {
    return;
  }

  if (!bucket[normalizedId]) {
    bucket[normalizedId] = [];
  }
  bucket[normalizedId].push(charsPerSecond);
};

const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)
  );
};

const standardDeviation = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const mean = average(values);
  if (mean === null) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(4));
};

const toChapterAuditVerdict = ({
  overallScore,
  averageQ5Score,
  hardFailCount,
  template,
}: {
  overallScore: number;
  averageQ5Score: number;
  hardFailCount: number;
  template: {
    chapterRepairScore: number;
    q5ManualReviewScore: number;
    chapterPassScore: number;
    q5PassScore: number;
  };
}): FastGateVerdict => {
  if (
    hardFailCount > 0 ||
    overallScore < template.chapterRepairScore ||
    averageQ5Score < template.q5ManualReviewScore
  ) {
    return "manual_review";
  }

  if (
    overallScore < template.chapterPassScore ||
    averageQ5Score < template.q5PassScore
  ) {
    return "repair";
  }

  return "pass";
};

export const updateChapterAuditMap = ({
  chapterAuditMap,
  chapterId,
  voiceProfileId,
  decision,
}: {
  chapterAuditMap: Map<string, ChapterAuditAccumulator>;
  chapterId: string | null;
  voiceProfileId: string | null;
  decision: CombinedQualityDecision;
}): void => {
  if (!chapterId) {
    return;
  }

  const chapterAudit = chapterAuditMap.get(chapterId) || {
    chapterId,
    checked: 0,
    passCount: 0,
    repairCount: 0,
    manualReviewCount: 0,
    hardFailCount: 0,
    issueTypeCounts: {},
    scoreSum: 0,
    q4ScoreSum: 0,
    q5ScoreSum: 0,
    charsPerSecondValues: [],
    voiceProfileBuckets: {},
  };

  chapterAudit.checked += 1;
  chapterAudit.scoreSum += decision.score;
  chapterAudit.q4ScoreSum += decision.q4Score;
  chapterAudit.q5ScoreSum += decision.q5Score;
  chapterAudit.charsPerSecondValues.push(decision.charsPerSecond);
  pushVoiceProfileStats(
    chapterAudit.voiceProfileBuckets,
    voiceProfileId,
    decision.charsPerSecond
  );
  updateIssueTypeCount(chapterAudit.issueTypeCounts, decision.issueType);

  if (decision.verdict === "pass") {
    chapterAudit.passCount += 1;
  } else if (decision.verdict === "repair") {
    chapterAudit.repairCount += 1;
  } else if (decision.verdict === "hard_fail") {
    chapterAudit.hardFailCount += 1;
    chapterAudit.manualReviewCount += 1;
  } else {
    chapterAudit.manualReviewCount += 1;
  }

  chapterAuditMap.set(chapterId, chapterAudit);
};

export const persistChapterAudits = async ({
  bookId,
  taskId,
  chapterAuditMap,
  thresholdTemplate,
}: {
  bookId: string;
  taskId: string;
  chapterAuditMap: Map<string, ChapterAuditAccumulator>;
  thresholdTemplate: {
    chapterRepairScore: number;
    q4PassScore: number;
    q5ManualReviewScore: number;
    chapterPassScore: number;
    q5PassScore: number;
  };
}): Promise<{
  chapterAuditCount: number;
  chapterAuditManualReviewCount: number;
  chapterAuditRepairCount: number;
}> => {
  let chapterAuditCount = 0;
  let chapterAuditManualReviewCount = 0;
  let chapterAuditRepairCount = 0;

  for (const chapterAudit of chapterAuditMap.values()) {
    if (chapterAudit.checked <= 0) {
      continue;
    }

    const overallScore = clampScore(chapterAudit.scoreSum / chapterAudit.checked);
    const averageQ4Score = clampScore(chapterAudit.q4ScoreSum / chapterAudit.checked);
    const averageQ5Score = clampScore(chapterAudit.q5ScoreSum / chapterAudit.checked);
    const paceMean = average(chapterAudit.charsPerSecondValues);
    const paceStdDev = standardDeviation(chapterAudit.charsPerSecondValues);

    const speakerDrift: Record<string, Prisma.InputJsonValue> = {};
    for (const [voiceProfileId, values] of Object.entries(
      chapterAudit.voiceProfileBuckets
    )) {
      speakerDrift[voiceProfileId] = {
        sampleCount: values.length,
        averageCharsPerSecond: average(values),
        stdDevCharsPerSecond: standardDeviation(values),
      } as Prisma.InputJsonValue;
    }

    const verdict = toChapterAuditVerdict({
      overallScore,
      averageQ5Score,
      hardFailCount: chapterAudit.hardFailCount,
      template: thresholdTemplate,
    });

    const actions: string[] = [];
    if (averageQ4Score < thresholdTemplate.q4PassScore) {
      actions.push("review_emotion_template");
    }
    if (averageQ5Score < thresholdTemplate.q5PassScore) {
      actions.push("review_chapter_continuity");
    }
    if (chapterAudit.manualReviewCount > 0) {
      actions.push("prioritize_manual_review_queue");
    }
    if (actions.length === 0) {
      actions.push("no_action_required");
    }

    await persistChapterQualityAudit({
      bookId,
      taskId,
      chapterId: chapterAudit.chapterId,
      verdict,
      overallScore,
      speakerDrift,
      checked: chapterAudit.checked,
      averageQ4Score,
      averageQ5Score,
      averageCharsPerSecond: paceMean,
      stdDevCharsPerSecond: paceStdDev,
      issueTypeCounts: chapterAudit.issueTypeCounts,
      actions,
    });

    chapterAuditCount += 1;
    if (verdict === "manual_review") {
      chapterAuditManualReviewCount += 1;
    } else if (verdict === "repair") {
      chapterAuditRepairCount += 1;
    }
  }

  return {
    chapterAuditCount,
    chapterAuditManualReviewCount,
    chapterAuditRepairCount,
  };
};
