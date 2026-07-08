// 一旦我被更新，请更新我的开头注释
// input: segment scripting stage 输入
// output: Mastra 单轨台本生成 stage 契约
// pos: agent runtime stage contract
import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { CharacterMemory, SegmentScriptDraft } from "../../context";
import { runMastraSegmentScriptingStage } from "../../mastra/runtime/run-mastra-segment-scripting-stage";
import type { AgentRunRecord } from "../run-agent";
import type { StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";

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

export interface RunSegmentScriptingStageInput
  extends SegmentScriptingRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentText: string;
  fullBookText?: string;
  characterMemory?: CharacterMemory;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
}

export interface SegmentScriptingArtifact {
  kind: "segment-script-draft";
  skillId: string;
  segmentScriptDraft: SegmentScriptDraft;
  memoryVersion?: number;
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

export const runSegmentScriptingStage = runMastraSegmentScriptingStage;
