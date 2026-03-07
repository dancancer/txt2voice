// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/基线服务
// output: 质量基线查询与固化响应
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  captureQualityBaselineForBook,
  getQualityBaselineStateForBook,
  parseCaptureQualityBaselinePayload,
} from "@/lib/qc-baseline-service";

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId") || undefined;

    const result = await getQualityBaselineStateForBook({
      bookId,
      taskId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseCaptureQualityBaselinePayload(body);

    const result = await captureQualityBaselineForBook({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
