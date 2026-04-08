import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  QualityVerdict,
  SegmentScriptDraft,
  ValidationReport,
} from "../../context";
import type { QualitySignals } from "../agents/quality-judge-agent";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import type { StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";
import { runMastraQualityStage as runMastraQualityStageDefault } from "../../mastra/runtime/run-mastra-quality-stage";

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
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
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
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
  runMastraQualityStage?: (
    input: RunQualityStageInput
  ) => Promise<RunQualityStageResult>;
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
  skillMetadata?: SkillMetadataSnapshot;
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

export const runQualityStage = async (
  input: RunQualityStageInput
): Promise<RunQualityStageResult> => {
  return (input.runMastraQualityStage ?? runMastraQualityStageDefault)(input);
};
