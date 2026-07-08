// 一旦我被更新，请更新我的开头注释
// input: character discovery stage 输入
// output: Mastra 单轨角色发现 stage 契约
// pos: agent runtime stage contract
import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { CharacterMemory, MemoryPatch } from "../../context";
import { runMastraCharacterDiscoveryStage } from "../../mastra/runtime/run-mastra-character-discovery-stage";
import type { StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";

interface CharacterDiscoveryRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export interface RunCharacterDiscoveryStageInput
  extends CharacterDiscoveryRuntimeDeps {
  workflowRunId: string;
  segmentText: string;
  fullBookText?: string;
  characterMemory?: CharacterMemory;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
}

export interface CharacterDiscoveryArtifact {
  kind: "character-memory-draft";
  skillId: "character-extraction";
  characterMemoryDraft: MemoryPatch;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunCharacterDiscoveryStageCompletedResult {
  stageRunId: string;
  status: "completed";
  artifact: CharacterDiscoveryArtifact;
}

interface RunCharacterDiscoveryStageNonCompletedResult {
  stageRunId: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
  failedArtifact?: unknown;
}

export type RunCharacterDiscoveryStageResult =
  | RunCharacterDiscoveryStageCompletedResult
  | RunCharacterDiscoveryStageNonCompletedResult;

export const runCharacterDiscoveryStage = runMastraCharacterDiscoveryStage;
