// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/告警扫描服务
// output: 扫描执行结果/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  parseQcDispatchAlertScanQuery,
  scanQcDispatchAlertsForBook,
} from "@/lib/qc-dispatch-alert-event-service";

// POST /api/books/[id]/qc/dispatch-alerts/scan - 手动触发单书告警扫描
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const { searchParams } = new URL(request.url);
    const query = parseQcDispatchAlertScanQuery(searchParams);
    const triggeredBy = request.headers.get("x-operator") || "manual_scan_api";

    const result = await scanQcDispatchAlertsForBook({
      bookId,
      query,
      triggeredBy,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
