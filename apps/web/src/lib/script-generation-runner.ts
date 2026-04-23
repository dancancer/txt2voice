// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 台本任务执行结果
// pos: 任务执行器
import prisma from "@/lib/prisma";
import type { LLMExecutionEvent } from "@/lib/llm/events";
import { runScriptProductionWorkflow } from "@/lib/agent-runtime/runtime/run-script-production-workflow";
import type { ScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/types";
import {
  jsonObject,
  mergeTaskData,
} from "@/lib/processing-task-utils";
import {
  CANCELED_TASK_STATUS,
  throwIfTaskCanceled,
} from "@/lib/task-cancellation";
import {
  asAgentRuntimeMetadata,
  asRecord,
  asRuntimeManualReviewSync,
  asString,
  asStringList,
  buildBookRuntimePointers,
  isPartialScriptGenerationRun,
  isSampleScriptGenerationRun,
  mergeOutstandingFailedSegmentIds,
  resolveBookStatusAfterPartialRun,
  resolveFailureDetails,
} from "@/lib/script-generation/runner/runtime-metadata";
import { createLLMMetricsCollector } from "@/lib/script-generation/runner/llm-metrics";
import {
  buildLLMRuntimeEvent,
  buildSegmentProgressRuntimeEvent,
  buildTaskStageRuntimeEvent,
} from "@/lib/script-generation/runner/runtime-events";
import type {
  AgentRuntimeMetadata,
  RuntimeManualReviewSync,
  ScriptGenerationExtraParams,
  ScriptGenerationRunParams,
} from "@/lib/script-generation/runner/types";

export type {
  ScriptGenerationExtraParams,
  ScriptGenerationRunParams,
} from "@/lib/script-generation/runner/types";

const MANUAL_REVIEW_ISSUE_TYPE = "SCRIPT_VALIDATION";

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
  await throwIfTaskCanceled(taskId);

  const isSampleRun = isSampleScriptGenerationRun(extraParams);
  const isPartialRun = isPartialScriptGenerationRun(extraParams);
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      taskData: true,
    },
  });
  let taskMetadata = {
    ...(asRecord(asRecord(taskSnapshot?.taskData)?.metadata) || {}),
  };
  const previousBookStatusFromTask = asString(taskMetadata?.previousBookStatus);

  let currentProgress = 0;
  let currentMessage = "";
  const persistTaskRuntimeUpdate = async (params: {
    progress: number;
    message: string;
    event?: LLMExecutionEvent;
    stageEvent?: {
      title: string;
      detail?: string;
      stage: string;
      status?: "info" | "success" | "warning" | "error";
    };
    segmentProgress?: {
      done: number;
      total: number;
      segmentId?: string;
    };
  }) => {
    const task = await prisma.processingTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    if (task?.status === CANCELED_TASK_STATUS) {
      return;
    }

    currentProgress = params.progress;
    currentMessage = params.message;

    if (params.event) {
      taskMetadata = buildLLMRuntimeEvent({
        metadata: taskMetadata,
        event: params.event,
        progress: currentProgress,
      }).metadata;
    } else if (params.segmentProgress) {
      taskMetadata = buildSegmentProgressRuntimeEvent({
        metadata: taskMetadata,
        done: params.segmentProgress.done,
        total: params.segmentProgress.total,
        progress: currentProgress,
        segmentId: params.segmentProgress.segmentId,
      }).metadata;
    } else if (params.stageEvent) {
      taskMetadata = buildTaskStageRuntimeEvent({
        metadata: taskMetadata,
        title: params.stageEvent.title,
        detail: params.stageEvent.detail,
        progress: currentProgress,
        stage: params.stageEvent.stage,
        status: params.stageEvent.status,
      }).metadata;
    }

    const taskData = await mergeTaskData(taskId, {
      message: currentMessage,
      metadata: taskMetadata,
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        progress: currentProgress,
        taskData,
      },
    });
  };
  let runtimeUpdateQueue = Promise.resolve();
  const enqueueRuntimeUpdate = (
    params: Parameters<typeof persistTaskRuntimeUpdate>[0]
  ) => {
    runtimeUpdateQueue = runtimeUpdateQueue
      .catch(() => undefined)
      .then(() => persistTaskRuntimeUpdate(params));
    return runtimeUpdateQueue;
  };

  await enqueueRuntimeUpdate({
    progress: 10,
    message: "准备生成台本",
    stageEvent: {
      title: "准备生成台本",
      detail: "初始化任务与运行时上下文",
      stage: "prepare",
    },
  });

  const llmMetricsCollector = createLLMMetricsCollector();
  let script: any;

  await enqueueRuntimeUpdate({
    progress: 30,
    message: "开始分析文本",
    stageEvent: {
      title: "开始分析文本",
      detail: "正在准备角色发现与文本理解",
      stage: "character_discovery",
    },
  });

  const segmentProgress = (done: number, total: number) => {
    if (!total) return;
    const base = 30;
    const span = 40;
    const next = Math.min(base + Math.floor((done / total) * span), 69);
    return enqueueRuntimeUpdate({
      progress: next,
      message: `生成台本 ${done}/${total}`,
      segmentProgress: {
        done,
        total,
      },
    });
  };

  const observeExecutionEvent = (event: LLMExecutionEvent) => {
    llmMetricsCollector.observe(event);
    void enqueueRuntimeUpdate({
      progress: currentProgress || 30,
      message: currentMessage || "生成中",
      event,
    });
  };

  if (extraParams.regenerateSegments && extraParams.segmentIds) {
    script = await runScriptProductionWorkflow({
      taskId,
      bookId,
      options,
      mode: "regenerate",
      segmentIds: extraParams.segmentIds,
      onProgress: segmentProgress,
      onExecutionEvent: observeExecutionEvent,
      assertContinue: () => throwIfTaskCanceled(taskId),
    });
    await throwIfTaskCanceled(taskId);
    await enqueueRuntimeUpdate({
      progress: 70,
      message: "段落台本生成完成",
      stageEvent: {
        title: "段落台本生成完成",
        detail: "已完成本次重生段落的台本生成",
        stage: "finalize",
        status: "success",
      },
    });
  } else if (
    extraParams.limitToSegments ||
    extraParams.startFromSegmentId ||
    (extraParams.startFromOrderIndex !== null &&
      extraParams.startFromOrderIndex !== undefined)
  ) {
    if (extraParams.limitToSegments) {
      script = await runScriptProductionWorkflow({
        taskId,
        bookId,
        options,
        mode: "partial",
        startFromSegmentId: extraParams.startFromSegmentId,
        startFromOrderIndex: extraParams.startFromOrderIndex,
        limitToSegments: extraParams.limitToSegments,
        onProgress: segmentProgress,
        onExecutionEvent: observeExecutionEvent,
        assertContinue: () => throwIfTaskCanceled(taskId),
      });
      await throwIfTaskCanceled(taskId);
      script.segments = script.segments.slice(0, extraParams.limitToSegments);
      await enqueueRuntimeUpdate({
        progress: 70,
        message: `完成前${extraParams.limitToSegments}个段落的台本生成`,
        stageEvent: {
          title: `完成前${extraParams.limitToSegments}个段落的台本生成`,
          detail: "增量生成阶段已完成",
          stage: "finalize",
          status: "success",
        },
      });
    } else {
      script = await runScriptProductionWorkflow({
        taskId,
        bookId,
        options,
        mode: "partial",
        startFromSegmentId: extraParams.startFromSegmentId,
        startFromOrderIndex: extraParams.startFromOrderIndex,
        onProgress: segmentProgress,
        onExecutionEvent: observeExecutionEvent,
        assertContinue: () => throwIfTaskCanceled(taskId),
      });
      await throwIfTaskCanceled(taskId);
      await enqueueRuntimeUpdate({
        progress: 70,
        message: "增量台本生成完成",
        stageEvent: {
          title: "增量台本生成完成",
          detail: "已完成增量段落的台本生成",
          stage: "finalize",
          status: "success",
        },
      });
    }
  } else {
    await prisma.scriptSentence.deleteMany({
      where: { bookId },
    });
    await throwIfTaskCanceled(taskId);
    script = await runScriptProductionWorkflow({
      taskId,
      bookId,
      options,
      mode: "full",
      onProgress: segmentProgress,
      onExecutionEvent: observeExecutionEvent,
      assertContinue: () => throwIfTaskCanceled(taskId),
    });
    await throwIfTaskCanceled(taskId);
    await enqueueRuntimeUpdate({
      progress: 70,
      message: "台本生成完成",
      stageEvent: {
        title: "台本生成完成",
        detail: "台本主生成阶段已完成，准备更新书籍状态",
        stage: "finalize",
        status: "success",
      },
    });
  }

  await enqueueRuntimeUpdate({
    progress: 90,
    message: "更新书籍状态",
    stageEvent: {
      title: "更新书籍状态",
      detail: "正在写回任务摘要与书籍状态",
      stage: "finalize",
    },
  });

  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });
  const bookMetadata = jsonObject(book?.metadata);
  const previousBookStatus =
    previousBookStatusFromTask ||
    (typeof book?.status === "string" ? book.status : "");

  const failedSegments = Number(script.summary.failedSegments || 0);
  const totalSegments = Number(script.summary.totalSegments || 0);
  const runtimeMetadata = asAgentRuntimeMetadata(
    asRecord(script)?.runtimeMetadata
  );
  const runtimeReviewSync = asRuntimeManualReviewSync(runtimeMetadata);
  const hasSegmentFailures = failedSegments > 0;
  const failedSegmentIds = asStringList(script.summary.failedSegmentIds);
  const processedSegmentIds = Array.isArray(script.segments)
    ? script.segments
        .map((segment: { segmentId?: unknown }) => asString(segment?.segmentId))
        .filter((segmentId: string) => segmentId.length > 0)
    : [];
  const failedSegmentDetails = resolveFailureDetails(
    script.summary.failedSegmentDetails
  );
  const outstandingFailedSegmentIds = mergeOutstandingFailedSegmentIds({
    bookMetadata,
    processedSegmentIds,
    failedSegmentIds,
    isPartialRun,
  });
  const outstandingFailedSegments = outstandingFailedSegmentIds.length;
  const resolvedReviewResult = {
    resolved: runtimeReviewSync?.resolved ?? 0,
  };
  const reviewSyncResult = {
    created: runtimeReviewSync?.created ?? 0,
    updated: runtimeReviewSync?.updated ?? 0,
    totalPending: runtimeReviewSync?.pending ?? 0,
  };
  const llmMetrics = llmMetricsCollector.snapshot();

  await throwIfTaskCanceled(taskId);

  if (hasSegmentFailures) {
    const failureMessage = `台本生成部分失败：${failedSegments}/${totalSegments} 个段落未生成成功`;
    const maxFailureDetailCount = 200;
    const visibleFailureDetails = failedSegmentDetails.slice(0, maxFailureDetailCount);
    const failedTaskData = await mergeTaskData(taskId, {
      message: failureMessage,
      metadata: {
        ...buildTaskStageRuntimeEvent({
          metadata: taskMetadata,
          title: failureMessage,
          detail: "任务已进入失败收口阶段",
          progress: 90,
          stage: "failed",
          status: "error",
        }).metadata,
        totalLines: script.summary.totalLines,
        dialogueCount: script.summary.dialogueCount,
        narrationCount: script.summary.narrationCount,
        segmentCount: script.segments.length,
        totalSegments,
        failedSegments,
        failedSegmentIds: outstandingFailedSegmentIds,
        failedSegmentDetails: visibleFailureDetails,
        omittedFailureDetails: Math.max(
          failedSegmentDetails.length - visibleFailureDetails.length,
          0
        ),
        isPartialFailure: true,
        reviewSync: {
          issueType: MANUAL_REVIEW_ISSUE_TYPE,
          created: reviewSyncResult.created,
          updated: reviewSyncResult.updated,
          pending: reviewSyncResult.totalPending,
        },
        ...(runtimeMetadata
          ? {
              agentRuntime: runtimeMetadata,
            }
          : {}),
        ...(llmMetrics.submitted > 0
          ? {
              llmMetrics,
            }
          : {}),
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
        status:
          outstandingFailedSegments > 0
            ? "manual_review_pending"
            : "processed",
        metadata: {
          ...bookMetadata,
          scriptGenerationFailedAt: new Date().toISOString(),
          failedSegments: outstandingFailedSegments,
          totalSegments:
            isPartialRun && typeof book?.totalSegments === "number" && book.totalSegments > 0
              ? book.totalSegments
              : totalSegments,
          failedSegmentIds: outstandingFailedSegmentIds,
          scriptFailureIssueType: MANUAL_REVIEW_ISSUE_TYPE,
          scriptFailureManualReviewPending: reviewSyncResult.totalPending,
          scriptFailureManualReviewCreated: reviewSyncResult.created,
          scriptFailureManualReviewUpdated: reviewSyncResult.updated,
          scriptFailureManualReviewResolved: resolvedReviewResult.resolved,
          ...buildBookRuntimePointers({
            runtimeMetadata,
            isFailure: true,
          }),
        },
      },
    });
    return;
  }

  await enqueueRuntimeUpdate({
    progress: 100,
    message: "台本生成完成",
    stageEvent: {
      title: "台本生成完成",
      detail: "所有段落处理完成",
      stage: "completed",
      status: "success",
    },
  });

  const taskData = await mergeTaskData(taskId, {
    message: extraParams.regenerateSegments
      ? "段落重新生成完成"
      : isPartialRun
      ? "增量台本生成完成"
      : "台本生成完成",
    metadata: {
      ...taskMetadata,
      totalLines: script.summary.totalLines,
      dialogueCount: script.summary.dialogueCount,
      narrationCount: script.summary.narrationCount,
      characterCount: Object.keys(script.summary.characterDistribution).length,
      segmentCount: script.segments.length,
      isPartial: isPartialRun,
      regeneratedSegments: extraParams.segmentIds?.length || 0,
      autoResolvedScriptReviewItems: resolvedReviewResult.resolved,
      ...(runtimeMetadata
        ? {
            agentRuntime: runtimeMetadata,
          }
        : {}),
      ...(llmMetrics.submitted > 0
        ? {
            llmMetrics,
          }
        : {}),
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
      status: isPartialRun
        ? resolveBookStatusAfterPartialRun({
            previousStatus: previousBookStatus,
            outstandingFailedSegments,
            isSampleRun,
          })
        : "script_generated",
      metadata: {
        ...bookMetadata,
        ...(isPartialRun
          ? {}
          : {
              scriptGeneratedAt: new Date().toISOString(),
              totalScriptLines: script.summary.totalLines,
              dialogueCount: script.summary.dialogueCount,
              narrationCount: script.summary.narrationCount,
              totalSegments: script.summary.totalSegments,
            }),
        failedSegments: outstandingFailedSegments,
        failedSegmentIds: outstandingFailedSegmentIds,
        ...buildBookRuntimePointers({
          runtimeMetadata,
          isFailure: false,
        }),
      },
    },
  });
}
