// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 台本任务执行结果
// pos: 任务执行器
import prisma from "@/lib/prisma";
import { getScriptGenerator } from "@/lib/script-generator";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

export interface ScriptGenerationExtraParams {
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  regenerateSegments?: boolean;
  segmentIds?: string[];
  limitToSegments?: number;
}

export interface ScriptGenerationRunParams {
  bookId: string;
  taskId: string;
  options: Partial<ScriptGenerationOptions>;
  extraParams?: ScriptGenerationExtraParams;
}

/**
 * 执行台本生成任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runScriptGenerationTask({
  bookId,
  taskId,
  options,
  extraParams = {},
}: ScriptGenerationRunParams): Promise<void> {
  await updateTaskProgress(taskId, 10, "准备生成台本");

  const scriptGenerator = getScriptGenerator();
  let script: any;

  await updateTaskProgress(taskId, 30, "开始分析文本");

  const segmentProgress = (done: number, total: number) => {
    if (!total) return;
    const base = 30;
    const span = 40;
    const next = Math.min(base + Math.floor((done / total) * span), 69);
    return updateTaskProgress(taskId, next, `生成台本 ${done}/${total}`);
  };

  if (extraParams.regenerateSegments && extraParams.segmentIds) {
    script = await scriptGenerator.regenerateSegmentScript(
      bookId,
      extraParams.segmentIds,
      options,
      segmentProgress
    );
    await updateTaskProgress(taskId, 70, "段落台本生成完成");
  } else if (
    extraParams.startFromSegmentId ||
    (extraParams.startFromOrderIndex !== null &&
      extraParams.startFromOrderIndex !== undefined)
  ) {
    if (extraParams.limitToSegments) {
      script = await scriptGenerator.generatePartialScript(
        bookId,
        options,
        {
          startFromSegmentId: extraParams.startFromSegmentId,
          startFromOrderIndex: extraParams.startFromOrderIndex,
          limitToSegments: extraParams.limitToSegments,
        },
        segmentProgress
      );
      script.segments = script.segments.slice(0, extraParams.limitToSegments);
      await updateTaskProgress(
        taskId,
        70,
        `完成前${extraParams.limitToSegments}个段落的台本生成`
      );
    } else {
      script = await scriptGenerator.generatePartialScript(
        bookId,
        options,
        {
          startFromSegmentId: extraParams.startFromSegmentId,
          startFromOrderIndex: extraParams.startFromOrderIndex,
        },
        segmentProgress
      );
      await updateTaskProgress(taskId, 70, "增量台本生成完成");
    }
  } else {
    await prisma.scriptSentence.deleteMany({
      where: { bookId },
    });
    script = await scriptGenerator.generateScript(bookId, options, segmentProgress);
    await updateTaskProgress(taskId, 70, "台本生成完成");
  }

  await updateTaskProgress(taskId, 90, "更新书籍状态");

  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  const failedSegments = Number(script.summary.failedSegments || 0);
  const totalSegments = Number(script.summary.totalSegments || 0);
  const hasSegmentFailures = failedSegments > 0;

  if (hasSegmentFailures) {
    const failureMessage = `台本生成部分失败：${failedSegments}/${totalSegments} 个段落未生成成功`;
    const failedTaskData = await mergeTaskData(taskId, {
      message: failureMessage,
      metadata: {
        totalLines: script.summary.totalLines,
        dialogueCount: script.summary.dialogueCount,
        narrationCount: script.summary.narrationCount,
        segmentCount: script.segments.length,
        totalSegments,
        failedSegments,
        failedSegmentIds: script.summary.failedSegmentIds || [],
        isPartialFailure: true,
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: failureMessage,
        taskData: failedTaskData,
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "processed",
        metadata: {
          ...jsonObject(book?.metadata),
          scriptGenerationFailedAt: new Date().toISOString(),
          failedSegments,
          totalSegments,
          failedSegmentIds: script.summary.failedSegmentIds || [],
        },
      },
    });
    return;
  }

  await updateTaskProgress(taskId, 100, "台本生成完成");

  const taskData = await mergeTaskData(taskId, {
    message: extraParams.regenerateSegments
      ? "段落重新生成完成"
      : extraParams.startFromSegmentId
      ? "增量台本生成完成"
      : "台本生成完成",
    metadata: {
      totalLines: script.summary.totalLines,
      dialogueCount: script.summary.dialogueCount,
      narrationCount: script.summary.narrationCount,
      characterCount: Object.keys(script.summary.characterDistribution).length,
      segmentCount: script.segments.length,
      isPartial:
        Boolean(extraParams.startFromSegmentId) ||
        Boolean(extraParams.regenerateSegments),
      regeneratedSegments: extraParams.segmentIds?.length || 0,
    },
  });

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
      status: "script_generated",
      metadata: {
        ...jsonObject(book?.metadata),
        scriptGeneratedAt: new Date().toISOString(),
        totalScriptLines: script.summary.totalLines,
        dialogueCount: script.summary.dialogueCount,
        narrationCount: script.summary.narrationCount,
        totalSegments: script.summary.totalSegments,
        failedSegments: 0,
        failedSegmentIds: [],
      },
    },
  });
}
