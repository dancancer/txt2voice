// 一旦我被更新，请更新我的开头注释
// input: 补偿任务参数/自动编排触发服务
// output: 上传自动触发补偿执行结果
// pos: 自动触发补偿执行器
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import {
  buildAutoPipelineBookMetadata,
  readAutoPipelineCompensationTaskId,
} from "@/lib/auto-pipeline-trigger-metadata";
import {
  startAutoPipelineTask,
} from "@/lib/auto-pipeline-trigger-service";
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";

export interface AutoPipelineCompensationRunParams {
  taskId: string;
  bookId: string;
  options?: AutoPipelineOptions;
  triggerSource?: string;
  triggerMetadata?: Record<string, unknown>;
  allowReuseRunningTask?: boolean;
}

const markCompensationTaskCompleted = async ({
  taskId,
  message,
  metadata,
}: {
  taskId: string;
  message: string;
  metadata: Record<string, unknown>;
}) => {
  const taskData = await mergeTaskData(taskId, {
    message,
    metadata,
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: 1,
      completedAt: new Date(),
      taskData,
    },
  });
};

export async function runAutoPipelineCompensationTask({
  taskId,
  bookId,
  options = {},
  triggerSource = "upload_compensation",
  triggerMetadata = {},
  allowReuseRunningTask = true,
}: AutoPipelineCompensationRunParams): Promise<void> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      metadata: true,
    },
  });

  const currentCompensationTaskId = readAutoPipelineCompensationTaskId(book?.metadata);
  if (currentCompensationTaskId && currentCompensationTaskId !== taskId) {
    await markCompensationTaskCompleted({
      taskId,
      message: "上传补偿任务已被更新的上传请求替代",
      metadata: {
        source: "upload_compensation",
        compensationStatus: "superseded",
        supersededByTaskId: currentCompensationTaskId,
        completedAt: new Date().toISOString(),
      },
    });
    return;
  }

  if (book) {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        metadata: buildAutoPipelineBookMetadata({
          metadata: book.metadata,
          compensation: {
            taskId,
            status: "processing",
            triggerSource,
            triggerMetadata,
            startedAt: new Date().toISOString(),
          },
        }),
      },
    });
  }

  const result = await startAutoPipelineTask({
    bookId,
    options,
    triggerSource,
    triggerMetadata: {
      ...triggerMetadata,
      compensationTaskId: taskId,
    },
    allowReuseRunningTask,
  });

  const freshBook = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      metadata: true,
    },
  });
  await markCompensationTaskCompleted({
    taskId,
    message: result.reused ? "上传补偿已复用现有自动编排任务" : "上传补偿已重新触发自动编排",
    metadata: {
      source: "upload_compensation",
      compensationStatus: "completed",
      linkedTaskId: result.taskId,
      linkedTaskReused: result.reused,
      completedAt: new Date().toISOString(),
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: buildAutoPipelineBookMetadata({
        metadata: freshBook?.metadata,
        compensation: {
          taskId,
          status: "completed",
          triggerSource,
          triggerMetadata,
          linkedTaskId: result.taskId,
          reused: result.reused,
          completedAt: new Date().toISOString(),
          lastError: null,
        },
      }),
    },
  });
}
