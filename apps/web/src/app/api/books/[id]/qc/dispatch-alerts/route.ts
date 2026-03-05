// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/告警服务依赖
// output: 派单告警响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getQcDispatchAlerts,
  parseQcDispatchAlertQuery,
} from "@/lib/qc-dispatch-alert-service";

// GET /api/books/[id]/qc/dispatch-alerts - 查询派单异常告警
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const query = parseQcDispatchAlertQuery(searchParams);
    const alerts = await getQcDispatchAlerts({
      bookId,
      query,
    });

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  }
);
