import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { ExecutionEvent } from "../../protocol/events";
import type { ScriptProductionRuntimeStore } from "../script-production-runtime-store";
import type { RunStageResult, StageRunRecord } from "../run-stage";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import { runCharacterDiscoveryStage } from "../stages/run-character-discovery-stage";
import { runPersistStage } from "../stages/run-persist-stage";
import type {
  CharacterProfileSnapshot,
  ScriptProductionBookSegment,
} from "./shared-types";

export const CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT = 3;

export const buildCharacterDiscoverySampleText = (
  segments: ScriptProductionBookSegment[]
): string =>
  segments
    .slice(0, CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT)
    .map((segment) => segment.content.trim())
    .filter((segmentText) => segmentText.length > 0)
    .join("\n\n");

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
): Promise<{ persistedCharacterCount: number }> => {
  const sampleText = buildCharacterDiscoverySampleText(params.segments);
  const now = params.now ?? (() => new Date());
  const runDiscoveryStage =
    params.runCharacterDiscoveryStage || runCharacterDiscoveryStage;
  const runPersistCommitStage = params.runPersistStage || runPersistStage;

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
    adapter: params.adapter,
    createId: params.createId,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    appendTrace: params.appendTrace,
  });

  await params.runtimeStore.updateStageRun({
    id: discoveryStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "character_discovery",
    status: discoveryStage.status,
    summary: {
      stageId: "character_discovery",
      sampleSegmentCount: Math.min(
        params.segments.length,
        CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT
      ),
      sampleCharCount: sampleText.length,
      artifactKind:
        discoveryStage.status === "completed"
          ? discoveryStage.artifact.kind
          : undefined,
    },
    completedAt: now(),
  });
  params.onStageResult?.({
    id: discoveryStage.stageRunId,
    stageId: "character_discovery",
    status: discoveryStage.status,
    agent: {
      agentId: "character-discovery-agent",
      status: discoveryStage.status,
      output:
        discoveryStage.status === "completed"
          ? {
              skillId: discoveryStage.artifact.skillId,
            }
          : undefined,
      error:
        discoveryStage.status === "completed"
          ? undefined
          : discoveryStage.error,
    },
  });

  if (discoveryStage.status === "completed") {
    await params.runtimeStore.createRuntimeArtifact({
      id: params.createId(),
      workflowRunId: params.workflowRunId,
      stageRunId: discoveryStage.stageRunId,
      artifactKind: discoveryStage.artifact.kind,
      artifactVersion: "v1",
      payload: {
        skillId: discoveryStage.artifact.skillId,
        characterMemoryDraft: discoveryStage.artifact.characterMemoryDraft,
      },
      createdAt: now(),
    });
  }

  if (
    discoveryStage.status !== "completed" ||
    !hasCharacterMemoryDraftContent(discoveryStage.artifact.characterMemoryDraft)
  ) {
    return { persistedCharacterCount: 0 };
  }

  const persistCharacterMemoryStage = await runPersistCommitStage({
    workflowRunId: params.workflowRunId,
    bookId: params.bookId,
    artifacts: [
      {
        kind: "character-memory-draft",
        characterMemory: discoveryStage.artifact.characterMemoryDraft,
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
