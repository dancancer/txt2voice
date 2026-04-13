import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { ExecutionEvent } from "../../protocol/events";
import type { ScriptProductionRuntimeStore } from "../script-production-runtime-store";
import type { RunStageResult, StageRunRecord } from "../run-stage";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import type { QualitySignals } from "../agents/quality-judge-agent";
import type { runPersistStage } from "../stages/run-persist-stage";
import type { runQualityStage } from "../stages/run-quality-stage";
import type { runSegmentRepairStage } from "../stages/run-segment-repair-stage";
import type { runSegmentScriptingStage } from "../stages/run-segment-scripting-stage";
import type {
  CharacterProfileSnapshot,
  ScriptProductionBookSegment,
  SegmentRunResult,
} from "./shared-types";

export interface RunSingleSegmentParams {
  workflowRunId: string;
  bookId: string;
  segment: ScriptProductionBookSegment;
  adapter: LLMAdapter;
  runtimeStore: ScriptProductionRuntimeStore;
  characterProfiles: CharacterProfileSnapshot[];
  characterMap: Map<string, string>;
  createId: () => string;
  now?: () => Date;
  semanticRetryDepth: number;
  inputRefinementDepth: number;
  deferPersist?: boolean;
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
  runSegmentScriptingStage?: typeof runSegmentScriptingStage;
  runSegmentRepairStage?: typeof runSegmentRepairStage;
  runQualityStage?: typeof runQualityStage;
  runPersistStage?: typeof runPersistStage;
  onStageResult?: (result: RunStageResult) => void;
}

export interface SegmentFinalizeSignals {
  failedArtifact?: unknown;
  qualitySignals?: QualitySignals;
}

export interface RecursiveRunSingleSegmentInput {
  segment: ScriptProductionBookSegment;
  semanticRetryDepth: number;
  inputRefinementDepth: number;
  deferPersist?: boolean;
}

export type RecursiveRunSingleSegment = (
  input: RecursiveRunSingleSegmentInput
) => Promise<SegmentRunResult>;
