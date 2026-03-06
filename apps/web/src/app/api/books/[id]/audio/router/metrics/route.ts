// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getAudioRouterMetrics,
  parseAudioRouterMetricsQuery,
} from "@/lib/audio-router-metrics-service";

// GET /api/books/[id]/audio/router/metrics - 获取路由命中与降级指标
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const query = parseAudioRouterMetricsQuery(request.nextUrl.searchParams);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const metrics = await getAudioRouterMetrics({
      bookId,
      query,
    });

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  }
);
