// 一旦我被更新，请更新我的开头注释
// input: 最终合并任务参数/音频合并依赖
// output: 最终合并任务执行结果
// pos: S31 交付执行器
import { AudioMergeOptions, getAudioMerger } from "@/lib/audio-merger";
import prisma from "@/lib/prisma";
import { jsonObject, mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from "@/lib/processing-task-utils";

export type FinalAssemblyType = "book" | "chapter" | "segment";

export interface FinalAssemblyRunParams {
  taskId: string;
  bookId: string;
  type: FinalAssemblyType;
  chapterId?: string;
  segmentId?: string;
  options?: AudioMergeOptions;
}

const toJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? {}));

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveBookFinalStatus = ({
  type,
  bookStatus,
  bookMetadata,
  taskData,
}: {
  type: FinalAssemblyType;
  bookStatus: string | null | undefined;
  bookMetadata: unknown;
  taskData: unknown;
}): string => {
  if (type !== "book") {
    return bookStatus || "completed";
  }

  const taskMetadata = asRecord(asRecord(taskData)?.metadata);
  const previousBookStatus = asString(taskMetadata?.previousBookStatus);
  const rootMetadata = asRecord(bookMetadata);
  const audioGenerationStatus = asString(rootMetadata?.audioGenerationStatus);

  if (
    audioGenerationStatus === "completed_with_errors" ||
    previousBookStatus === "completed_with_errors"
  ) {
    return "completed_with_errors";
  }

  if (audioGenerationStatus === "completed") {
    return "completed";
  }

  if (previousBookStatus === "completed") {
    return "completed";
  }

  return "completed";
};

export async function runFinalAssemblyTask({
  taskId,
  bookId,
  type,
  chapterId,
  segmentId,
  options = {},
}: FinalAssemblyRunParams): Promise<void> {
  const [book, taskSnapshot] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        metadata: true,
        status: true,
      },
    }),
    prisma.processingTask.findUnique({
      where: { id: taskId },
      select: {
        taskData: true,
      },
    }),
  ]);

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "assembling_audio",
    },
  });

  await updateTaskProgress(taskId, 10, "准备执行最终合并");

  const merger = getAudioMerger();
  let result;
  if (type === "book") {
    result = await merger.mergeBookAudio(bookId, options);
  } else if (type === "chapter") {
    if (!chapterId) {
      throw new Error("章节合并缺少 chapterId");
    }
    result = await merger.mergeChapterAudio(bookId, chapterId, options);
  } else {
    if (!segmentId) {
      throw new Error("段落合并缺少 segmentId");
    }
    result = await merger.mergeSegmentAudio(segmentId, options);
  }

  if (!result.success) {
    throw new Error(result.error || "最终合并失败");
  }

  await updateTaskProgress(taskId, 100, "最终合并完成");

  const taskData = await mergeTaskData(taskId, {
    message: "最终合并完成",
    metadata: {
      source: "final_assembly",
      type,
      chapterId: chapterId || null,
      segmentId: segmentId || null,
      outputPath: result.outputPath || null,
      fileName: result.fileName || null,
      fileSize: result.fileSize || null,
      duration: result.duration || null,
      mergeOptions: options,
      completedAt: new Date().toISOString(),
    },
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

  const rootMetadata = jsonObject(book?.metadata);
  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: resolveBookFinalStatus({
        type,
        bookStatus: book?.status,
        bookMetadata: book?.metadata,
        taskData: taskSnapshot?.taskData,
      }),
      metadata: toJson({
        ...rootMetadata,
        finalAssembly: {
          taskId,
          type,
          chapterId: chapterId || null,
          segmentId: segmentId || null,
          outputPath: result.outputPath || null,
          fileName: result.fileName || null,
          fileSize: result.fileSize || null,
          duration: result.duration || null,
          mergeOptions: options,
          completedAt: new Date().toISOString(),
        },
      }),
    },
  });
}
