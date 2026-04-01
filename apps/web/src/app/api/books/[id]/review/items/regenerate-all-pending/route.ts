// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数
// output: 全量待复核重生结果
// pos: review 全量重生路由
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { regenerateAllPendingManualReviewItems } from "@/lib/manual-review-service";

// POST /api/books/[id]/review/items/regenerate-all-pending - 重生全部待复核项
export const POST = withErrorHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;

    const result = await regenerateAllPendingManualReviewItems({
      bookId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
