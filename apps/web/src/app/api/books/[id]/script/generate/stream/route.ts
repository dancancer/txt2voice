// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import { formatProcessingTask } from "@/lib/processing-task-utils";
import { normalizeScriptGenerationRuntimeEvents } from "@/lib/script-generation/runner/runtime-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) {
      throw new ValidationError("缺少任务ID");
    }

    const { id: bookId } = await params;
    const encoder = new TextEncoder();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let lastSnapshotKey = "";
    let lastRuntimeEventSeq = 0;

    const stream = new ReadableStream({
      start(controller) {
        const close = () => {
          if (stopped) return;
          stopped = true;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          controller.close();
        };

        const send = (event: string, payload: unknown) => {
          if (stopped) return;
          controller.enqueue(
            encoder.encode(
              `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`
            )
          );
        };

        const sendSnapshot = (payload: Record<string, unknown>) => {
          const snapshotKey = JSON.stringify(payload);
          if (snapshotKey === lastSnapshotKey) {
            return;
          }
          lastSnapshotKey = snapshotKey;
          send("task_snapshot", payload);
          send("message", payload);
        };

        const tick = async () => {
          try {
            const task = await prisma.processingTask.findFirst({
              where: {
                id: taskId,
                bookId,
                taskType: "SCRIPT_GENERATION",
              },
            });

            if (!task) {
              send("error", {
                status: "not_found",
                progress: 0,
                message: "任务不存在",
              });
              close();
              return;
            }

            const formatted = formatProcessingTask(task);
            const runtimeEvents = normalizeScriptGenerationRuntimeEvents(
              formatted.metadata?.recentRuntimeEvents
            );
            const unseenEvents = runtimeEvents.filter(
              (event) => event.seq > lastRuntimeEventSeq
            );

            for (const event of unseenEvents) {
              send("runtime_event", event);
              lastRuntimeEventSeq = Math.max(lastRuntimeEventSeq, event.seq);
            }

            sendSnapshot({
              taskId: formatted.id,
              status: formatted.status,
              progress: formatted.progress ?? 0,
              message: formatted.message,
              metadata: formatted.metadata,
              error: formatted.error,
              lastRuntimeEventSeq,
            });

            if (
              formatted.status === "completed" ||
              formatted.status === "failed" ||
              formatted.status === "canceled"
            ) {
              close();
            }
          } catch (error) {
            send("error", {
              status: "failed",
              progress: 0,
              message: "获取任务状态失败",
            });
            close();
          }
        };

        const handleAbort = () => close();
        request.signal.addEventListener("abort", handleAbort);

        controller.enqueue(encoder.encode(": connected\n\n"));
        intervalId = setInterval(tick, 1000);
        tick();
      },
      cancel() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        stopped = true;
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
);
