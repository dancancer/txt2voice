import { createHash } from "crypto";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { QualityCheckTaskType } from "@/lib/quality-check-runner";
import type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync-runner";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";

interface ScriptDedupeInput {
  bookId: string;
  extraParams?: ScriptGenerationExtraParams;
}

interface AudioDedupeInput {
  bookId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  options?: AudioGenerationOptions;
}

interface QualityDedupeInput {
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}

interface SignalSyncDedupeInput {
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  forceResync?: boolean;
}

interface AutoPipelineDedupeInput {
  bookId: string;
  options?: AutoPipelineOptions;
  mode?: string;
  triggerSource?: string;
  allowReuseRunningTask?: boolean;
}

const hashScope = (payload: unknown): string => {
  return createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
};

export const buildScriptDedupeKey = (input: ScriptDedupeInput): string => {
  const normalized = {
    startFromSegmentId: input.extraParams?.startFromSegmentId || null,
    startFromOrderIndex: input.extraParams?.startFromOrderIndex ?? null,
    regenerateSegments: Boolean(input.extraParams?.regenerateSegments),
    segmentIds: (input.extraParams?.segmentIds || []).slice().sort(),
    limitToSegments: input.extraParams?.limitToSegments ?? null,
  };

  return `script:${input.bookId}:${hashScope(normalized)}`;
};

export const buildAudioDedupeKey = (input: AudioDedupeInput): string => {
  const normalized = {
    type: input.type,
    chapterId: input.chapterId || null,
    scriptSentenceIds: (input.scriptSentenceIds || []).slice().sort(),
    voiceProfileId: input.voiceProfileId || null,
    provider: input.options?.provider || null,
    routerPolicyVersion: input.options?.routerPolicyVersion || null,
  };

  return `audio:${input.bookId}:${hashScope(normalized)}`;
};

export const buildQualityDedupeKey = (input: QualityDedupeInput): string => {
  const normalized = {
    type: input.type,
    chapterId: input.chapterId || null,
    audioFileIds: (input.audioFileIds || []).slice().sort(),
  };

  return `quality:${input.bookId}:${hashScope(normalized)}`;
};

export const buildSignalSyncDedupeKey = (input: SignalSyncDedupeInput): string => {
  const normalized = {
    type: input.type,
    chapterId: input.chapterId || null,
    audioFileIds: (input.audioFileIds || []).slice().sort(),
    forceResync: Boolean(input.forceResync),
  };

  return `signal_sync:${input.bookId}:${hashScope(normalized)}`;
};

export const buildAutoPipelineDedupeKey = (
  input: AutoPipelineDedupeInput
): string => {
  const normalized = {
    options: input.options || {},
    mode: input.mode || "pipeline",
    triggerSource: input.triggerSource || null,
    allowReuseRunningTask: input.allowReuseRunningTask ?? true,
  };

  return `auto_pipeline:${input.bookId}:${hashScope(normalized)}`;
};
