// 一旦我被更新，请更新我的开头注释
// input: quality stage 输入
// output: Mastra 单轨质量判定 stage 契约
// pos: agent runtime stage contract
import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  CharacterMemory,
  QualityVerdict,
  SegmentScriptDraft,
  ValidationReport,
} from "../../context";
import type { CharacterResolutionEvidence } from "../character-memory/types";
import { runMastraQualityStage } from "../../mastra/runtime/run-mastra-quality-stage";
import type { QualitySignals } from "../agents/quality-judge-agent";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import type { StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";

interface QualityStageRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (
    record: ToolCallRecord & { createdAt?: Date }
  ) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface RunQualityStageInput extends QualityStageRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentScriptDraft: SegmentScriptDraft;
  validationReport: ValidationReport;
  qualitySignals?: QualitySignals;
  failedArtifact?: unknown;
  characterMemory?: CharacterMemory;
  characterResolutionEvidence?: CharacterResolutionEvidence;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
}

export interface QualityReviewHandoff {
  segmentId: string;
  summary: string;
  reasons: string[];
  evidence: {
    score: number;
    confidence: number;
    validation: {
      coverageRatio: number;
      issues: string[];
    };
  };
}

export type QualityStageDecision =
  | "auto_pass"
  | "auto_fail"
  | "manual_review_required";

interface RunQualityStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  decision: QualityStageDecision;
  verdict: QualityVerdict;
  handoff?: QualityReviewHandoff;
}

interface RunQualityStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunQualityStageResult =
  | RunQualityStageCompletedResult
  | RunQualityStageNonCompletedResult;

export const runQualityStage = runMastraQualityStage;
