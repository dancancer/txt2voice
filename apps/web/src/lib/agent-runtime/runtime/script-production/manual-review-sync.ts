import prisma from "@/lib/prisma";
import { resolveScriptValidationSubtype } from "@/lib/script-validation-review";
import type { SegmentFailureDetail } from "./types";

const MANUAL_REVIEW_ISSUE_TYPE = "SCRIPT_VALIDATION";
const MANUAL_REVIEW_HIGH_PRIORITY_CODES = new Set([
  "LOW_COVERAGE",
  "NON_WHITESPACE_GAP",
  "SOURCE_NOT_FOUND",
  "MISSING_SOURCE_TEXT",
]);

const toInputJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

const pickManualReviewPriority = (failure: SegmentFailureDetail) => {
  if (
    failure.errorCode === "QUALITY_MANUAL_REVIEW_REQUIRED" ||
    failure.errorCode === "SEGMENT_MANUAL_REVIEW_REQUIRED"
  ) {
    return "high";
  }

  if (
    failure.issueCodes.some((code) => MANUAL_REVIEW_HIGH_PRIORITY_CODES.has(code))
  ) {
    return "high";
  }

  return "normal";
};

export interface ManualReviewSyncResult {
  issueType: string;
  created: number;
  updated: number;
  pending: number;
  resolved: number;
}

export const syncRuntimeManualReviewItems = async (params: {
  taskId?: string;
  bookId: string;
  failures: SegmentFailureDetail[];
  processedSegmentIds: string[];
  failedSegmentIds: string[];
}): Promise<ManualReviewSyncResult> => {
  if (!params.taskId) {
    return {
      issueType: MANUAL_REVIEW_ISSUE_TYPE,
      created: 0,
      updated: 0,
      pending: 0,
      resolved: 0,
    };
  }

  let created = 0;
  let updated = 0;
  let resolved = 0;

  if (params.failures.length > 0) {
    await prisma.$transaction(async (tx: any) => {
      for (const failure of params.failures) {
        const scriptSubtype = resolveScriptValidationSubtype({
          errorCode: failure.errorCode,
          issueCodes: failure.issueCodes,
        });
        const issueDetail = {
          source: "script_generation",
          taskId: params.taskId,
          segmentId: failure.segmentId,
          chapterId: failure.chapterId,
          orderIndex: failure.orderIndex,
          stage: failure.stage,
          errorCode: failure.errorCode,
          message: failure.message,
          provider: failure.provider,
          retryable: failure.retryable,
          coverageRatio: failure.coverageRatio,
          issueCodes: failure.issueCodes,
          issueMessages: failure.issueMessages,
          issuePreviews: failure.issuePreviews,
          segmentPreview: failure.segmentPreview,
          segmentContent: failure.segmentContent || null,
          rawResponse: failure.rawResponse || null,
          structuredResult: failure.structuredResult || null,
          scriptSubtype,
        };
        const priority = pickManualReviewPriority(failure);

        const existing = await tx.manualReviewItem.findFirst({
          where: {
            bookId: params.bookId,
            issueType: MANUAL_REVIEW_ISSUE_TYPE,
            segmentId: failure.segmentId,
            status: {
              in: ["pending", "reprocessing"],
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          await tx.manualReviewItem.update({
            where: { id: existing.id },
            data: {
              status: "pending",
              priority,
              issueDetail: toInputJson(issueDetail),
              resolutionType: null,
              resolutionNote: null,
              resolvedAt: null,
            },
          });
          updated += 1;
          continue;
        }

        await tx.manualReviewItem.create({
          data: {
            bookId: params.bookId,
            chapterId: failure.chapterId,
            segmentId: failure.segmentId,
            issueType: MANUAL_REVIEW_ISSUE_TYPE,
            priority,
            status: "pending",
            issueDetail: toInputJson(issueDetail),
          },
        });
        created += 1;
      }
    });
  }

  const successfulSegmentIds = params.processedSegmentIds.filter(
    (segmentId) => segmentId && !params.failedSegmentIds.includes(segmentId)
  );

  if (successfulSegmentIds.length > 0) {
    const result = await prisma.manualReviewItem.updateMany({
      where: {
        bookId: params.bookId,
        issueType: MANUAL_REVIEW_ISSUE_TYPE,
        segmentId: {
          in: successfulSegmentIds,
        },
        status: {
          in: ["pending", "reprocessing"],
        },
      },
      data: {
        status: "resolved",
        resolutionType: "auto_resolved",
        resolutionNote: `script_generation_success:task=${params.taskId}`,
        resolvedAt: new Date(),
      },
    });

    resolved = typeof result.count === "number" ? result.count : 0;
  }

  return {
    issueType: MANUAL_REVIEW_ISSUE_TYPE,
    created,
    updated,
    pending: created + updated,
    resolved,
  };
};
