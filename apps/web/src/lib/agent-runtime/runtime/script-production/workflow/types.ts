import { calculateScriptSummary } from "../summary";
import type { LLMAdapter } from "../../../adapters/llm-adapter";
import type { ExecutionEvent } from "../../../protocol/events";
import type { ScriptProductionRuntimeMetadata } from "../../script-production-runtime-helpers";
import type {
  DialogueLine,
  SegmentFailureDetail,
  SegmentSummary,
} from "../types";
import type {
  RunScriptProductionWorkflowInput,
  SegmentFinalStatus,
  ScriptProductionBook,
} from "../shared-types";
import type { loadBookForGeneration, resolvePartialSegments } from "../workflow-source";
import type { runCharacterDiscoveryStage } from "../../stages/run-character-discovery-stage";
import type { runManualReviewHandoffStage } from "../../stages/run-manual-review-handoff-stage";
import type { runPersistStage } from "../../stages/run-persist-stage";
import type { runQualityStage } from "../../stages/run-quality-stage";
import type { runSegmentRepairStage } from "../../stages/run-segment-repair-stage";
import type { runSegmentScriptingStage } from "../../stages/run-segment-scripting-stage";
import type { ScriptProductionRuntimeStore } from "../../script-production-runtime-store";
import type { RunStageResult, StageRunRecord } from "../../run-stage";
import type { AgentRunRecord } from "../../run-agent";

export type ScriptProductionWorkflowResult = {
  dialogueLines: DialogueLine[];
  summary: ReturnType<typeof calculateScriptSummary>;
  segments: SegmentSummary[];
  runtimeMetadata?: ScriptProductionRuntimeMetadata;
};

export interface ScriptProductionWorkflowDeps {
  adapter?: LLMAdapter;
  loadBookForGeneration?: typeof loadBookForGeneration;
  resolvePartialSegments?: typeof resolvePartialSegments;
  runCharacterDiscoveryStage?: typeof runCharacterDiscoveryStage;
  runManualReviewHandoffStage?: typeof runManualReviewHandoffStage;
  runSegmentScriptingStage?: typeof runSegmentScriptingStage;
  runSegmentRepairStage?: typeof runSegmentRepairStage;
  runQualityStage?: typeof runQualityStage;
  runPersistStage?: typeof runPersistStage;
  runtimeStore?: ScriptProductionRuntimeStore;
  createId?: () => string;
  now?: () => Date;
}

export interface ScriptProductionExecutionState {
  dialogueLines: DialogueLine[];
  segmentSummaries: SegmentSummary[];
  failedSegmentIds: string[];
  failedSegmentDetails: SegmentFailureDetail[];
  segmentOutcomeIndex: Array<{
    segmentId: string;
    finalStatus: SegmentFinalStatus;
    terminalStage: string;
    errorCode?: string;
  }>;
  coordinatorStageResults: RunStageResult[];
  persistedSentenceCount: number;
  persistedCharacterCount: number;
  formatRepairCount: number;
  semanticRetryCount: number;
  manualReviewRequiredCount: number;
  qualityRejectedCount: number;
  traceEventCount: number;
  stageRunCount: number;
  stageSkillMetadata: Record<string, Record<string, unknown>>;
  stageSkillMetadataIndex: Array<{
    stageRunId: string;
    stageId: string;
    segmentId?: string;
    metadata: Record<string, unknown>;
  }>;
  workflowIssues: Array<{
    code: string;
    stage: string;
    message: string;
    retryable?: boolean;
  }>;
  degradedMode: boolean;
  characterDiscoveryStatus: "completed" | "failed" | "skipped";
  characterDiscoveryFailure?:
    | {
        code: string;
        message: string;
      }
    | undefined;
  persistedSegments: number;
}

export interface WorkflowTrackingAdapters {
  createTrackedStageRun: (record: StageRunRecord) => Promise<void>;
  updateTrackedStageRun: (record: StageRunRecord) => Promise<void>;
  createTrackedAgentRun: (record: AgentRunRecord) => Promise<void>;
  updateTrackedAgentRun: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void>;
  appendTrackedTrace: (event: ExecutionEvent) => Promise<void>;
}

export interface WorkflowCoordinatorResult {
  status: "completed" | "failed";
  summary: Record<string, unknown>;
  stages: RunStageResult[];
  result: ScriptProductionWorkflowResult;
}

export const createScriptProductionExecutionState =
  (): ScriptProductionExecutionState => ({
    dialogueLines: [],
    segmentSummaries: [],
    failedSegmentIds: [],
    failedSegmentDetails: [],
    segmentOutcomeIndex: [],
    coordinatorStageResults: [],
    persistedSentenceCount: 0,
    persistedCharacterCount: 0,
    formatRepairCount: 0,
    semanticRetryCount: 0,
    manualReviewRequiredCount: 0,
    qualityRejectedCount: 0,
    traceEventCount: 0,
    stageRunCount: 0,
    stageSkillMetadata: {},
    stageSkillMetadataIndex: [],
    workflowIssues: [],
    degradedMode: false,
    characterDiscoveryStatus: "skipped",
    characterDiscoveryFailure: undefined,
    persistedSegments: 0,
  });

export type WorkflowNow = () => Date;
export type WorkflowInput = RunScriptProductionWorkflowInput;
export type WorkflowBook = ScriptProductionBook;
