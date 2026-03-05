// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/回滚策略请求
// output: dispatchPolicy 回滚结果/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  parseRollbackDispatchPolicyPayload,
  rollbackDispatchPolicyConfig,
} from "@/lib/qc-dispatch-policy-config-service";

// POST /api/books/[id]/qc/dispatch-policy/rollback - 回滚到指定版本
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseRollbackDispatchPolicyPayload(body);

    const result = await rollbackDispatchPolicyConfig({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
