// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/请求体
// output: 复核处理结果/JSON 响应
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  parseManualReviewResolvePayload,
  resolveManualReviewItem,
} from "@/lib/manual-review-service";

// POST /api/books/[id]/review/items/[itemId]/resolve - 处理人工复核项
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
  ) => {
    const { id: bookId, itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseManualReviewResolvePayload(body);

    const result = await resolveManualReviewItem({
      bookId,
      itemId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
