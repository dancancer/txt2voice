// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/告警事件服务
// output: 告警事件列表/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  listQcDispatchAlertEvents,
  parseQcDispatchAlertEventListQuery,
} from "@/lib/qc-dispatch-alert-event-service";

// GET /api/books/[id]/qc/dispatch-events - 查询告警事件列表
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const { searchParams } = new URL(request.url);
    const query = parseQcDispatchAlertEventListQuery(searchParams);
    const result = await listQcDispatchAlertEvents({
      bookId,
      query,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  }
);
