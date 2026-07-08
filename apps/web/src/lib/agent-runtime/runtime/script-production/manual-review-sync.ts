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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

const toIssueCodeFingerprint = (issueCodes: string[]): string =>
  [...new Set(issueCodes)].sort().join("|");

const buildFailureSignature = (params: {
  scriptSubtype: string;
  errorCode: string;
  issueCodes: string[];
}) =>
  [
    params.scriptSubtype.trim(),
    params.errorCode.trim(),
    toIssueCodeFingerprint(params.issueCodes),
  ].join("::");

const readReviewItemSignature = (issueDetail: unknown): string | null => {
  const detail = asRecord(issueDetail);
  const scriptSubtype =
    typeof detail?.scriptSubtype === "string" ? detail.scriptSubtype.trim() : "";
  const errorCode =
    typeof detail?.errorCode === "string" ? detail.errorCode.trim() : "";

  if (!scriptSubtype || !errorCode) {
    return null;
  }

  return buildFailureSignature({
    scriptSubtype,
    errorCode,
    issueCodes: asStringArray(detail?.issueCodes),
  });
};

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
  let created = 0;
  let updated = 0;
  let resolved = 0;

  if (params.failures.length > 0) {
    await prisma.$transaction(async (tx: any) => {
      const segmentIds = [...new Set(params.failures.map((failure) => failure.segmentId))];
      const existingItems = await tx.manualReviewItem.findMany({
        where: {
          bookId: params.bookId,
          issueType: MANUAL_REVIEW_ISSUE_TYPE,
          segmentId: {
            in: segmentIds,
          },
          status: {
            in: ["pending", "reprocessing"],
          },
        },
        select: {
          id: true,
          segmentId: true,
          issueDetail: true,
        },
      });
      const existingItemBySegmentAndSignature = new Map<string, { id: string }>();

      for (const item of existingItems) {
        const signature = readReviewItemSignature(item.issueDetail);
        if (!signature || typeof item.segmentId !== "string") {
          continue;
        }

        existingItemBySegmentAndSignature.set(
          `${item.segmentId}::${signature}`,
          { id: item.id }
        );
      }

      for (const failure of params.failures) {
        const scriptSubtype = resolveScriptValidationSubtype({
          errorCode: failure.errorCode,
          issueCodes: failure.issueCodes,
        });
        const signature = buildFailureSignature({
          scriptSubtype,
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
        const existing = existingItemBySegmentAndSignature.get(
          `${failure.segmentId}::${signature}`
        );

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
        existingItemBySegmentAndSignature.set(
          `${failure.segmentId}::${signature}`,
          {
            id: `created::${failure.segmentId}::${signature}`,
          }
        );
        created += 1;
      }
    });
  }
  const pendingItems = await prisma.manualReviewItem.findMany({
    where: {
      bookId: params.bookId,
      issueType: MANUAL_REVIEW_ISSUE_TYPE,
      status: {
        in: ["pending", "reprocessing"],
      },
    },
    select: {
      id: true,
    },
  });

  return {
    issueType: MANUAL_REVIEW_ISSUE_TYPE,
    created,
    updated,
    pending: pendingItems.length,
    resolved,
  };
};
