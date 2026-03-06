// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/阈值治理 payload
// output: 评估报告与发布/回滚结果
// pos: 阈值治理服务实现
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { DEFAULT_DEEP_GATE_TEMPLATE } from "@/lib/quality-gate/types";
import {
  buildEvaluationComparison,
  buildEvaluationSummary,
  parseQualityResultSample,
} from "@/lib/deep-gate-calibration-governance/evaluation";
import {
  buildRecommendationTemplate,
  normalizeTemplate,
  readGovernanceState,
  toInputJsonValue,
} from "@/lib/deep-gate-calibration-governance/parsers";
import {
  DeepGateCalibrationReportRecord,
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
      verdict: true,
      metrics: true,
      detail: true,
    },
  });

  return qualityResults
    .map((item) => parseQualityResultSample(item))
    .filter((sample): sample is NonNullable<typeof sample> => Boolean(sample));
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

  const samples =
    payload.samples ||
    (await loadCalibrationSamplesFromQualityResults({
      bookId,
      sampleLimit: payload.sampleLimit,
    }));

  if (samples.length === 0) {
    throw new ValidationError("没有可用于离线评估的样本");
  }

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
  };

  const nextReports = [report, ...governance.reports].slice(0, MAX_GOVERNANCE_HISTORY);
  const nextGovernance = {
    reports: nextReports,
    releases: governance.releases,
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
            activeVersion: nextVersion,
            activeReleaseId: release.id,
            updatedAt: nowIso,
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
            activeVersion: nextVersion,
            activeReleaseId: release.id,
            updatedAt: nowIso,
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
