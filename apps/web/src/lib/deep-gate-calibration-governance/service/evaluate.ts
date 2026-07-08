// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/评估 payload
// output: Deep Gate 离线评估结果
// pos: 阈值治理服务实现
import { randomUUID } from "crypto";

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  DEFAULT_DEEP_GATE_TEMPLATE,
  type DeepGateThresholdTemplate,
} from "@/lib/quality-gate/types";
import {
  buildEvaluationComparison,
  buildEvaluationSummary,
} from "@/lib/deep-gate-calibration-governance/evaluation";
import {
  buildRecommendationTemplate,
  normalizeTemplate,
  readGovernanceState,
  toInputJsonValue,
} from "@/lib/deep-gate-calibration-governance/parsers";
import {
  MAX_GOVERNANCE_HISTORY,
  type CalibrationSample,
  type DeepGateCalibrationReportRecord,
  type DeepGateCalibrationSampleSetRecord,
  type EvaluateDeepGateCalibrationPayload,
} from "@/lib/deep-gate-calibration-governance/types";
import {
  createCalibrationReplayTask,
  resolveCalibrationSamples,
} from "./sample-sets";

const buildTemplates = (params: {
  payload: EvaluateDeepGateCalibrationPayload;
  qualityCheckMetadata: Record<string, unknown>;
}): {
  baselineTemplate: DeepGateThresholdTemplate;
  candidateTemplate: DeepGateThresholdTemplate;
} => {
  const baselineTemplate =
    params.payload.baselineTemplate ||
    normalizeTemplate(
      params.qualityCheckMetadata.deepGateThresholdTemplate,
      DEFAULT_DEEP_GATE_TEMPLATE
    );
  const candidateTemplate =
    params.payload.candidateTemplate ||
    buildRecommendationTemplate({
      qualityCheckMetadata: params.qualityCheckMetadata,
      baseline: baselineTemplate,
    });

  return {
    baselineTemplate,
    candidateTemplate,
  };
};

const buildReport = (params: {
  payload: EvaluateDeepGateCalibrationPayload;
  baselineTemplate: DeepGateThresholdTemplate;
  candidateTemplate: DeepGateThresholdTemplate;
  samples: CalibrationSample[];
  sampleSet: DeepGateCalibrationSampleSetRecord | null;
}): DeepGateCalibrationReportRecord => {
  const baselineSummary = buildEvaluationSummary({
    template: params.baselineTemplate,
    samples: params.samples,
  });
  const candidateSummary = buildEvaluationSummary({
    template: params.candidateTemplate,
    samples: params.samples,
  });
  const comparison = buildEvaluationComparison({
    baseline: baselineSummary,
    candidate: candidateSummary,
  });
  const nowIso = new Date().toISOString();

  return {
    id: randomUUID(),
    status: "evaluated",
    createdAt: nowIso,
    createdBy: params.payload.createdBy,
    reviewedBy: params.payload.reviewedBy,
    changeNote: params.payload.changeNote,
    sampleSize: params.samples.length,
    baselineTemplate: params.baselineTemplate,
    candidateTemplate: params.candidateTemplate,
    baselineSummary,
    candidateSummary,
    comparison,
    publishedVersion: null,
    sampleSetId: params.sampleSet?.id || null,
    replayTaskId: null,
    replayTaskStatus: null,
  };
};

const buildNextGovernance = (params: {
  governance: ReturnType<typeof readGovernanceState>["governance"];
  report: DeepGateCalibrationReportRecord;
  sampleSet: DeepGateCalibrationSampleSetRecord | null;
  appendSampleSet: boolean;
}) => {
  const nextReports = [params.report, ...params.governance.reports].slice(
    0,
    MAX_GOVERNANCE_HISTORY
  );
  const nextSampleSets =
    params.appendSampleSet && params.sampleSet
      ? [params.sampleSet, ...params.governance.sampleSets].slice(
          0,
          MAX_GOVERNANCE_HISTORY
        )
      : params.governance.sampleSets;
  const nowIso = params.report.createdAt;

  return {
    reports: nextReports,
    releases: params.governance.releases,
    sampleSets: nextSampleSets,
    activeVersion: params.governance.activeVersion,
    activeReleaseId: params.governance.activeReleaseId,
    updatedAt: nowIso,
    lastEvaluatedReportId: params.report.id,
  };
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
  const { baselineTemplate, candidateTemplate } = buildTemplates({
    payload,
    qualityCheckMetadata,
  });
  const { samples, sampleSet, appendSampleSet } = await resolveCalibrationSamples({
    governance,
    payload,
    bookId,
  });

  const report = buildReport({
    payload,
    baselineTemplate,
    candidateTemplate,
    samples,
    sampleSet,
  });

  let replayTaskId: string | null = null;
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

  const nextGovernance = buildNextGovernance({
    governance,
    report,
    sampleSet,
    appendSampleSet,
  });

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
