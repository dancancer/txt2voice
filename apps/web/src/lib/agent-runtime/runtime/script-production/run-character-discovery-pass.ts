import type { LLMAdapter } from "../../adapters/llm-adapter";
import { buildCharacterMemoryFromProfiles } from "../../context";
import type { ExecutionEvent } from "../../protocol/events";
import type { ScriptProductionRuntimeStore } from "../script-production-runtime-store";
import type { RunStageResult, StageRunRecord } from "../run-stage";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import { createFailureDetail } from "../script-production-runtime-helpers";
import { runCharacterDiscoveryStage } from "../stages/run-character-discovery-stage";
import { runPersistStage } from "../stages/run-persist-stage";
import type {
  CharacterProfileSnapshot,
  SegmentFailureResult,
  ScriptProductionBookSegment,
} from "./shared-types";

export const CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT = 8;
const CHARACTER_DISCOVERY_TOTAL_SAMPLE_CHAR_LIMIT = 2400;
const CHARACTER_DISCOVERY_MIN_SEGMENT_CHAR_LIMIT = 180;
const CHARACTER_DISCOVERY_MAX_SEGMENT_CHAR_LIMIT = 640;

const preserveSampleCoverage = (value: string, targetLength: number): string => {
  if (value.length <= targetLength) {
    return value;
  }

  if (targetLength <= 24) {
    return value.slice(0, targetLength);
  }

  const separator = "\n...\n";
  const separatorBudget = separator.length * 2;
  const contentLength = Math.max(targetLength - separatorBudget, 3);
  const headLength = Math.ceil(contentLength / 3);
  const middleLength = Math.floor(contentLength / 3);
  const tailLength = Math.max(contentLength - headLength - middleLength, 1);
  const middleStart = Math.max(
    Math.floor((value.length - middleLength) / 2),
    headLength
  );
  const middleEnd = middleStart + middleLength;

  return `${value.slice(0, headLength)}${separator}${value.slice(
    middleStart,
    middleEnd
  )}${separator}${value.slice(value.length - tailLength)}`;
};

const formatDiscoverySampleSegment = (
  segment: ScriptProductionBookSegment,
  targetLength: number
) => {
  const chapterId =
    typeof segment.chapterId === "string" && segment.chapterId.length > 0
      ? segment.chapterId
      : "unknown";
  const orderIndex =
    typeof segment.orderIndex === "number" ? segment.orderIndex : -1;
  const segmentText = preserveSampleCoverage(segment.content.trim(), targetLength);

  return [
    `[segment id=${segment.id} chapter=${chapterId} order=${orderIndex}]`,
    segmentText,
  ].join("\n");
};

const resolvePerSegmentSampleLimit = (segmentCount: number) => {
  const budgetPerSegment = Math.floor(
    CHARACTER_DISCOVERY_TOTAL_SAMPLE_CHAR_LIMIT / Math.max(segmentCount, 1)
  );

  return Math.max(
    CHARACTER_DISCOVERY_MIN_SEGMENT_CHAR_LIMIT,
    Math.min(CHARACTER_DISCOVERY_MAX_SEGMENT_CHAR_LIMIT, budgetPerSegment)
  );
};

const selectCharacterDiscoverySampleIndexes = (
  segmentCount: number
): number[] => {
  if (segmentCount <= CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT) {
    return Array.from({ length: segmentCount }, (_, index) => index);
  }

  const lastIndex = segmentCount - 1;
  const indexes = new Set<number>();

  for (
    let sampleIndex = 0;
    sampleIndex < CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT;
    sampleIndex += 1
  ) {
    indexes.add(
      Math.round(
        (sampleIndex * lastIndex) / (CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT - 1)
      )
    );
  }

  return [...indexes].sort((left, right) => left - right);
};

export const buildCharacterDiscoverySampleText = (
  segments: ScriptProductionBookSegment[]
): string => {
  const selectedSegments = selectCharacterDiscoverySampleIndexes(segments.length)
    .map((index) => segments[index])
    .filter(
      (segment): segment is ScriptProductionBookSegment =>
        typeof segment?.content === "string"
    );
  const perSegmentLimit = resolvePerSegmentSampleLimit(selectedSegments.length);

  return selectedSegments
    .map((segment) => formatDiscoverySampleSegment(segment, perSegmentLimit))
    .filter((segmentText) => segmentText.length > 0)
    .join("\n\n");
};

export const hasCharacterMemoryDraftContent = (draft: {
  canonicalIdentities?: unknown[];
  aliasEvidence?: unknown[];
  assertedFacts?: Record<string, unknown>;
  inferredHints?: Record<string, unknown>;
}): boolean =>
  (Array.isArray(draft.canonicalIdentities) &&
    draft.canonicalIdentities.length > 0) ||
  (Array.isArray(draft.aliasEvidence) && draft.aliasEvidence.length > 0) ||
  Object.keys(draft.assertedFacts || {}).length > 0 ||
  Object.keys(draft.inferredHints || {}).length > 0;

interface RunCharacterDiscoveryPassParams {
  workflowRunId: string;
  bookId: string;
  segments: ScriptProductionBookSegment[];
  adapter: LLMAdapter;
  runtimeStore: ScriptProductionRuntimeStore;
  characterProfiles: CharacterProfileSnapshot[];
  characterMap: Map<string, string>;
  createId: () => string;
  now?: () => Date;
  createStageRun: (record: StageRunRecord) => Promise<void>;
  updateStageRun: (record: StageRunRecord) => Promise<void>;
  createAgentRun: (record: AgentRunRecord) => Promise<void>;
  updateAgentRun: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void>;
  createToolCall: (
    record: ToolCallRecord & { createdAt?: Date }
  ) => Promise<void>;
  updateToolCall: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void>;
  appendTrace: (event: ExecutionEvent) => Promise<void>;
  onStageResult?: (result: RunStageResult) => void;
  runCharacterDiscoveryStage?: typeof runCharacterDiscoveryStage;
  runPersistStage?: typeof runPersistStage;
}

export const runCharacterDiscoveryPass = async (
  params: RunCharacterDiscoveryPassParams
): Promise<{
  persistedCharacterCount: number;
  failure?: SegmentFailureResult["failure"];
}> => {
  const sampleText = buildCharacterDiscoverySampleText(params.segments);
  const now = params.now ?? (() => new Date());
  const runDiscoveryStage =
    params.runCharacterDiscoveryStage || runCharacterDiscoveryStage;
  const runPersistCommitStage = params.runPersistStage || runPersistStage;
  const characterMemory = buildCharacterMemoryFromProfiles(
    params.characterProfiles
  );

  if (sampleText.length === 0) {
    return { persistedCharacterCount: 0 };
  }

  await params.appendTrace({
    id: params.createId(),
    kind: "context_built",
    createdAt: (params.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.workflowRunId,
    status: "completed",
    payload: {
      stageId: "character_discovery",
      segmentCount: Math.min(
        params.segments.length,
        CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT
      ),
      charCount: sampleText.length,
    },
  });

  const discoveryStage = await runDiscoveryStage({
    workflowRunId: params.workflowRunId,
    segmentText: sampleText,
    characterMemory,
    adapter: params.adapter,
    createId: params.createId,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    appendTrace: params.appendTrace,
  });

  const discoveryFailure =
    discoveryStage.status !== "completed"
      ? createFailureDetail({
          segment: params.segments[0]!,
          stage: "character_discovery",
          errorCode: "CHARACTER_DISCOVERY_FAILED",
          message: discoveryStage.error || "character_discovery_failed",
          retryable: discoveryStage.status === "retrying",
        })
      : null;
  const discoveryStageStatus = discoveryFailure
    ? discoveryStage.status === "retrying"
      ? "retrying"
      : "failed"
    : discoveryStage.status;
  const discoveryStageError = discoveryFailure?.message;

  await params.runtimeStore.updateStageRun({
    id: discoveryStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "character_discovery",
    status: discoveryStageStatus,
    summary: {
      stageId: "character_discovery",
      sampleSegmentCount: Math.min(
        params.segments.length,
        CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT
      ),
      sampleCharCount: sampleText.length,
      artifactKind:
        !discoveryFailure && discoveryStage.status === "completed"
          ? discoveryStage.artifact.kind
          : undefined,
      skillMetadata:
        !discoveryFailure && discoveryStage.status === "completed"
          ? discoveryStage.artifact.skillMetadata
          : undefined,
      errorCode: discoveryFailure?.errorCode,
      message: discoveryStageError,
    },
    completedAt: now(),
  });
  params.onStageResult?.({
    id: discoveryStage.stageRunId,
    stageId: "character_discovery",
    status: discoveryStageStatus,
    agent: {
      agentId: "character-discovery-agent",
      status: discoveryStageStatus,
      output:
        !discoveryFailure && discoveryStage.status === "completed"
          ? {
              skillId: discoveryStage.artifact.skillId,
              skillMetadata: discoveryStage.artifact.skillMetadata,
            }
          : undefined,
      error: discoveryStageError,
    },
  });

  if (!discoveryFailure && discoveryStage.status === "completed") {
    await params.runtimeStore.createRuntimeArtifact({
      id: params.createId(),
      workflowRunId: params.workflowRunId,
      stageRunId: discoveryStage.stageRunId,
      artifactKind: discoveryStage.artifact.kind,
      artifactVersion: "v1",
      payload: {
        skillId: discoveryStage.artifact.skillId,
        skillMetadata: discoveryStage.artifact.skillMetadata,
        characterMemoryDraft: discoveryStage.artifact.characterMemoryDraft,
      },
      createdAt: now(),
    });
  }

  if (discoveryFailure) {
    return {
      persistedCharacterCount: 0,
      failure: discoveryFailure,
    };
  }

  const completedDiscoveryStage = discoveryStage as Extract<
    typeof discoveryStage,
    { status: "completed" }
  >;

  if (
    !hasCharacterMemoryDraftContent(
      completedDiscoveryStage.artifact.characterMemoryDraft
    )
  ) {
    return { persistedCharacterCount: 0 };
  }

  const persistCharacterMemoryStage = await runPersistCommitStage({
    workflowRunId: params.workflowRunId,
    bookId: params.bookId,
    artifacts: [
      {
        kind: "character-memory-draft",
        characterMemory: completedDiscoveryStage.artifact.characterMemoryDraft,
      },
    ],
    characterProfiles: params.characterProfiles,
    characterMap: params.characterMap,
    createId: params.createId,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    createAgentRun: params.createAgentRun,
    updateAgentRun: params.updateAgentRun,
    createToolCall: params.createToolCall,
    updateToolCall: params.updateToolCall,
    appendTrace: params.appendTrace,
  });

  await params.runtimeStore.updateStageRun({
    id: persistCharacterMemoryStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "persist",
    status: persistCharacterMemoryStage.status,
    summary: {
      stageId: "persist",
      artifactKind: "character-memory-draft",
      persistedCharacterCount:
        persistCharacterMemoryStage.status === "completed"
          ? persistCharacterMemoryStage.artifact.persistedCharacterCount
          : 0,
      persistedSentenceCount:
        persistCharacterMemoryStage.status === "completed"
          ? persistCharacterMemoryStage.artifact.persistedSentenceCount
          : 0,
    },
    completedAt: now(),
  });
  params.onStageResult?.({
    id: persistCharacterMemoryStage.stageRunId,
    stageId: "persist",
    status: persistCharacterMemoryStage.status,
    agent: {
      runId: persistCharacterMemoryStage.agentRunId,
      agentId: "persist-agent",
      status: persistCharacterMemoryStage.status,
      output:
        persistCharacterMemoryStage.status === "completed"
          ? {
              persistedCharacterCount:
                persistCharacterMemoryStage.artifact.persistedCharacterCount,
              persistedSentenceCount:
                persistCharacterMemoryStage.artifact.persistedSentenceCount,
            }
          : undefined,
      error:
        persistCharacterMemoryStage.status === "completed"
          ? undefined
          : persistCharacterMemoryStage.error,
    },
  });

  if (persistCharacterMemoryStage.status !== "completed") {
    return { persistedCharacterCount: 0 };
  }

  await params.appendTrace({
    id: params.createId(),
    kind: "artifact_committed",
    createdAt: now().toISOString(),
    workflowRunId: params.workflowRunId,
    stageRunId: persistCharacterMemoryStage.stageRunId,
    agentRunId: persistCharacterMemoryStage.agentRunId,
    status: "completed",
    payload: {
      artifactKind: "character-memory-draft",
      persistedCharacterCount:
        persistCharacterMemoryStage.artifact.persistedCharacterCount,
      persistedSentenceCount:
        persistCharacterMemoryStage.artifact.persistedSentenceCount,
    },
  });

  return {
    persistedCharacterCount:
      persistCharacterMemoryStage.artifact.persistedCharacterCount,
  };
};
