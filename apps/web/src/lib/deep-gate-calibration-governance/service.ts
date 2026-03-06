// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/阈值治理 payload
// output: 评估报告与发布/回滚结果
// pos: 阈值治理服务实现
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  DEFAULT_DEEP_GATE_TEMPLATE,
  DeepGateThresholdTemplate,
} from "@/lib/quality-gate/types";
import { enqueueQualityCheckJob } from "@/lib/task-queue";
import {
  buildEvaluationComparison,
  buildEvaluationSummary,
  parseQualityResultSample,
} from "@/lib/deep-gate-calibration-governance/evaluation";
import {
  asRecord,
  asString,
  buildRecommendationTemplate,
  normalizeTemplate,
  readGovernanceState,
  toInputJsonValue,
} from "@/lib/deep-gate-calibration-governance/parsers";
import {
  CalibrationSample,
  CalibrationSampleWithReference,
  DeepGateCalibrationReportRecord,
  DeepGateCalibrationSampleSetRecord,
  DeepGateThresholdReleaseRecord,
  EvaluateDeepGateCalibrationPayload,
  MAX_GOVERNANCE_HISTORY,
  PublishDeepGateCalibrationPayload,
  RollbackDeepGateCalibrationPayload,
} from "@/lib/deep-gate-calibration-governance/types";

const loadCalibrationSamplesFromQualityResults = async ({
  bookId,
  sampleLimit,
}: {
  bookId: string;
  sampleLimit: number;
}) => {
  const qualityResults = await prisma.qualityCheckResult.findMany({
    where: {
      bookId,
      gate: "FAST_DEEP_GATE",
      stage: {
        in: ["Q1_Q5", "Q0_Q5"],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: sampleLimit,
    select: {
      id: true,
      audioFileId: true,
      verdict: true,
      metrics: true,
      detail: true,
    },
  });

  const sampleMap = new Map<string, CalibrationSampleWithReference>();
  for (const item of qualityResults) {
    if (!item.audioFileId || sampleMap.has(item.audioFileId)) {
      continue;
    }

    const detailRecord = asRecord(item.detail);
    const source = asString(detailRecord?.source)?.toLowerCase();
    if (source === "calibration_eval") {
      continue;
    }

    const sample = parseQualityResultSample(item);
    if (!sample) {
      continue;
    }

    sampleMap.set(item.audioFileId, {
      ...sample,
      audioFileId: item.audioFileId,
      qualityResultId: item.id,
    });
  }

  return Array.from(sampleMap.values()).slice(0, sampleLimit);
};

const cloneCalibrationSample = (
  sample: CalibrationSampleWithReference
): CalibrationSampleWithReference => ({
  audioFileId: sample.audioFileId,
  qualityResultId: sample.qualityResultId,
  q4Score: sample.q4Score,
  q5Score: sample.q5Score,
  expectedVerdict: sample.expectedVerdict,
  issueType: sample.issueType,
  source: sample.source,
  fallbackUsed: sample.fallbackUsed,
});

const asEvaluationSample = (
  sample: CalibrationSampleWithReference
): CalibrationSample => ({
  q4Score: sample.q4Score,
  q5Score: sample.q5Score,
  expectedVerdict: sample.expectedVerdict,
  issueType: sample.issueType,
  source: sample.source,
  fallbackUsed: sample.fallbackUsed,
});

const buildSampleSetRecord = ({
  payload,
  samples,
}: {
  payload: EvaluateDeepGateCalibrationPayload;
  samples: CalibrationSampleWithReference[];
}): DeepGateCalibrationSampleSetRecord => {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    createdBy: payload.createdBy,
    sampleLimit: payload.sampleLimit,
    sampleSize: samples.length,
    source: "quality_results_snapshot",
    audioFileIds: samples.map((sample) => sample.audioFileId),
    qualityResultIds: samples
      .map((sample) => sample.qualityResultId)
      .filter((id): id is string => typeof id === "string"),
    samples: samples.map((sample) => cloneCalibrationSample(sample)),
    latestReplayTaskId: null,
  };
};

const resolveCalibrationSamples = async ({
  governance,
  payload,
  bookId,
}: {
  governance: ReturnType<typeof readGovernanceState>["governance"];
  payload: EvaluateDeepGateCalibrationPayload;
  bookId: string;
}): Promise<{
  samples: CalibrationSample[];
  sampleSet: DeepGateCalibrationSampleSetRecord | null;
  appendSampleSet: boolean;
}> => {
  if (payload.samples && payload.sampleSetId) {
    throw new ValidationError("samples 与 sampleSetId 不能同时指定");
  }

  if (payload.samples) {
    return {
      samples: payload.samples,
      sampleSet: null,
      appendSampleSet: false,
    };
  }

  if (payload.sampleSetId) {
    const sampleSet = governance.sampleSets.find(
      (item) => item.id === payload.sampleSetId
    );
    if (!sampleSet) {
      throw new ValidationError(`未找到评估样本集 ${payload.sampleSetId}`);
    }
    if (sampleSet.samples.length === 0) {
      throw new ValidationError("指定样本集没有可用于评估的样本");
    }
    return {
      samples: sampleSet.samples.map((sample) => asEvaluationSample(sample)),
      sampleSet,
      appendSampleSet: false,
    };
  }

  const qualitySamples = await loadCalibrationSamplesFromQualityResults({
    bookId,
    sampleLimit: payload.sampleLimit,
  });
  if (qualitySamples.length === 0) {
    throw new ValidationError("没有可用于离线评估的样本");
  }

  const sampleSet = buildSampleSetRecord({
    payload,
    samples: qualitySamples,
  });

  return {
    samples: sampleSet.samples.map((sample) => asEvaluationSample(sample)),
    sampleSet,
    appendSampleSet: true,
  };
};

const createCalibrationReplayTask = async ({
  bookId,
  reportId,
  sampleSet,
  candidateTemplate,
  replayDryRun,
}: {
  bookId: string;
  reportId: string;
  sampleSet: DeepGateCalibrationSampleSetRecord;
  candidateTemplate: DeepGateThresholdTemplate;
  replayDryRun: boolean;
}): Promise<string> => {
  const totalItems = sampleSet.audioFileIds.length;
  if (totalItems === 0) {
    throw new ValidationError("评估样本集为空，无法创建回放任务");
  }

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "QUALITY_CHECK",
      status: "processing",
      progress: 0,
      totalItems,
      taskData: toInputJsonValue({
        message: "Deep Gate 校准回放任务已创建",
        metadata: {
          source: "calibration_eval",
          type: "batch",
          audioFileIds: sampleSet.audioFileIds,
          totalItems,
          deepGateThresholdTemplate: candidateTemplate,
          calibrationEval: {
            enabled: true,
            dryRun: replayDryRun,
            reportId,
            sampleSetId: sampleSet.id,
            sampleLabels: sampleSet.samples,
          },
        },
      }),
    },
  });

  try {
    await enqueueQualityCheckJob(
      {
        taskId: task.id,
        bookId,
        type: "batch",
        audioFileIds: sampleSet.audioFileIds,
      },
      {
        allowReuse: false,
        reason: "calibration_evaluate",
      }
    );
  } catch (queueError) {
    const message = queueError instanceof Error ? queueError.message : "回放任务入队失败";
    const failedTaskData = await mergeTaskData(task.id, {
      message: "Deep Gate 校准回放入队失败",
      metadata: {
        queueError: message,
      },
    });

    await prisma.processingTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    throw queueError;
  }

  return task.id;
};

export const evaluateDeepGateCalibrationForBook = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: EvaluateDeepGateCalibrationPayload;
}) => {
  const book = await prisma.book.findUnique({
    where: {
      id: bookId,
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  const { rootMetadata, qualityCheckMetadata, governance } = readGovernanceState(
    book.metadata
  );
  const baselineTemplate =
    payload.baselineTemplate ||
    normalizeTemplate(
      qualityCheckMetadata.deepGateThresholdTemplate,
      DEFAULT_DEEP_GATE_TEMPLATE
    );
  const candidateTemplate =
    payload.candidateTemplate ||
    buildRecommendationTemplate({
      qualityCheckMetadata,
      baseline: baselineTemplate,
    });

  const { samples, sampleSet, appendSampleSet } = await resolveCalibrationSamples({
    governance,
    payload,
    bookId,
  });

  const baselineSummary = buildEvaluationSummary({
    template: baselineTemplate,
    samples,
  });
  const candidateSummary = buildEvaluationSummary({
    template: candidateTemplate,
    samples,
  });
  const comparison = buildEvaluationComparison({
    baseline: baselineSummary,
    candidate: candidateSummary,
  });

  const nowIso = new Date().toISOString();
  let replayTaskId: string | null = null;

  const report: DeepGateCalibrationReportRecord = {
    id: randomUUID(),
    status: "evaluated",
    createdAt: nowIso,
    createdBy: payload.createdBy,
    reviewedBy: payload.reviewedBy,
    changeNote: payload.changeNote,
    sampleSize: samples.length,
    baselineTemplate,
    candidateTemplate,
    baselineSummary,
    candidateSummary,
    comparison,
    publishedVersion: null,
    sampleSetId: sampleSet?.id || null,
    replayTaskId: null,
    replayTaskStatus: null,
  };

  if (payload.createReplayTask && sampleSet && sampleSet.audioFileIds.length > 0) {
    replayTaskId = await createCalibrationReplayTask({
      bookId,
      reportId: report.id,
      sampleSet,
      candidateTemplate,
      replayDryRun: payload.replayDryRun,
    });
    report.replayTaskId = replayTaskId;
    report.replayTaskStatus = "queued";
    sampleSet.latestReplayTaskId = replayTaskId;
  }

  const nextReports = [report, ...governance.reports].slice(0, MAX_GOVERNANCE_HISTORY);
  const nextSampleSets =
    appendSampleSet && sampleSet
      ? [sampleSet, ...governance.sampleSets].slice(0, MAX_GOVERNANCE_HISTORY)
      : governance.sampleSets;
  const nextGovernance = {
    reports: nextReports,
    releases: governance.releases,
    sampleSets: nextSampleSets,
    activeVersion: governance.activeVersion,
    activeReleaseId: governance.activeReleaseId,
    updatedAt: nowIso,
    lastEvaluatedReportId: report.id,
  };

  await prisma.book.update({
    where: {
      id: bookId,
    },
    data: {
      metadata: toInputJsonValue({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheckMetadata,
          deepGateThresholdGovernance: nextGovernance,
        },
      }),
    },
  });

  return {
    report,
    activeVersion: governance.activeVersion,
    activeReleaseId: governance.activeReleaseId,
    replayTaskId,
  };
};

export const publishDeepGateCalibrationForBook = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: PublishDeepGateCalibrationPayload;
}) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      metadata: true,
    },
  });
  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  const { rootMetadata, qualityCheckMetadata, governance } = readGovernanceState(
    book.metadata
  );
  const report = governance.reports.find((item) => item.id === payload.reportId);
  if (!report) {
    throw new ValidationError("reportId 无效，未找到对应评估报告");
  }
  if (payload.expectedVersion !== null && payload.expectedVersion !== governance.activeVersion) {
    throw new ValidationError(
      `expectedVersion=${payload.expectedVersion} 与当前版本 ${governance.activeVersion} 不一致`
    );
  }
  if (report.status === "published" && report.publishedVersion !== null) {
    throw new ValidationError(`该评估报告已发布为版本 v${report.publishedVersion}`);
  }

  const nowIso = new Date().toISOString();
  const nextVersion = governance.activeVersion + 1;
  const release: DeepGateThresholdReleaseRecord = {
    id: randomUUID(),
    version: nextVersion,
    status: "active",
    changeType: "publish",
    reportId: report.id,
    template: report.candidateTemplate,
    createdAt: nowIso,
    publishedBy: payload.publishedBy,
    reviewedBy: payload.reviewedBy,
    changeNote: payload.changeNote,
    previousVersion: governance.activeVersion > 0 ? governance.activeVersion : null,
    rollbackTargetVersion: null,
  };

  const nextReleases = [release, ...governance.releases]
    .map((item) => ({
      ...item,
      status: item.id === release.id ? "active" : "superseded",
    }))
    .slice(0, MAX_GOVERNANCE_HISTORY);
  const nextReports = governance.reports.map((item) =>
    item.id === report.id
      ? {
          ...item,
          status: "published",
          publishedVersion: nextVersion,
          reviewedBy: payload.reviewedBy,
          changeNote: payload.changeNote || item.changeNote,
        }
      : item
  );

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheckMetadata,
          deepGateThresholdTemplate: release.template,
          deepGateThresholdRelease: {
            releaseId: release.id,
            version: release.version,
            reportId: release.reportId,
            changeType: release.changeType,
            publishedAt: release.createdAt,
            publishedBy: release.publishedBy,
            reviewedBy: release.reviewedBy,
          },
          deepGateThresholdGovernance: {
            reports: nextReports,
            releases: nextReleases,
            sampleSets: governance.sampleSets,
            activeVersion: nextVersion,
            activeReleaseId: release.id,
            updatedAt: nowIso,
            lastEvaluatedReportId: governance.lastEvaluatedReportId,
          },
        },
      }),
    },
  });

  return {
    release,
    reportId: report.id,
  };
};

export const rollbackDeepGateCalibrationForBook = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: RollbackDeepGateCalibrationPayload;
}) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      metadata: true,
    },
  });
  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  const { rootMetadata, qualityCheckMetadata, governance } = readGovernanceState(
    book.metadata
  );
  const targetRelease = governance.releases.find(
    (release) => release.version === payload.targetVersion
  );
  if (!targetRelease) {
    throw new ValidationError(`未找到阈值版本 v${payload.targetVersion}`);
  }
  if (payload.expectedVersion !== null && payload.expectedVersion !== governance.activeVersion) {
    throw new ValidationError(
      `expectedVersion=${payload.expectedVersion} 与当前版本 ${governance.activeVersion} 不一致`
    );
  }

  const nowIso = new Date().toISOString();
  const nextVersion = governance.activeVersion + 1;
  const release: DeepGateThresholdReleaseRecord = {
    id: randomUUID(),
    version: nextVersion,
    status: "active",
    changeType: "rollback",
    reportId: targetRelease.reportId,
    template: targetRelease.template,
    createdAt: nowIso,
    publishedBy: payload.rolledBackBy,
    reviewedBy: payload.reviewedBy,
    changeNote: payload.changeNote,
    previousVersion: governance.activeVersion > 0 ? governance.activeVersion : null,
    rollbackTargetVersion: payload.targetVersion,
  };

  const nextReleases = [release, ...governance.releases]
    .map((item) => ({
      ...item,
      status: item.id === release.id ? "active" : "superseded",
    }))
    .slice(0, MAX_GOVERNANCE_HISTORY);

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheckMetadata,
          deepGateThresholdTemplate: release.template,
          deepGateThresholdRelease: {
            releaseId: release.id,
            version: release.version,
            reportId: release.reportId,
            changeType: release.changeType,
            rollbackTargetVersion: payload.targetVersion,
            publishedAt: release.createdAt,
            publishedBy: release.publishedBy,
            reviewedBy: release.reviewedBy,
          },
          deepGateThresholdGovernance: {
            reports: governance.reports,
            releases: nextReleases,
            sampleSets: governance.sampleSets,
            activeVersion: nextVersion,
            activeReleaseId: release.id,
            updatedAt: nowIso,
            lastEvaluatedReportId: governance.lastEvaluatedReportId,
          },
        },
      }),
    },
  });

  return {
    release,
    rollbackTargetVersion: payload.targetVersion,
  };
};
