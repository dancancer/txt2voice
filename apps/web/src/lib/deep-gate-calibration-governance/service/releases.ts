// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/发布或回滚 payload
// output: 阈值版本发布与回滚结果
// pos: 阈值治理服务实现
import { randomUUID } from "crypto";

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { readGovernanceState, toInputJsonValue } from "@/lib/deep-gate-calibration-governance/parsers";
import type {
  DeepGateThresholdReleaseRecord,
  PublishDeepGateCalibrationPayload,
  RollbackDeepGateCalibrationPayload,
} from "@/lib/deep-gate-calibration-governance/types";

const assertExpectedVersion = (params: {
  expectedVersion: number | null;
  activeVersion: number;
}) => {
  if (
    params.expectedVersion !== null &&
    params.expectedVersion !== params.activeVersion
  ) {
    throw new ValidationError(
      `expectedVersion=${params.expectedVersion} 与当前版本 ${params.activeVersion} 不一致`
    );
  }
};

const buildReleaseRecord = (params: {
  version: number;
  changeType: "publish" | "rollback";
  reportId: string | null;
  template: DeepGateThresholdReleaseRecord["template"];
  operator: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
  previousVersion: number | null;
  rollbackTargetVersion: number | null;
}): DeepGateThresholdReleaseRecord => ({
  id: randomUUID(),
  version: params.version,
  status: "active",
  changeType: params.changeType,
  reportId: params.reportId,
  template: params.template,
  createdAt: new Date().toISOString(),
  publishedBy: params.operator,
  reviewedBy: params.reviewedBy,
  changeNote: params.changeNote,
  previousVersion: params.previousVersion,
  rollbackTargetVersion: params.rollbackTargetVersion,
});

const buildNextReleases = (
  governance: ReturnType<typeof readGovernanceState>["governance"],
  release: DeepGateThresholdReleaseRecord
) =>
  [release, ...governance.releases].map((item) => ({
    ...item,
    status: item.id === release.id ? "active" : "superseded",
  }));

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
  assertExpectedVersion({
    expectedVersion: payload.expectedVersion,
    activeVersion: governance.activeVersion,
  });
  if (report.status === "published" && report.publishedVersion !== null) {
    throw new ValidationError(`该评估报告已发布为版本 v${report.publishedVersion}`);
  }

  const nextVersion = governance.activeVersion + 1;
  const release = buildReleaseRecord({
    version: nextVersion,
    changeType: "publish",
    reportId: report.id,
    template: report.candidateTemplate,
    operator: payload.publishedBy,
    reviewedBy: payload.reviewedBy,
    changeNote: payload.changeNote,
    previousVersion: governance.activeVersion > 0 ? governance.activeVersion : null,
    rollbackTargetVersion: null,
  });

  const nextReleases = buildNextReleases(governance, release);
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
            updatedAt: release.createdAt,
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
  assertExpectedVersion({
    expectedVersion: payload.expectedVersion,
    activeVersion: governance.activeVersion,
  });

  const nextVersion = governance.activeVersion + 1;
  const release = buildReleaseRecord({
    version: nextVersion,
    changeType: "rollback",
    reportId: targetRelease.reportId,
    template: targetRelease.template,
    operator: payload.rolledBackBy,
    reviewedBy: payload.reviewedBy,
    changeNote: payload.changeNote,
    previousVersion: governance.activeVersion > 0 ? governance.activeVersion : null,
    rollbackTargetVersion: payload.targetVersion,
  });

  const nextReleases = buildNextReleases(governance, release);

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
            updatedAt: release.createdAt,
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
