// 一旦我被更新，请更新我的开头注释
// input: SLO 查询参数/数据库依赖
// output: 核心 SLO 指标快照
// pos: S32 指标服务
import prisma from "@/lib/prisma";
import {
  DAY_MS,
  appendTaskStatus,
  asNumber,
  asString,
  buildAverageMetric,
  buildRatioMetric,
  createTaskTypeSummary,
  hasCalibrationLabel,
  matchesSource,
  readTaskMetadata,
  resolveManualReviewSource,
  resolveQualitySource,
  resolveTaskSource,
} from "@/lib/slo-metrics/helpers";
import type {
  BookSloMetricsQuery,
  BookSloMetricsResult,
} from "@/lib/slo-metrics/types";

export const getBookSloMetrics = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: BookSloMetricsQuery;
}): Promise<BookSloMetricsResult> => {
  const until = new Date();
  const since = new Date(until.getTime() - query.windowDays * DAY_MS);

  const [tasks, qualityResults, manualReviewItems, chapterAudits] = await Promise.all([
    prisma.processingTask.findMany({
      where: {
        bookId,
        createdAt: { gte: since },
        taskType: {
          in: ["AUTO_PIPELINE", "FINAL_ASSEMBLY", "MANUAL_REVIEW_SYNC", "QUALITY_CHECK"],
        },
      },
      select: {
        id: true,
        taskType: true,
        status: true,
        taskData: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qualityCheckResult.findMany({
      where: {
        bookId,
        createdAt: { gte: since },
        sentenceId: { not: null },
      },
      select: {
        sentenceId: true,
        verdict: true,
        detail: true,
        createdAt: true,
      },
      orderBy: [{ sentenceId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.manualReviewItem.findMany({
      where: {
        bookId,
        createdAt: { gte: since },
        sentenceId: { not: null },
      },
      select: {
        sentenceId: true,
        status: true,
        issueDetail: true,
        resolutionNote: true,
      },
    }),
    prisma.chapterQualityAudit.findMany({
      where: {
        bookId,
        auditedAt: { gte: since },
      },
      select: {
        auditBatchId: true,
        verdict: true,
      },
    }),
  ]);

  const qualityTaskById = new Map(
    tasks
      .filter((task) => task.taskType === "QUALITY_CHECK")
      .map((task) => [task.id, task])
  );

  const workflowSummary = {
    autoPipeline: {
      ...createTaskTypeSummary(),
      pendingReviewHandOffCount: 0,
      directDeliveryCount: 0,
    },
    finalAssembly: createTaskTypeSummary(),
    manualReviewSync: createTaskTypeSummary(),
    deliveryTerminalCount: 0,
    deliverySuccessCount: 0,
    deliveryFailureCount: 0,
  };

  let latestQualityTask: BookSloMetricsResult["latestQualityTask"] = null;

  for (const task of tasks) {
    const source = resolveTaskSource(task.taskData);
    const metadata = readTaskMetadata(task.taskData);

    if (task.taskType === "QUALITY_CHECK") {
      if (!matchesSource(query.source, source) || source === "calibration_eval") {
        continue;
      }
      if (!latestQualityTask) {
        latestQualityTask = {
          taskId: task.id,
          source,
          completedAt: asString(metadata?.completedAt),
          checked: Number(asNumber(metadata?.checked) || 0),
          passCount: Number(asNumber(metadata?.passCount) || 0),
          repairCount: Number(asNumber(metadata?.repairCount) || 0),
          manualReviewCount: Number(asNumber(metadata?.manualReviewCount) || 0),
          hardFailCount: Number(asNumber(metadata?.hardFailCount) || 0),
        };
      }
      continue;
    }

    if (!matchesSource(query.source, source)) {
      continue;
    }

    if (task.taskType === "AUTO_PIPELINE") {
      appendTaskStatus(workflowSummary.autoPipeline, task.status);
      const pendingReviewCount = Number(asNumber(metadata?.pendingReviewCount) || 0);
      if (task.status === "completed" && pendingReviewCount > 0) {
        workflowSummary.autoPipeline.pendingReviewHandOffCount += 1;
      } else {
        workflowSummary.autoPipeline.directDeliveryCount += 1;
        if (task.status === "completed" || task.status === "failed") {
          workflowSummary.deliveryTerminalCount += 1;
          if (task.status === "completed") {
            workflowSummary.deliverySuccessCount += 1;
          } else {
            workflowSummary.deliveryFailureCount += 1;
          }
        }
      }
      continue;
    }

    if (task.taskType === "FINAL_ASSEMBLY") {
      appendTaskStatus(workflowSummary.finalAssembly, task.status);
      if (task.status === "completed" || task.status === "failed") {
        workflowSummary.deliveryTerminalCount += 1;
        if (task.status === "completed") {
          workflowSummary.deliverySuccessCount += 1;
        } else {
          workflowSummary.deliveryFailureCount += 1;
        }
      }
      continue;
    }

    if (task.taskType === "MANUAL_REVIEW_SYNC") {
      appendTaskStatus(workflowSummary.manualReviewSync, task.status);
    }
  }

  const sentenceQualityRows = qualityResults.filter((row) => {
    if (!row.sentenceId || hasCalibrationLabel(row.detail)) {
      return false;
    }
    return matchesSource(query.source, resolveQualitySource(row.detail));
  });

  const sentenceResultMap = new Map<string, typeof sentenceQualityRows>();
  for (const row of sentenceQualityRows) {
    if (!row.sentenceId) {
      continue;
    }
    const bucket = sentenceResultMap.get(row.sentenceId) || [];
    bucket.push(row);
    sentenceResultMap.set(row.sentenceId, bucket);
  }

  let firstPassCount = 0;
  for (const rows of sentenceResultMap.values()) {
    if (rows[0]?.verdict === "pass") {
      firstPassCount += 1;
    }
  }

  const sentenceIds = Array.from(sentenceResultMap.keys());
  const attempts =
    sentenceIds.length > 0
      ? await prisma.synthesisAttempt.findMany({
          where: {
            bookId,
            sentenceId: {
              in: sentenceIds,
            },
          },
          select: {
            sentenceId: true,
            attemptNo: true,
          },
          orderBy: [{ sentenceId: "asc" }, { attemptNo: "desc" }],
        })
      : [];

  const maxAttemptBySentence = new Map<string, number>();
  for (const attempt of attempts) {
    const current = maxAttemptBySentence.get(attempt.sentenceId) || 0;
    if (attempt.attemptNo > current) {
      maxAttemptBySentence.set(attempt.sentenceId, attempt.attemptNo);
    }
  }

  let totalRetryCount = 0;
  for (const sentenceId of sentenceIds) {
    totalRetryCount += Math.max(0, (maxAttemptBySentence.get(sentenceId) || 1) - 1);
  }

  const filteredManualReviewItems = manualReviewItems.filter((item) => {
    if (!item.sentenceId) {
      return false;
    }
    return matchesSource(
      query.source,
      resolveManualReviewSource(item.issueDetail, item.resolutionNote)
    );
  });

  const manualReviewSummary = {
    createdCount: filteredManualReviewItems.length,
    uniqueSentenceCount: 0,
    pendingCount: 0,
    reprocessingCount: 0,
    resolvedCount: 0,
    rejectedCount: 0,
  };
  const manualReviewSentenceIds = new Set<string>();

  for (const item of filteredManualReviewItems) {
    if (item.sentenceId && sentenceResultMap.has(item.sentenceId)) {
      manualReviewSentenceIds.add(item.sentenceId);
    }
    if (item.status === "pending") {
      manualReviewSummary.pendingCount += 1;
    } else if (item.status === "reprocessing") {
      manualReviewSummary.reprocessingCount += 1;
    } else if (item.status === "resolved") {
      manualReviewSummary.resolvedCount += 1;
    } else if (item.status === "rejected") {
      manualReviewSummary.rejectedCount += 1;
    }
  }
  manualReviewSummary.uniqueSentenceCount = manualReviewSentenceIds.size;

  const filteredChapterAudits = chapterAudits.filter((audit) => {
    if (!query.source) {
      return true;
    }
    const batchTask = qualityTaskById.get(audit.auditBatchId);
    return matchesSource(query.source, resolveTaskSource(batchTask?.taskData));
  });

  const chapterAuditSummary = {
    total: filteredChapterAudits.length,
    failedCount: 0,
    repairCount: 0,
    manualReviewCount: 0,
  };

  for (const audit of filteredChapterAudits) {
    if (audit.verdict !== "pass") {
      chapterAuditSummary.failedCount += 1;
    }
    if (audit.verdict === "repair") {
      chapterAuditSummary.repairCount += 1;
    }
    if (audit.verdict === "manual_review") {
      chapterAuditSummary.manualReviewCount += 1;
    }
  }

  return {
    window: {
      days: query.windowDays,
      since: since.toISOString(),
      until: until.toISOString(),
    },
    filter: {
      source: query.source || null,
    },
    metrics: {
      pipelineSuccessRate: buildRatioMetric({
        key: "pipeline_success_rate",
        label: "整书完成率",
        numerator: workflowSummary.deliverySuccessCount,
        denominator: workflowSummary.deliveryTerminalCount,
        direction: "higher_is_better",
        target: 0.95,
      }),
      sentencePassRateFirstTry: buildRatioMetric({
        key: "sentence_pass_rate_first_try",
        label: "首轮通过率",
        numerator: firstPassCount,
        denominator: sentenceIds.length,
        direction: "higher_is_better",
      }),
      avgRetryPerSentence: buildAverageMetric({
        key: "avg_retry_per_sentence",
        label: "句均返工次数",
        total: totalRetryCount,
        denominator: sentenceIds.length,
        direction: "lower_is_better",
      }),
      manualReviewRatio: buildRatioMetric({
        key: "manual_review_ratio",
        label: "人工复核占比",
        numerator: manualReviewSentenceIds.size,
        denominator: sentenceIds.length,
        direction: "lower_is_better",
      }),
      chapterConsistencyFailRate: buildRatioMetric({
        key: "chapter_consistency_fail_rate",
        label: "章节审计失败率",
        numerator: chapterAuditSummary.failedCount,
        denominator: chapterAuditSummary.total,
        direction: "lower_is_better",
        target: 0.03,
      }),
    },
    workflowSummary,
    qualitySummary: {
      sentenceCount: sentenceIds.length,
      firstPassCount,
      manualReviewSentenceCount: manualReviewSentenceIds.size,
      totalRetryCount,
    },
    manualReviewSummary,
    chapterAuditSummary,
    latestQualityTask,
  };
};
