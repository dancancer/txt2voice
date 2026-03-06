// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/请求体
// output: 批量复核处理结果
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  parseManualReviewBatchResolvePayload,
  resolveManualReviewItemsInBatch,
} from "@/lib/manual-review-service";

// POST /api/books/[id]/review/items/batch-resolve - 批量处理人工复核项
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseManualReviewBatchResolvePayload(body);

    const result = await resolveManualReviewItemsInBatch({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
