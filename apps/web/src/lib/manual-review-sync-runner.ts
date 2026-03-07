// 一旦我被更新，请更新我的开头注释
// input: 复核同步任务参数/队列依赖
// output: 复核状态归集与可选交付触发结果
// pos: S31 复核同步执行器
import prisma from "@/lib/prisma";
import { jsonObject, mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from "@/lib/processing-task-utils";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";

export interface ManualReviewSyncRunParams {
  taskId: string;
  bookId: string;
  autoTriggerFinalAssembly?: boolean;
  finalAssemblyPayload?: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? {}));

export async function runManualReviewSyncTask({
  taskId,
  bookId,
  autoTriggerFinalAssembly = false,
  finalAssemblyPayload = {},
}: ManualReviewSyncRunParams): Promise<void> {
  await updateTaskProgress(taskId, 10, "开始归集复核状态");

  const [book, pendingCount, reprocessingCount, resolvedCount, rejectedCount] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        metadata: true,
        status: true,
      },
    }),
    prisma.manualReviewItem.count({ where: { bookId, status: "pending" } }),
    prisma.manualReviewItem.count({ where: { bookId, status: "reprocessing" } }),
    prisma.manualReviewItem.count({ where: { bookId, status: "resolved" } }),
    prisma.manualReviewItem.count({ where: { bookId, status: "rejected" } }),
  ]);

  const readyForAssembly = pendingCount === 0 && reprocessingCount === 0;
  let finalAssemblyTaskId: string | null = null;

  if (readyForAssembly && autoTriggerFinalAssembly) {
    const payload = asRecord(finalAssemblyPayload) || {};
    const existingFinalAssemblyTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "FINAL_ASSEMBLY",
        status: "processing",
      },
      select: {
        id: true,
      },
    });

    if (existingFinalAssemblyTask) {
      finalAssemblyTaskId = existingFinalAssemblyTask.id;
    } else {
      const finalTask = await prisma.processingTask.create({
        data: {
          bookId,
          taskType: "FINAL_ASSEMBLY",
          status: "processing",
          progress: 0,
          totalItems: 1,
          taskData: {
            message: "复核同步后自动触发最终合并",
            metadata: {
              source: "final_assembly",
              previousBookStatus: book?.status || "completed",
              parentManualReviewSyncTaskId: taskId,
              ...payload,
            },
          },
        },
      });
      finalAssemblyTaskId = finalTask.id;

      await enqueueAutoPipelineJobInternal(
        {
          taskId: finalTask.id,
          bookId,
          mode: "final_assembly",
          workflowPayload: {
            source: "final_assembly",
            previousBookStatus: book?.status || "completed",
            parentManualReviewSyncTaskId: taskId,
            ...payload,
          },
        },
        {
          allowReuse: false,
          reason: "manual_review_sync",
        }
      );
    }
  }

  await updateTaskProgress(taskId, 100, "复核状态同步完成");

  const taskData = await mergeTaskData(taskId, {
    message: readyForAssembly ? "复核状态已收敛" : "复核状态已同步",
    metadata: {
      source: "manual_review_sync",
      pendingCount,
      reprocessingCount,
      resolvedCount,
      rejectedCount,
      readyForAssembly,
      autoTriggerFinalAssembly,
      finalAssemblyTaskId,
      completedAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: pendingCount + reprocessingCount + resolvedCount + rejectedCount,
      completedAt: new Date(),
      taskData,
    },
  });

  const rootMetadata = jsonObject(book?.metadata);
  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: readyForAssembly
        ? autoTriggerFinalAssembly
          ? "assembling_audio"
          : book?.status || "completed"
        : "manual_review_pending",
      metadata: toJson({
        ...rootMetadata,
        manualReviewSync: {
          taskId,
          pendingCount,
          reprocessingCount,
          resolvedCount,
          rejectedCount,
          readyForAssembly,
          autoTriggerFinalAssembly,
          finalAssemblyTaskId,
          completedAt: new Date().toISOString(),
        },
      }),
    },
  });
}
