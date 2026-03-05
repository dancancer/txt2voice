// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/请求体
// output: 告警事件生命周期处理结果
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  parseQcDispatchAlertEventResolvePayload,
  resolveQcDispatchAlertEvent,
} from "@/lib/qc-dispatch-alert-event-service";

// POST /api/books/[id]/qc/dispatch-events/[eventId]/resolve - ack/resolve 告警事件
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; eventId: string }> }
  ) => {
    const { id: bookId, eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = parseQcDispatchAlertEventResolvePayload(body);

    const result = await resolveQcDispatchAlertEvent({
      bookId,
      eventId,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
