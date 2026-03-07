// 一旦我被更新，请更新我的开头注释
// input: 书籍 id/基线采集参数
// output: 质量基线快照与查询结果
// pos: Phase D 基线服务
import { randomUUID } from "crypto";
import { ValidationError } from "@/lib/error-handler";
import prisma, { Prisma } from "@/lib/prisma";
import { formatProcessingTask, jsonMetadata, jsonObject } from "@/lib/processing-task-utils";

const DEFAULT_BASELINE_LABEL = "s30_1_pre_signal_supply";
const DEFAULT_SAMPLE_SOURCE_PATH = "uploads/sample.txt";
const MAX_BASELINE_HISTORY = 12;

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

const asJsonRecord = (value: unknown): Prisma.InputJsonObject => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
};

const isCalibrationEvalTask = (metadata: Record<string, unknown> | null): boolean => {
  return metadata?.source === "calibration_eval";
};

const readBaselineSnapshots = (metadata: Prisma.JsonValue | null | undefined) => {
  const qualityCheck = asRecord(jsonObject(metadata).qualityCheck) || {};
  const baselineSnapshots = qualityCheck.baselineSnapshots;
  if (!Array.isArray(baselineSnapshots)) {
    return [] as Record<string, unknown>[];
  }
  return baselineSnapshots.filter(
    (snapshot): snapshot is Record<string, unknown> => Boolean(asRecord(snapshot))
  );
};

const buildCurrentSummary = ({
  latestTask,
  pendingReviewCount,
  counts,
}: {
  latestTask: ReturnType<typeof formatProcessingTask> | null;
  pendingReviewCount: number;
  counts: {
    qualityCheckCount: number;
    audioFileCount: number;
    scriptSentenceCount: number;
  };
}) => {
  const metadata = latestTask?.metadata || null;
  return {
    taskId: latestTask?.id || null,
    source: asString(metadata?.source),
    completedAt: latestTask?.completedAt?.toISOString() || null,
    passCount: Number(metadata?.passCount || 0),
    repairCount: Number(metadata?.repairCount || 0),
    manualReviewCount: Number(metadata?.manualReviewCount || 0),
    hardFailCount: Number(metadata?.hardFailCount || 0),
    issueTypeCounts: asRecord(metadata?.issueTypeCounts) || {},
    q0q3Summary: asRecord(metadata?.q0q3Summary) || null,
    signalSourceSummary: asRecord(metadata?.signalSourceSummary) || null,
    pendingReviewCount,
    counts,
  };
};

const findLatestCompletedQualityTask = async ({
  bookId,
  taskId,
}: {
  bookId: string;
  taskId?: string;
}) => {
  const tasks = taskId
    ? await prisma.processingTask.findMany({
        where: {
          id: taskId,
          bookId,
          taskType: "QUALITY_CHECK",
          status: "completed",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      })
    : await prisma.processingTask.findMany({
        where: {
          bookId,
          taskType: "QUALITY_CHECK",
          status: "completed",
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      });

  const formattedTasks = tasks.map((task) => formatProcessingTask(task));
  return (
    formattedTasks.find((task) => !isCalibrationEvalTask(task.metadata)) || null
  );
};

export interface CaptureQualityBaselinePayload {
  label: string;
  sampleSourcePath: string;
  capturedBy: string | null;
  notes: string | null;
  taskId?: string;
}

export const parseCaptureQualityBaselinePayload = (
  body: unknown
): CaptureQualityBaselinePayload => {
  const payload = asRecord(body) || {};
  return {
    label: asString(payload.label) || DEFAULT_BASELINE_LABEL,
    sampleSourcePath:
      asString(payload.sampleSourcePath) || DEFAULT_SAMPLE_SOURCE_PATH,
    capturedBy: asString(payload.capturedBy) || asString(payload.operator),
    notes: asString(payload.notes) || asString(payload.note),
    taskId: asString(payload.taskId) || undefined,
  };
};

export const getQualityBaselineStateForBook = async ({
  bookId,
  taskId,
}: {
  bookId: string;
  taskId?: string;
}) => {
  const [book, pendingReviewCount, latestTask] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        metadata: true,
        _count: {
          select: {
            qualityCheckResults: true,
            audioFiles: true,
            scriptSentences: true,
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
    findLatestCompletedQualityTask({
      bookId,
      taskId,
    }),
  ]);

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  if (!latestTask) {
    throw new ValidationError("没有可用于固化基线的已完成质检任务");
  }

  const baselineSnapshots = readBaselineSnapshots(book.metadata);

  return {
    baselines: baselineSnapshots,
    currentSummary: buildCurrentSummary({
      latestTask,
      pendingReviewCount,
      counts: {
        qualityCheckCount: book._count.qualityCheckResults,
        audioFileCount: book._count.audioFiles,
        scriptSentenceCount: book._count.scriptSentences,
      },
    }),
    bookMetadata: book.metadata,
    latestTask,
  };
};

export const captureQualityBaselineForBook = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: CaptureQualityBaselinePayload;
}) => {
  const state = await getQualityBaselineStateForBook({
    bookId,
    taskId: payload.taskId,
  });

  const snapshot = {
    id: randomUUID(),
    label: payload.label,
    sampleSourcePath: payload.sampleSourcePath,
    capturedBy: payload.capturedBy,
    notes: payload.notes,
    capturedAt: new Date().toISOString(),
    summary: state.currentSummary,
  };

  const nextSnapshots = [snapshot, ...state.baselines].slice(0, MAX_BASELINE_HISTORY);
  const rootMetadata = jsonObject(state.bookMetadata);
  const qualityCheck = asRecord(rootMetadata.qualityCheck) || {};

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: asJsonRecord({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheck,
          latestBaselineSnapshot: snapshot,
          baselineSnapshots: nextSnapshots,
        },
      }),
    },
  });

  return {
    snapshot,
    currentSummary: state.currentSummary,
    baselineCount: nextSnapshots.length,
  };
};
