// 一旦我被更新，请更新我的开头注释
// input: script generate 请求上下文
// output: route 辅助逻辑
// pos: API 路由处理器
import { ValidationError } from "@/lib/error-handler";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";

export function assertScriptGenerationAllowed(status: string) {
  const allowedStatuses = [
    "processed",
    "manual_review_pending",
    "script_generated",
    "completed",
    "completed_with_errors",
  ];
  if (!allowedStatuses.includes(status)) {
    throw new ValidationError("请先完成文本处理");
  }
}

export async function assertNoBlockingManualReview(params: {
  status: string;
  findBlockingReview: () => Promise<{ id: string } | null>;
}) {
  if (params.status !== "manual_review_pending") {
    return;
  }
  const blockingReviewItem = await params.findBlockingReview();
  if (blockingReviewItem) {
    throw new ValidationError(
      "当前仍存在非台本校验复核项，请先完成相关复核后再重跑台本"
    );
  }
}

export function resolveStartSegmentOrder(params: {
  startFromSegmentId: string | null;
  textSegments: Array<{ id: string; orderIndex: number }>;
}) {
  if (!params.startFromSegmentId) {
    return null;
  }
  const startSegment = params.textSegments.find(
    (seg) => seg.id === params.startFromSegmentId
  );
  if (!startSegment) {
    throw new ValidationError("指定的起始段落不存在");
  }
  return startSegment.orderIndex;
}

export function buildScriptGenerationTaskData(params: {
  startFromSegmentId: string | null;
  startFromOrderIndex: number | null;
  regenerateSegments: boolean;
  limitToSegments?: number;
  previousBookStatus: string;
}) {
  const taskData: Record<string, unknown> = {
    message: params.startFromSegmentId
      ? "从指定段落开始生成台本"
      : "开始生成朗读台本",
    regenerateSegments: params.regenerateSegments,
    limitToSegments:
      typeof params.limitToSegments === "number" ? params.limitToSegments : null,
    metadata: {
      previousBookStatus: params.previousBookStatus,
    },
  };

  if (params.startFromSegmentId) {
    taskData.startFromSegmentId = params.startFromSegmentId;
    taskData.startFromOrderIndex = params.startFromOrderIndex;
  }

  return taskData;
}

export function buildSegmentStatusPayload(params: {
  textSegments: Array<{ id: string; orderIndex: number; content: string }>;
  scriptSentences: Array<{ segmentId: string; createdAt: Date | string }>;
}) {
  const items = params.textSegments.map((segment) => {
    const segmentSentences = params.scriptSentences.filter(
      (sentence) => sentence.segmentId === segment.id
    );

    return {
      id: segment.id,
      orderIndex: segment.orderIndex,
      content: segment.content.substring(0, 100) + "...",
      wordCount: segment.content.length,
      processed: segmentSentences.length > 0,
      lineCount: segmentSentences.length,
      firstGeneratedAt:
        segmentSentences.length > 0
          ? new Date(
              Math.min(
                ...segmentSentences.map((s) => new Date(s.createdAt).getTime())
              )
            )
          : null,
      lastGeneratedAt:
        segmentSentences.length > 0
          ? new Date(
              Math.max(
                ...segmentSentences.map((s) => new Date(s.createdAt).getTime())
              )
            )
          : null,
    };
  });

  const processedSegments = items.filter((seg) => seg.processed).length;
  return {
    items,
    summary: {
      total: params.textSegments.length,
      processed: processedSegments,
      unprocessed: params.textSegments.length - processedSegments,
      processedPercentage: Math.round(
        (processedSegments / params.textSegments.length) * 100
      ),
    },
  };
}

export const SCRIPT_VALIDATION_BLOCK_ISSUE_TYPE = SCRIPT_VALIDATION_ISSUE_TYPE;
