// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  parseQualityRetryPayload,
  retryQualityIssues,
} from "@/lib/qc-retry-service";

// POST /api/books/[id]/qc/retry - 按质检问题批量返工
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseQualityRetryPayload(body);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const result = await retryQualityIssues({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
