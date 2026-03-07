// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/信号生产任务服务
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma, { Prisma } from "@/lib/prisma";
import { formatProcessingTask, mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueQualitySignalSyncJob } from "@/lib/task-queue";
import type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync-runner";

const isTaskType = (value: unknown): value is QualitySignalSyncTaskType => {
  return value === "book" || value === "chapter" || value === "batch";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const type = isTaskType(body.type) ? body.type : "book";
    const chapterId = typeof body.chapterId === "string" ? body.chapterId : undefined;
    const audioFileIds = Array.isArray(body.audioFileIds)
      ? body.audioFileIds.filter((item: unknown): item is string => typeof item === "string")
      : undefined;
    const forceResync = body.forceResync === true;
    const signalPayloadByAudioFileId = asRecord(body.signalPayloadByAudioFileId);
    const signalPayloadBySentenceId = asRecord(body.signalPayloadBySentenceId);

    const existingTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "QUALITY_SIGNAL_SYNC",
        status: "processing",
      },
      select: { id: true },
    });

    if (existingTask) {
      throw new ValidationError("信号生产任务正在执行中，请稍后");
    }

    const totalItems = await prisma.audioFile.count({
      where: {
        bookId,
        status: "completed",
        ...(type === "chapter" && chapterId ? { chapterId } : {}),
        ...(type === "batch" && audioFileIds?.length ? { id: { in: audioFileIds } } : {}),
      },
    });

    if (totalItems === 0) {
      throw new ValidationError("没有可执行信号生产的音频");
    }

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "QUALITY_SIGNAL_SYNC",
        status: "processing",
        progress: 0,
        totalItems,
        taskData: toJson({
          message: "Q0-Q3 信号生产任务已创建",
          metadata: {
            source: "quality_signal_sync",
            type,
            chapterId: chapterId || null,
            audioFileIds: audioFileIds || [],
            totalItems,
            forceResync,
            signalPayloadByAudioFileId: signalPayloadByAudioFileId || {},
            signalPayloadBySentenceId: signalPayloadBySentenceId || {},
          },
        }),
      },
    });

    try {
      await enqueueQualitySignalSyncJob(
        {
          taskId: task.id,
          bookId,
          type,
          chapterId,
          audioFileIds,
          forceResync,
        },
        {
          reason: "qc_signal_sync_api",
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "信号生产任务入队失败";
      const taskData = await mergeTaskData(task.id, {
        message: "Q0-Q3 信号生产任务入队失败",
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
          taskData,
        },
      });

      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        type,
        totalItems,
        forceResync,
        message: "Q0-Q3 信号生产任务已启动",
      },
    });
  }
);

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const latestTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "QUALITY_SIGNAL_SYNC",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        latestTask: latestTask ? formatProcessingTask(latestTask) : null,
      },
    });
  }
);
