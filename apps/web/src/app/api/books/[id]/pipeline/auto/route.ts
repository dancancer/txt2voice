// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import { parseAutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAutoPipelineJob } from "@/lib/task-queue";

const PIPELINE_STAGE_TASK_TYPES = [
  "TEXT_PROCESSING",
  "SCRIPT_GENERATION",
  "AUDIO_GENERATION",
  "QUALITY_CHECK",
] as const;

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const options = parseAutoPipelineOptions(body?.options);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        status: true,
        uploadedFilePath: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    if (!book.uploadedFilePath) {
      throw new ValidationError("请先上传文本文件");
    }

    const [existingAutoPipelineTask, existingStageTask] = await Promise.all([
      prisma.processingTask.findFirst({
        where: {
          bookId,
          taskType: "AUTO_PIPELINE",
          status: "processing",
        },
        select: { id: true },
      }),
      prisma.processingTask.findFirst({
        where: {
          bookId,
          taskType: {
            in: [...PIPELINE_STAGE_TASK_TYPES],
          },
          status: "processing",
        },
        select: { id: true, taskType: true },
      }),
    ]);

    if (existingAutoPipelineTask) {
      throw new ValidationError("自动编排任务正在执行中，请稍后");
    }

    if (existingStageTask) {
      throw new ValidationError(
        `当前存在执行中的${existingStageTask.taskType}任务，请稍后重试`
      );
    }

    const qualityCheckEnabled = options.qualityCheck?.enabled !== false;
    const totalStages = qualityCheckEnabled ? 4 : 3;
    const optionsJson = JSON.parse(JSON.stringify(options || {}));

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "AUTO_PIPELINE",
        status: "processing",
        progress: 0,
        totalItems: totalStages,
        taskData: {
          message: "Auto Pipeline 任务已创建",
          metadata: {
            source: "auto_pipeline",
            currentStage: "init",
            totalStages,
            options: optionsJson,
          },
        },
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "processing",
      },
    });

    try {
      await enqueueAutoPipelineJob(
        {
          taskId: task.id,
          bookId,
          options,
        },
        {
          reason: "pipeline_auto_api",
        }
      );
    } catch (queueError) {
      const message =
        queueError instanceof Error ? queueError.message : "自动编排任务入队失败";
      const failedTaskData = await mergeTaskData(task.id, {
        message: "Auto Pipeline 入队失败",
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

      await prisma.book.update({
        where: { id: bookId },
        data: {
          status: book.status,
        },
      });

      throw queueError;
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        message: "Auto Pipeline 任务已启动",
        bookStatus: "processing",
        totalStages,
        qualityCheckEnabled,
      },
    });
  }
);
