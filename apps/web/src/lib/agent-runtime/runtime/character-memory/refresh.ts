import { runCharacterDiscoveryPass } from "../script-production/run-character-discovery-pass";
import type {
  CharacterProfileSnapshot,
  ScriptProductionBookSegment,
} from "../script-production/shared-types";
import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { ScriptProductionRuntimeStore } from "../script-production-runtime-store";
import type { ExecutionEvent } from "../../protocol/events";
import type { RunStageResult, StageRunRecord } from "../run-stage";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import type { runCharacterDiscoveryStage } from "../stages/run-character-discovery-stage";
import type { runPersistStage } from "../stages/run-persist-stage";

export interface RunIncrementalCharacterDiscoveryRefreshParams {
  workflowRunId: string;
  bookId: string;
  segment: ScriptProductionBookSegment;
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

export const runIncrementalCharacterDiscoveryRefresh = async (
  params: RunIncrementalCharacterDiscoveryRefreshParams
) =>
  runCharacterDiscoveryPass({
    workflowRunId: params.workflowRunId,
    bookId: params.bookId,
    segments: [params.segment],
    adapter: params.adapter,
    runtimeStore: params.runtimeStore,
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
    onStageResult: params.onStageResult,
    runCharacterDiscoveryStage: params.runCharacterDiscoveryStage,
    runPersistStage: params.runPersistStage,
  });
