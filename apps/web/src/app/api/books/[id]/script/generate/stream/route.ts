import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import { formatProcessingTask } from "@/lib/processing-task-utils";

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

        const send = (event: string, payload: Record<string, unknown>) => {
          if (stopped) return;
          controller.enqueue(
            encoder.encode(
              `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`
            )
          );
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
            send("message", {
              taskId: formatted.id,
              status: formatted.status,
              progress: formatted.progress ?? 0,
              message: formatted.message,
              metadata: formatted.metadata,
              error: formatted.error,
            });

            if (formatted.status === "completed" || formatted.status === "failed") {
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

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
);
