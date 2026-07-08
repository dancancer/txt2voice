// 一旦我被更新，请更新我的开头注释
// input: 自动编排阶段参数
// output: 阶段任务与文本处理执行工具
// pos: 自动编排阶段模块
import { readFile } from "fs/promises";
import prisma from "@/lib/prisma";
import {
  jsonMetadata,
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import {
  CANCELED_TASK_STATUS,
  TaskCanceledError,
  throwIfTaskCanceled,
} from "@/lib/task-cancellation";
import {
  createChapterSegmentRecords,
  processFileContent,
  type TextProcessingOptions,
} from "@/lib/text-processor";
import {
  AUTO_PIPELINE_STAGE_ORDER,
  STAGE_LABEL,
  toInputJsonValue,
  type AutoPipelineOptions,
  type AutoPipelineStage,
  type AutoPipelineStageState,
} from "./common";

export const updateTaskFailureIfNeeded = async (
  taskId: string,
  message: string,
  stage: AutoPipelineStage
): Promise<void> => {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      status: true,
    },
  });

  if (!task || task.status === "failed") {
    return;
  }

  if (task.status === CANCELED_TASK_STATUS) {
    return;
  }

  const failedTaskData = await mergeTaskData(taskId, {
    message: `${STAGE_LABEL[stage]}失败`,
    metadata: {
      stage,
      stageError: message,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      taskData: failedTaskData,
    },
  });
};

export const ensureStageCompleted = async (
  stageTaskId: string,
  stage: AutoPipelineStage
): Promise<void> => {
  const stageTask = await prisma.processingTask.findUnique({
    where: { id: stageTaskId },
    select: {
      status: true,
      errorMessage: true,
    },
  });

  if (!stageTask) {
    throw new Error(`${STAGE_LABEL[stage]}子任务不存在`);
  }

  if (stageTask.status !== "completed") {
    if (stageTask.status === CANCELED_TASK_STATUS) {
      throw new TaskCanceledError(stageTaskId, `${STAGE_LABEL[stage]}子任务已取消`);
    }

    throw new Error(
      stageTask.errorMessage || `${STAGE_LABEL[stage]}子任务未成功完成`
    );
  }
};

export const createStageTask = async ({
  pipelineTaskId,
  bookId,
  stage,
  taskType,
  message,
  totalItems,
  metadata,
}: {
  pipelineTaskId: string;
  bookId: string;
  stage: AutoPipelineStage;
  taskType: string;
  message: string;
  totalItems: number;
  metadata?: Record<string, unknown>;
}) => {
  return prisma.processingTask.create({
    data: {
      bookId,
      taskType,
      status: "processing",
      progress: 0,
      totalItems,
      taskData: {
        message,
        metadata: {
          source: "auto_pipeline",
          pipelineTaskId,
          stage,
          ...(metadata || {}),
        },
      },
    },
  });
};

export const runTextProcessingStage = async ({
  taskId,
  bookId,
  options,
}: {
  taskId: string;
  bookId: string;
  options: TextProcessingOptions;
}): Promise<void> => {
  await throwIfTaskCanceled(taskId);
  await updateTaskProgress(taskId, 10, "读取原始文件");

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      uploadedFilePath: true,
      originalFilename: true,
      metadata: true,
    },
  });

  if (!book || !book.uploadedFilePath) {
    throw new Error("未找到上传文件，无法执行文本处理");
  }

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "processing",
    },
  });

  const fileBuffer = await readFile(book.uploadedFilePath);
  await throwIfTaskCanceled(taskId);

  await updateTaskProgress(taskId, 35, "文本清洗与编码识别");

  const processedText = processFileContent(fileBuffer, book.originalFilename || "", {
    maxSegmentLength: options.maxSegmentLength,
    minSegmentLength: options.minSegmentLength,
    preserveFormatting: options.preserveFormatting,
    encoding: options.encoding,
  });

  const {
    chapterRecords,
    segmentRecords,
    statistics,
  } = createChapterSegmentRecords(bookId, processedText.content, options);
  await throwIfTaskCanceled(taskId);

  await updateTaskProgress(taskId, 70, "清理旧数据并写入章节/段落");

  await prisma.$transaction(async (tx) => {
    await tx.chapterQualityAudit.deleteMany({ where: { bookId } });
    await tx.manualReviewItem.deleteMany({ where: { bookId } });
    await tx.qualityCheckResult.deleteMany({ where: { bookId } });
    await tx.synthesisAttempt.deleteMany({ where: { bookId } });
    await tx.audioFile.deleteMany({ where: { bookId } });
    await tx.scriptSentence.deleteMany({ where: { bookId } });
    await tx.textSegment.deleteMany({ where: { bookId } });
    await tx.chapter.deleteMany({ where: { bookId } });

    await tx.chapter.createMany({ data: chapterRecords });
    await tx.textSegment.createMany({ data: segmentRecords });

    await tx.book.update({
      where: { id: bookId },
      data: {
        status: "processed",
        totalWords: processedText.wordCount,
        totalCharacters: processedText.characterCount,
        totalSegments: segmentRecords.length,
        totalChapters: chapterRecords.length,
        encoding: processedText.encoding,
        fileFormat: processedText.detectedFormat,
        metadata: {
          ...jsonObject(book.metadata),
          textProcessedAt: new Date().toISOString(),
          textSegmentStats: {
            totalChapters: statistics.totalChapters,
            totalSegments: statistics.totalSegments,
            avgWordsPerSegment: statistics.avgWordsPerSegment,
            segmentTypes: statistics.segmentTypes,
          },
        },
      },
    });
  });
  await throwIfTaskCanceled(taskId);

  await updateTaskProgress(taskId, 100, "文本处理完成");

  const completedTaskData = await mergeTaskData(taskId, {
    message: "文本处理完成",
    metadata: {
      stage: "completed",
      totalChapters: statistics.totalChapters,
      totalSegments: statistics.totalSegments,
      totalWords: processedText.wordCount,
      totalCharacters: processedText.characterCount,
      encoding: processedText.encoding,
      fileFormat: processedText.detectedFormat,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      completedAt: new Date(),
      taskData: completedTaskData,
    },
  });
};

export const runStage = async ({
  stage,
  stageTaskId,
  run,
}: {
  stage: AutoPipelineStage;
  stageTaskId: string;
  run: () => Promise<void>;
}): Promise<void> => {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : `${STAGE_LABEL[stage]}失败`;
    await updateTaskFailureIfNeeded(stageTaskId, message, stage);
    throw error;
  }

  await ensureStageCompleted(stageTaskId, stage);
};

export const getAudioTaskBookStatus = async (bookId: string): Promise<string> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      status: true,
    },
  });

  return book?.status || "completed";
};

export const completeAutoPipeline = async ({
  taskId,
  bookId,
  options,
  stageState,
  pendingReviewCount,
  stageCount,
}: {
  taskId: string;
  bookId: string;
  options: Required<AutoPipelineOptions>;
  stageState: Record<AutoPipelineStage, AutoPipelineStageState>;
  pendingReviewCount: number;
  stageCount: number;
}): Promise<void> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      metadata: true,
      status: true,
    },
  });

  const taskData = await mergeTaskData(taskId, {
    message: "Auto Pipeline 执行完成",
    metadata: {
      source: "auto_pipeline",
      currentStage: "completed",
      stages: stageState,
      options: toInputJsonValue(options),
      completedAt: new Date().toISOString(),
      pendingReviewCount,
      finalBookStatus: book?.status || null,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: stageCount,
      completedAt: new Date(),
      taskData,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: {
        ...jsonObject(book?.metadata),
        autoPipeline: {
          ...jsonMetadata(jsonObject(book?.metadata).autoPipeline),
          taskId,
          completedAt: new Date().toISOString(),
          pendingReviewCount,
          stageCount,
          options: toInputJsonValue(options),
        },
      },
    },
  });
};

export const markPipelineFailed = async ({
  stageState,
  error,
  syncPipelineTask,
}: {
  stageState: Record<AutoPipelineStage, AutoPipelineStageState>;
  error: unknown;
  syncPipelineTask: (params: {
    progress: number;
    message: string;
    currentStage: "failed";
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}): Promise<void> => {
  const failedStage =
    AUTO_PIPELINE_STAGE_ORDER.find(
      (stage) => stageState[stage].status === "processing"
    ) || "text_processing";
  const errorMessage =
    error instanceof Error ? error.message : "Auto Pipeline 执行失败";

  stageState[failedStage] = {
    ...stageState[failedStage],
    status: "failed",
    completedAt: new Date().toISOString(),
    error: errorMessage,
  };

  await syncPipelineTask({
    progress: 100,
    message: `Auto Pipeline 失败：${errorMessage}`,
    currentStage: "failed",
    metadata: {
      failedStage,
      error: errorMessage,
    },
  });
};
