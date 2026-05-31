// 一旦我被更新，请更新我的开头注释
// input: 自动编排配置参数
// output: 自动编排类型与通用工具
// pos: 自动编排共享模块
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { QualityCheckTaskType } from "@/lib/quality-check-runner";
import type { ScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/types";
import type { TextProcessingOptions } from "@/lib/text-processor";
import type { Prisma } from "@/lib/prisma";

export type AutoPipelineStage =
  | "text_processing"
  | "script_generation"
  | "audio_generation"
  | "quality_check";

export type AutoPipelineDecisionAction =
  | "run"
  | "skip"
  | "retry"
  | "manual_review"
  | "fail";

export type AutoPipelineStageStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export interface AutoPipelineStageState {
  taskId: string | null;
  status: AutoPipelineStageStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface AutoPipelineSourceFingerprint {
  uploadedFilePath?: string | null;
  originalFilename?: string | null;
  fileSize?: number | string | null;
  contentHash?: string | null;
  optionsHash?: string | null;
}

export interface AutoPipelineStageVersion {
  version: string;
  inputs?: Record<string, unknown>;
}

export interface AutoPipelineCheckpoint {
  stage: AutoPipelineStage;
  sourceFingerprint: AutoPipelineSourceFingerprint;
  stageVersion: AutoPipelineStageVersion;
  artifactHash: string;
  taskId: string;
  completedAt: string;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
}

export type AutoPipelineCheckpointMap = Partial<
  Record<AutoPipelineStage, AutoPipelineCheckpoint>
>;

export interface AutoPipelineCheckpointPatch {
  checkpoints: AutoPipelineCheckpointMap;
}

export interface AutoPipelineDecision {
  action: AutoPipelineDecisionAction;
  stage: AutoPipelineStage;
  reason: string;
  retryable: boolean;
  manualReviewRequired: boolean;
}

interface AutoPipelineAudioOptions {
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

interface AutoPipelineQualityOptions {
  enabled?: boolean;
  type?: QualityCheckTaskType;
  chapterId?: string | null;
  syncSignalsBeforeRun?: boolean;
  forceSignalResync?: boolean;
}

export interface AutoPipelineOptions {
  textProcessing?: TextProcessingOptions;
  scriptGeneration?: Partial<ScriptGenerationOptions>;
  audioGeneration?: AutoPipelineAudioOptions;
  qualityCheck?: AutoPipelineQualityOptions;
}

export interface AutoPipelineRunParams {
  taskId: string;
  bookId: string;
  options?: AutoPipelineOptions;
}

export const AUTO_PIPELINE_STAGE_ORDER: AutoPipelineStage[] = [
  "text_processing",
  "script_generation",
  "audio_generation",
  "quality_check",
];

export const STAGE_LABEL: Record<AutoPipelineStage, string> = {
  text_processing: "文本处理",
  script_generation: "台本生成",
  audio_generation: "音频生成",
  quality_check: "质量检查",
};

const QUALITY_CHECK_DEFAULT: Required<AutoPipelineQualityOptions> = {
  enabled: true,
  type: "book",
  chapterId: null,
  syncSignalsBeforeRun: true,
  forceSignalResync: false,
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const defaultStageState = (): AutoPipelineStageState => ({
  taskId: null,
  status: "pending",
  startedAt: null,
  completedAt: null,
  error: null,
});

export const createStageStateMap = (): Record<
  AutoPipelineStage,
  AutoPipelineStageState
> => ({
  text_processing: defaultStageState(),
  script_generation: defaultStageState(),
  audio_generation: defaultStageState(),
  quality_check: defaultStageState(),
});

export const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

export const normalizeOptions = (
  options: AutoPipelineOptions | undefined
): Required<AutoPipelineOptions> => {
  const textProcessing = options?.textProcessing || {};
  const scriptGeneration = options?.scriptGeneration || {};
  const audioGeneration: AutoPipelineAudioOptions = {
    autoMerge: options?.audioGeneration?.autoMerge ?? false,
    options: options?.audioGeneration?.options || {},
  };
  const qualityCheck: Required<AutoPipelineQualityOptions> = {
    enabled: options?.qualityCheck?.enabled ?? QUALITY_CHECK_DEFAULT.enabled,
    type:
      options?.qualityCheck?.type && options.qualityCheck.type !== "batch"
        ? options.qualityCheck.type
        : QUALITY_CHECK_DEFAULT.type,
    chapterId: asString(options?.qualityCheck?.chapterId) || null,
    syncSignalsBeforeRun:
      options?.qualityCheck?.syncSignalsBeforeRun ??
      QUALITY_CHECK_DEFAULT.syncSignalsBeforeRun,
    forceSignalResync:
      options?.qualityCheck?.forceSignalResync ??
      QUALITY_CHECK_DEFAULT.forceSignalResync,
  };

  return {
    textProcessing,
    scriptGeneration,
    audioGeneration,
    qualityCheck,
  };
};

export const getStageTaskProgressRange = (
  stage: AutoPipelineStage,
  qualityCheckEnabled: boolean
): { start: number; end: number } => {
  if (stage === "text_processing") {
    return { start: 5, end: 25 };
  }
  if (stage === "script_generation") {
    return { start: 25, end: 50 };
  }
  if (stage === "audio_generation") {
    return { start: 50, end: qualityCheckEnabled ? 78 : 95 };
  }
  return { start: 78, end: 95 };
};

export const parseAutoPipelineOptions = (
  rawOptions: unknown
): AutoPipelineOptions => {
  const root = asRecord(rawOptions) || {};
  const textProcessing = asRecord(root.textProcessing) || {};
  const scriptGeneration = asRecord(root.scriptGeneration) || {};
  const audioGenerationRoot = asRecord(root.audioGeneration) || {};
  const qualityCheckRoot = asRecord(root.qualityCheck) || {};

  const qualityType =
    qualityCheckRoot.type === "book" || qualityCheckRoot.type === "chapter"
      ? qualityCheckRoot.type
      : undefined;
  const qualityChapterId = asString(qualityCheckRoot.chapterId);

  return {
    textProcessing: {
      ...(typeof textProcessing.maxSegmentLength === "number"
        ? {
            maxSegmentLength: Math.max(100, Math.floor(textProcessing.maxSegmentLength)),
          }
        : {}),
      ...(typeof textProcessing.minSegmentLength === "number"
        ? {
            minSegmentLength: Math.max(10, Math.floor(textProcessing.minSegmentLength)),
          }
        : {}),
      ...(typeof textProcessing.preserveFormatting === "boolean"
        ? {
            preserveFormatting: textProcessing.preserveFormatting,
          }
        : {}),
    },
    scriptGeneration: scriptGeneration as Partial<ScriptGenerationOptions>,
    audioGeneration: {
      ...(typeof audioGenerationRoot.autoMerge === "boolean"
        ? {
            autoMerge: audioGenerationRoot.autoMerge,
          }
        : {}),
      options: (asRecord(audioGenerationRoot.options) || {}) as AudioGenerationOptions,
    },
    qualityCheck: {
      ...(typeof qualityCheckRoot.enabled === "boolean"
        ? {
            enabled: qualityCheckRoot.enabled,
          }
        : {}),
      ...(qualityType
        ? {
            type: qualityType,
          }
        : {}),
      ...(qualityType === "chapter" && qualityChapterId
        ? {
            chapterId: qualityChapterId,
          }
        : {}),
      ...(typeof qualityCheckRoot.syncSignalsBeforeRun === "boolean"
        ? {
            syncSignalsBeforeRun: qualityCheckRoot.syncSignalsBeforeRun,
          }
        : {}),
      ...(typeof qualityCheckRoot.forceSignalResync === "boolean"
        ? {
            forceSignalResync: qualityCheckRoot.forceSignalResync,
          }
        : {}),
    },
  };
};
