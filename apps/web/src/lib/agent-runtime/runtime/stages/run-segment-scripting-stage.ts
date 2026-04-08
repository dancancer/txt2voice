import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  CharacterMemory,
  SegmentScriptDraft,
} from "../../context";
import type { AgentRunRecord } from "../run-agent";
import type { StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";
import { runMastraSegmentScriptingStage as runMastraSegmentScriptingStageDefault } from "../../mastra/runtime/run-mastra-segment-scripting-stage";

interface SegmentScriptingRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface RunSegmentScriptingStageInput extends SegmentScriptingRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentText: string;
  fullBookText?: string;
  characterMemory?: CharacterMemory;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
  runMastraSegmentScriptingStage?: (
    input: RunSegmentScriptingStageInput
  ) => Promise<RunSegmentScriptingStageResult>;
}

export interface SegmentScriptingArtifact {
  kind: "segment-script-draft";
  skillId: string;
  segmentScriptDraft: SegmentScriptDraft;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunSegmentScriptingStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  artifact: SegmentScriptingArtifact;
}

interface RunSegmentScriptingStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
  failedArtifact?: unknown;
}

export type RunSegmentScriptingStageResult =
  | RunSegmentScriptingStageCompletedResult
  | RunSegmentScriptingStageNonCompletedResult;

export const runSegmentScriptingStage = async (
  input: RunSegmentScriptingStageInput
): Promise<RunSegmentScriptingStageResult> => {
  return (input.runMastraSegmentScriptingStage ??
    runMastraSegmentScriptingStageDefault)(input);
};
