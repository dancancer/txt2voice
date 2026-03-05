// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/策略配置服务
// output: dispatchPolicy 配置响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  getDispatchPolicySettingsForBook,
  parseDispatchPolicyConfigPayload,
  parseDispatchPolicySettingsQuery,
  upsertDispatchPolicyConfig,
} from "@/lib/qc-dispatch-policy-config-service";

// GET /api/books/[id]/qc/dispatch-policy - 查询书籍策略配置与合并结果
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);
    const query = parseDispatchPolicySettingsQuery(searchParams);

    const data = await getDispatchPolicySettingsForBook({
      bookId,
      historyLimit: query.historyLimit,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  }
);

// PUT /api/books/[id]/qc/dispatch-policy - 更新 tenant/project/book 级策略
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseDispatchPolicyConfigPayload(body);

    const result = await upsertDispatchPolicyConfig({
      bookId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
