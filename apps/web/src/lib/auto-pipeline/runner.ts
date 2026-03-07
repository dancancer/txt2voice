// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 自动编排任务执行结果
// pos: 自动编排执行模块
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { runQualityCheckTask } from "@/lib/quality-check-runner";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";
import {
  AUTO_PIPELINE_STAGE_ORDER,
  createStageStateMap,
  getStageTaskProgressRange,
  normalizeOptions,
  toInputJsonValue,
  type AutoPipelineRunParams,
  type AutoPipelineStage,
} from "./common";
import {
  completeAutoPipeline,
  createStageTask,
  getAudioTaskBookStatus,
  markPipelineFailed,
  runStage,
  runTextProcessingStage,
} from "./task-stage-utils";

/**
 * 执行自动编排任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runAutoPipelineTask({
  taskId,
  bookId,
  options = {},
}: AutoPipelineRunParams): Promise<void> {
  const normalizedOptions = normalizeOptions(options);
  const stageState = createStageStateMap();
  const qualityCheckEnabled = normalizedOptions.qualityCheck.enabled !== false;
  const qualityCheckType = normalizedOptions.qualityCheck.type || "book";
  const qualityCheckChapterId =
    qualityCheckType === "chapter"
      ? normalizedOptions.qualityCheck.chapterId || undefined
      : undefined;
  const stageCount = qualityCheckEnabled ? 4 : 3;

  const syncPipelineTask = async ({
    progress,
    message,
    currentStage,
    metadata,
  }: {
    progress: number;
    message: string;
    currentStage: AutoPipelineStage | "completed" | "failed";
    metadata?: Record<string, unknown>;
  }) => {
    const taskData = await mergeTaskData(taskId, {
      message,
      metadata: {
        source: "auto_pipeline",
        currentStage,
        stages: stageState,
        options: toInputJsonValue(normalizedOptions),
        ...(metadata || {}),
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        progress,
        taskData,
      },
    });
  };

  await syncPipelineTask({
    progress: 3,
    message: "Auto Pipeline 已启动",
    currentStage: "text_processing",
    metadata: {
      startedAt: new Date().toISOString(),
      totalStages: stageCount,
      stageOrder: qualityCheckEnabled
        ? AUTO_PIPELINE_STAGE_ORDER
        : AUTO_PIPELINE_STAGE_ORDER.slice(0, 3),
    },
  });

  let audioTaskBookStatus = "completed";
  let pendingReviewCount = 0;

  try {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "processing",
      },
    });

    const textTask = await createStageTask({
      pipelineTaskId: taskId,
      bookId,
      stage: "text_processing",
      taskType: "TEXT_PROCESSING",
      message: "Auto Pipeline: 文本处理阶段",
      totalItems: 1,
      metadata: {
        type: "auto_pipeline",
      },
    });

    stageState.text_processing = {
      taskId: textTask.id,
      status: "processing",
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("text_processing", qualityCheckEnabled).start,
      message: "开始文本处理阶段",
      currentStage: "text_processing",
    });

    await runStage({
      stage: "text_processing",
      stageTaskId: textTask.id,
      run: async () => {
        await runTextProcessingStage({
          taskId: textTask.id,
          bookId,
          options: normalizedOptions.textProcessing,
        });
      },
    });

    stageState.text_processing = {
      ...stageState.text_processing,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("text_processing", qualityCheckEnabled).end,
      message: "文本处理阶段完成",
      currentStage: "script_generation",
    });

    const scriptTotalItems = await prisma.textSegment.count({ where: { bookId } });

    const scriptTask = await createStageTask({
      pipelineTaskId: taskId,
      bookId,
      stage: "script_generation",
      taskType: "SCRIPT_GENERATION",
      message: "Auto Pipeline: 台本生成阶段",
      totalItems: scriptTotalItems,
      metadata: {
        type: "book",
      },
    });

    stageState.script_generation = {
      taskId: scriptTask.id,
      status: "processing",
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("script_generation", qualityCheckEnabled).start,
      message: "开始台本生成阶段",
      currentStage: "script_generation",
    });

    await runStage({
      stage: "script_generation",
      stageTaskId: scriptTask.id,
      run: async () => {
        await runScriptGenerationTask({
          taskId: scriptTask.id,
          bookId,
          options: normalizedOptions.scriptGeneration,
          extraParams: {},
        });
      },
    });

    stageState.script_generation = {
      ...stageState.script_generation,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("script_generation", qualityCheckEnabled).end,
      message: "台本生成阶段完成",
      currentStage: "audio_generation",
    });

    const audioTotalItems = await prisma.scriptSentence.count({ where: { bookId } });

    const audioTask = await createStageTask({
      pipelineTaskId: taskId,
      bookId,
      stage: "audio_generation",
      taskType: "AUDIO_GENERATION",
      message: "Auto Pipeline: 音频生成阶段",
      totalItems: audioTotalItems,
      metadata: {
        type: "book",
        autoMerge: normalizedOptions.audioGeneration.autoMerge,
        provider: normalizedOptions.audioGeneration.options?.provider || null,
      },
    });

    stageState.audio_generation = {
      taskId: audioTask.id,
      status: "processing",
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("audio_generation", qualityCheckEnabled).start,
      message: "开始音频生成阶段",
      currentStage: "audio_generation",
    });

    await runStage({
      stage: "audio_generation",
      stageTaskId: audioTask.id,
      run: async () => {
        await runAudioGenerationTask({
          taskId: audioTask.id,
          bookId,
          type: "book",
          autoMerge: normalizedOptions.audioGeneration.autoMerge,
          options: normalizedOptions.audioGeneration.options,
        });
      },
    });

    stageState.audio_generation = {
      ...stageState.audio_generation,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    await syncPipelineTask({
      progress: getStageTaskProgressRange("audio_generation", qualityCheckEnabled).end,
      message: "音频生成阶段完成",
      currentStage: qualityCheckEnabled ? "quality_check" : "completed",
    });

    audioTaskBookStatus = await getAudioTaskBookStatus(bookId);

    if (qualityCheckEnabled) {
      if (qualityCheckType === "chapter" && !qualityCheckChapterId) {
        throw new Error("自动编排章节质检必须提供 chapterId");
      }

      const qcTotalItems = await prisma.audioFile.count({
        where: {
          bookId,
          status: "completed",
          ...(qualityCheckType === "chapter" && qualityCheckChapterId
            ? {
                chapterId: qualityCheckChapterId,
              }
            : {}),
        },
      });

      if (qcTotalItems <= 0) {
        throw new Error("音频生成未产出可质检文件");
      }

      const qualityTask = await createStageTask({
        pipelineTaskId: taskId,
        bookId,
        stage: "quality_check",
        taskType: "QUALITY_CHECK",
        message: "Auto Pipeline: 质量检查阶段",
        totalItems: qcTotalItems,
        metadata: {
          type: qualityCheckType,
          chapterId: qualityCheckChapterId || null,
          source: "auto_pipeline",
          syncSignalsBeforeRun: normalizedOptions.qualityCheck.syncSignalsBeforeRun,
          forceSignalResync: normalizedOptions.qualityCheck.forceSignalResync,
        },
      });

      stageState.quality_check = {
        taskId: qualityTask.id,
        status: "processing",
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
      };

      await prisma.book.update({
        where: { id: bookId },
        data: {
          status: "quality_checking",
        },
      });

      await syncPipelineTask({
        progress: getStageTaskProgressRange("quality_check", qualityCheckEnabled).start,
        message: "开始质量检查阶段",
        currentStage: "quality_check",
      });

      await runStage({
        stage: "quality_check",
        stageTaskId: qualityTask.id,
        run: async () => {
          await runQualityCheckTask({
            taskId: qualityTask.id,
            bookId,
            type: qualityCheckType,
            chapterId: qualityCheckChapterId,
          });
        },
      });

      stageState.quality_check = {
        ...stageState.quality_check,
        status: "completed",
        completedAt: new Date().toISOString(),
      };

      pendingReviewCount = await prisma.manualReviewItem.count({
        where: {
          bookId,
          status: "pending",
        },
      });

      if (pendingReviewCount > 0) {
        await prisma.book.update({
          where: { id: bookId },
          data: {
            status: "manual_review_pending",
          },
        });
      } else {
        await prisma.book.update({
          where: { id: bookId },
          data: {
            status: "assembling_audio",
          },
        });

        await prisma.book.update({
          where: { id: bookId },
          data: {
            status:
              audioTaskBookStatus === "completed_with_errors"
                ? "completed_with_errors"
                : "completed",
          },
        });
      }

      await syncPipelineTask({
        progress: getStageTaskProgressRange("quality_check", qualityCheckEnabled).end,
        message: "质量检查阶段完成",
        currentStage: "completed",
      });
    } else {
      stageState.quality_check = {
        taskId: null,
        status: "skipped",
        startedAt: null,
        completedAt: new Date().toISOString(),
        error: null,
      };

      await prisma.book.update({
        where: { id: bookId },
        data: {
          status:
            audioTaskBookStatus === "completed_with_errors"
              ? "completed_with_errors"
              : "completed",
        },
      });
    }

    await completeAutoPipeline({
      taskId,
      bookId,
      options: normalizedOptions,
      stageState,
      pendingReviewCount,
      stageCount,
    });
  } catch (error) {
    await markPipelineFailed({
      stageState,
      error,
      syncPipelineTask: async (params) => {
        await syncPipelineTask(params);
      },
    });

    throw error;
  }
}
