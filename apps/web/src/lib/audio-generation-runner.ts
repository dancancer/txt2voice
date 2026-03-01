// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 音频任务执行结果
// pos: 任务执行器
import {
  getAudioGenerator,
} from "@/lib/audio-generator";
import type {
  AudioGenerationRequest,
  AudioGenerationOptions,
} from "@/lib/audio-generator";
import prisma from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

export type AudioGenerationTaskType = "single" | "batch" | "book" | "chapter";

export interface AudioGenerationRunParams {
  bookId: string;
  taskId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

/**
 * 执行音频生成任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runAudioGenerationTask({
  bookId,
  taskId,
  type,
  chapterId,
  scriptSentenceIds,
  voiceProfileId,
  autoMerge = false,
  options = {},
}: AudioGenerationRunParams): Promise<void> {
  const audioGenerator = getAudioGenerator();

  await updateTaskProgress(taskId, 10, "准备生成音频");

  let results: any[] = [];
  let totalSentences = 0;

  if (type === "book") {
    await updateTaskProgress(taskId, 20, "开始生成整书音频");
    const result = await audioGenerator.generateBookAudio(bookId, options);
    results = result.results;
    totalSentences = result.total;
  } else if (type === "chapter" && chapterId) {
    await updateTaskProgress(taskId, 20, "开始生成章节音频");
    const result = await audioGenerator.generateChapterAudio(
      bookId,
      chapterId,
      options
    );
    results = result.results;
    totalSentences = result.total;
  } else if (type === "batch" && scriptSentenceIds) {
    await updateTaskProgress(taskId, 20, "开始批量生成音频");
    const requests: AudioGenerationRequest[] = scriptSentenceIds.map((id) => ({
      scriptSentenceId: id,
      voiceProfileId,
      outputFormat: "mp3",
    }));
    results = await audioGenerator.generateBatchAudio(requests, options);
    totalSentences = requests.length;
  } else if (type === "single" && scriptSentenceIds && scriptSentenceIds.length > 0) {
    await updateTaskProgress(taskId, 20, "开始生成单个音频");
    const request: AudioGenerationRequest = {
      scriptSentenceId: scriptSentenceIds[0],
      voiceProfileId,
      outputFormat: "mp3",
    };
    const result = await audioGenerator.generateSingleAudio(request, options);
    results = [result];
    totalSentences = 1;
  } else {
    throw new Error("无效的生成类型");
  }

  await updateTaskProgress(taskId, 80, "统计生成结果");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  let mergeResult = null;
  if (autoMerge && successCount > 0) {
    await updateTaskProgress(taskId, 85, "正在合并音频文件");

    const { getAudioMerger } = await import("@/lib/audio-merger");
    const audioMerger = getAudioMerger();

    if (type === "chapter" && chapterId) {
      mergeResult = await audioMerger.mergeChapterAudio(bookId, chapterId);
    } else if (type === "book") {
      mergeResult = await audioMerger.mergeBookAudio(bookId);
    }

    if (mergeResult && !mergeResult.success) {
      console.warn("音频合并失败:", mergeResult.error);
    }
  }

  const [book, totalAudioFiles] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        metadata: true,
      },
    }),
    prisma.audioFile.count({
      where: { bookId },
    }),
  ]);

  await updateTaskProgress(taskId, 100, "音频生成完成");

  const message = `音频生成完成，成功 ${successCount} 个，失败 ${failedCount} 个${mergeResult?.success ? "，已合并音频" : ""}`;

  const taskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      type,
      chapterId,
      voiceProfileId,
      provider: options.provider || null,
      totalSentences,
      successCount,
      failedCount,
      autoMerge,
      mergeResult: mergeResult
        ? {
            success: mergeResult.success,
            fileName: mergeResult.fileName,
            fileSize: mergeResult.fileSize,
            duration: mergeResult.duration,
          }
        : null,
      results: results.map((r) => ({
        success: r.success,
        error: r.error,
        duration: r.duration,
      })),
    },
  });

  const generatedDuration = Number(
    results.reduce((sum, result) => sum + (result.duration || 0), 0).toFixed(2)
  );

  if (successCount === 0) {
    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "音频生成失败：全部句子生成失败",
        taskData,
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "script_generated",
        metadata: {
          ...jsonObject(book?.metadata),
          audioGenerationFailedAt: new Date().toISOString(),
          audioGenerationFailedCount: failedCount,
        },
      },
    });
    return;
  }

  const bookStatus = failedCount === 0 ? "completed" : "completed_with_errors";

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      completedAt: new Date(),
      taskData,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: bookStatus,
      metadata: {
        ...jsonObject(book?.metadata),
        audioGenerationCompletedAt: new Date().toISOString(),
        audioGenerationStatus: bookStatus,
        totalAudioFiles,
        totalAudioDuration: generatedDuration,
        lastAudioFailureCount: failedCount,
      },
    },
  });
}
