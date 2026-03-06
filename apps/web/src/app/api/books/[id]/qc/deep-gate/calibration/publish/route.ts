// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/阈值治理服务
// output: 阈值发布响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  parsePublishDeepGateCalibrationPayload,
  publishDeepGateCalibrationForBook,
} from "@/lib/deep-gate-calibration-governance-service";

// POST /api/books/[id]/qc/deep-gate/calibration/publish - 发布阈值版本
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parsePublishDeepGateCalibrationPayload(body);

    const result = await publishDeepGateCalibrationForBook({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

