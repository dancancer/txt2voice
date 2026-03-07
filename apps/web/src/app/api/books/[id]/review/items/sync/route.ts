// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/队列依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { ensureTaskWorkerStarted } from "@/lib/task-queue";

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? {}))

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const autoTriggerFinalAssembly = body.autoTriggerFinalAssembly !== false;
    const finalAssembly = asRecord(body.finalAssembly) || { type: "book", options: {} };

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const existingTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "MANUAL_REVIEW_SYNC",
        status: "processing",
      },
      select: { id: true },
    });

    if (existingTask) {
      throw new ValidationError("复核同步任务正在执行中，请稍后");
    }

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "MANUAL_REVIEW_SYNC",
        status: "processing",
        progress: 0,
        totalItems: 1,
        taskData: toJson({
          message: "复核同步任务已创建",
          metadata: {
            source: "manual_review_sync",
            previousBookStatus: book.status,
            autoTriggerFinalAssembly,
            finalAssembly,
          },
        }),
      },
    });

    try {
      await ensureTaskWorkerStarted()
      await enqueueAutoPipelineJobInternal(
        {
          taskId: task.id,
          bookId,
          mode: "manual_review_sync",
          workflowPayload: {
            source: "manual_review_sync",
            previousBookStatus: book.status,
            autoTriggerFinalAssembly,
            finalAssembly,
          },
        },
        {
          allowReuse: false,
          reason: "manual_review_sync_api",
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "复核同步任务入队失败";
      const failedTaskData = await mergeTaskData(task.id, {
        message: "复核同步任务入队失败",
        metadata: {
          queueError: message,
        },
      });

      await prisma.processingTask.update({
        where: { id: task.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
          taskData: failedTaskData,
        },
      });

      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskType: "MANUAL_REVIEW_SYNC",
        autoTriggerFinalAssembly,
        message: "复核同步任务已启动",
      },
    });
  }
);
