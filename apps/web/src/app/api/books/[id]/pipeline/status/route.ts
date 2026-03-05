// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { formatProcessingTask, jsonMetadata, jsonObject } from "@/lib/processing-task-utils";

const PIPELINE_STAGE_ORDER = [
  "text_processing",
  "script_generation",
  "audio_generation",
  "quality_check",
] as const;

type PipelineStageKey = (typeof PIPELINE_STAGE_ORDER)[number];

const STAGE_LABEL: Record<PipelineStageKey, string> = {
  text_processing: "文本处理",
  script_generation: "台本生成",
  audio_generation: "音频生成",
  quality_check: "质量检查",
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const extractStageTaskId = (
  stageValue: Record<string, unknown> | null
): string | null => {
  const stageTaskId = asString(stageValue?.taskId);
  return stageTaskId || null;
};

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);
    const taskId = asString(searchParams.get("taskId"));

    const [book, pendingReviewCount] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: {
          id: true,
          status: true,
          metadata: true,
          _count: {
            select: {
              chapters: true,
              textSegments: true,
              scriptSentences: true,
              audioFiles: true,
              qualityCheckResults: true,
            },
          },
        },
      }),
      prisma.manualReviewItem.count({
        where: {
          bookId,
          status: "pending",
        },
      }),
    ]);

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const latestAutoPipelineTask = taskId
      ? await prisma.processingTask.findFirst({
          where: {
            id: taskId,
            bookId,
            taskType: "AUTO_PIPELINE",
          },
        })
      : await prisma.processingTask.findFirst({
          where: {
            bookId,
            taskType: "AUTO_PIPELINE",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

    if (taskId && !latestAutoPipelineTask) {
      throw new ValidationError("自动编排任务不存在或不属于当前书籍");
    }

    const latestQualityTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "QUALITY_CHECK",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestAutoPipelineTask) {
      return NextResponse.json({
        success: true,
        data: {
          bookStatus: book.status,
          currentStage: null,
          pendingReviewCount,
          pipelineTask: null,
          stages: PIPELINE_STAGE_ORDER.map((stage) => ({
            key: stage,
            label: STAGE_LABEL[stage],
            taskId: null,
            status: "pending",
            progress: 0,
            message: null,
            error: null,
            startedAt: null,
            completedAt: null,
          })),
          latestQualityTask: latestQualityTask
            ? formatProcessingTask(latestQualityTask)
            : null,
          qualitySummary: jsonMetadata(jsonObject(book.metadata).qualityCheck),
          autoPipelineSummary: jsonMetadata(jsonObject(book.metadata).autoPipeline),
          counts: book._count,
        },
      });
    }

    const formattedPipelineTask = formatProcessingTask(latestAutoPipelineTask);
    const pipelineMetadata = asRecord(formattedPipelineTask.metadata) || {};
    const stageRecord = asRecord(pipelineMetadata.stages) || {};

    const stageTaskIds = PIPELINE_STAGE_ORDER.map((stage) => {
      const stageValue = asRecord(stageRecord[stage]);
      return extractStageTaskId(stageValue);
    }).filter((value): value is string => Boolean(value));

    const stageTasks = stageTaskIds.length
      ? await prisma.processingTask.findMany({
          where: {
            id: {
              in: stageTaskIds,
            },
          },
        })
      : [];

    const stageTaskMap = new Map(
      stageTasks.map((task) => [task.id, formatProcessingTask(task)])
    );

    const stages = PIPELINE_STAGE_ORDER.map((stage) => {
      const stageValue = asRecord(stageRecord[stage]);
      const stageTaskId = extractStageTaskId(stageValue);
      const stageTask = stageTaskId ? stageTaskMap.get(stageTaskId) : null;
      const stageStatus = asString(stageValue?.status) || stageTask?.status || "pending";
      const stageProgress =
        stageTask?.progress || (stageStatus === "completed" ? 100 : 0);

      return {
        key: stage,
        label: STAGE_LABEL[stage],
        taskId: stageTaskId,
        status: stageStatus,
        progress: stageProgress,
        message: stageTask?.message || asString(stageValue?.message),
        error: stageTask?.error || asString(stageValue?.error),
        startedAt:
          asString(stageValue?.startedAt) ||
          (stageTask?.startedAt ? stageTask.startedAt.toISOString() : null),
        completedAt:
          asString(stageValue?.completedAt) ||
          (stageTask?.completedAt ? stageTask.completedAt.toISOString() : null),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        bookStatus: book.status,
        currentStage: asString(pipelineMetadata.currentStage),
        pendingReviewCount,
        pipelineTask: formattedPipelineTask,
        stages,
        latestQualityTask: latestQualityTask ? formatProcessingTask(latestQualityTask) : null,
        qualitySummary: jsonMetadata(jsonObject(book.metadata).qualityCheck),
        autoPipelineSummary: jsonMetadata(jsonObject(book.metadata).autoPipeline),
        counts: book._count,
      },
    });
  }
);
