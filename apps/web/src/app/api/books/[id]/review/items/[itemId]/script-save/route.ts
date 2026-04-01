// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/结构化台本结果
// output: 人工修订保存结果
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import { saveManualReviewScriptEdit } from "@/lib/manual-review-service";

const parseBody = (body: unknown): { structuredResult: Record<string, unknown> } => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("请求体格式错误");
  }

  const structuredResult =
    "structuredResult" in body &&
    body.structuredResult &&
    typeof body.structuredResult === "object" &&
    !Array.isArray(body.structuredResult)
      ? (body.structuredResult as Record<string, unknown>)
      : null;

  if (!structuredResult) {
    throw new ValidationError("structuredResult 必填，且必须是对象");
  }

  return {
    structuredResult,
  };
};

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
  ) => {
    const { id: bookId, itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseBody(body);

    const result = await saveManualReviewScriptEdit({
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
