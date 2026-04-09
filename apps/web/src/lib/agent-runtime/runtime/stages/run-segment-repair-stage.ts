import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  CharacterMemory,
  RepairDecision,
  SegmentScriptDraft,
  ValidationReport,
} from "../../context";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import type { StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";
import { runMastraSegmentRepairStage as runMastraSegmentRepairStageDefault } from "../../mastra/runtime/run-mastra-segment-repair-stage";

interface SegmentRepairRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export type SegmentRepairFailureKind =
  | "format_repair"
  | "semantic_retry"
  | "input_refinement";

export interface RunSegmentRepairStageInput extends SegmentRepairRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentText: string;
  characterMemory?: CharacterMemory;
  failureKind: SegmentRepairFailureKind;
  failedArtifact: unknown;
  validationReport?: ValidationReport;
  repairDepth: number;
  maxRepairDepth?: number;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
  runMastraSegmentRepairStage?: (
    input: RunSegmentRepairStageInput
  ) => Promise<RunSegmentRepairStageResult>;
}

export interface SegmentRepairArtifact {
  kind: "segment-script-draft";
  skillId: string;
  segmentScriptDraft: SegmentScriptDraft;
  memoryVersion?: number;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunSegmentRepairStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  decision: RepairDecision;
  artifact?: SegmentRepairArtifact;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunSegmentRepairStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
  failedArtifact?: unknown;
}

export type RunSegmentRepairStageResult =
  | RunSegmentRepairStageCompletedResult
  | RunSegmentRepairStageNonCompletedResult;

export const runSegmentRepairStage = async (
  input: RunSegmentRepairStageInput
): Promise<RunSegmentRepairStageResult> => {
  return (input.runMastraSegmentRepairStage ??
    runMastraSegmentRepairStageDefault)(input);
};
