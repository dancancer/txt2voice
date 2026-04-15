// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/评估 payload/治理状态
// output: 样本集解析与回放任务创建能力
// pos: 阈值治理服务实现
import { randomUUID } from "crypto";

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueQualityCheckJob } from "@/lib/task-queue";
import { parseQualityResultSample } from "@/lib/deep-gate-calibration-governance/evaluation";
import type { DeepGateThresholdTemplate } from "@/lib/quality-gate/types";
import {
  asRecord,
  asString,
  toInputJsonValue,
} from "@/lib/deep-gate-calibration-governance/parsers";
import type {
  CalibrationSample,
  CalibrationSampleWithReference,
  DeepGateCalibrationSampleSetRecord,
  EvaluateDeepGateCalibrationPayload,
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

export const resolveCalibrationSamples = async ({
  governance,
  payload,
  bookId,
}: {
  governance: {
    sampleSets: DeepGateCalibrationSampleSetRecord[];
  };
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

export const createCalibrationReplayTask = async ({
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
