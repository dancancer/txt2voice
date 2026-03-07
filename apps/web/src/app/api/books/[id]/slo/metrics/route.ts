// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/SLO 服务依赖
// output: 核心 SLO 指标响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { parseBookSloMetricsQuery } from "@/lib/slo-metrics/query";
import { getBookSloMetrics } from "@/lib/slo-metrics/service";

// GET /api/books/[id]/slo/metrics - 查询书籍级核心 SLO 指标
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const query = parseBookSloMetricsQuery(searchParams);
    const metrics = await getBookSloMetrics({
      bookId,
      query,
    });

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  }
);
