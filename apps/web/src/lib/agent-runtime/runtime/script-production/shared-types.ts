import type { LLMExecutionEvent } from "@/lib/llm/events";
import type { SegmentScriptDraft } from "../../context";
import type {
  ScriptGenerationOptions,
  DialogueLine,
  SegmentFailureDetail,
  SegmentSummary,
} from "./types";

export type ScriptProductionWorkflowMode = "full" | "partial" | "regenerate";

export interface RunScriptProductionWorkflowInput {
  bookId: string;
  taskId?: string;
  options: Partial<ScriptGenerationOptions>;
  mode: ScriptProductionWorkflowMode;
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
  segmentIds?: string[];
  onProgress?: (done: number, total: number) => Promise<void> | void;
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}

export type SegmentFinalStatus = "success" | "failed" | "manual_review";

export interface ScriptProductionBookSegment {
  id: string;
  chapterId?: string | null;
  orderIndex?: number;
  content: string;
}

export interface SegmentOutcomeIndexItem {
  segmentId: string;
  finalStatus: SegmentFinalStatus;
  terminalStage: string;
  errorCode?: string;
}

export interface CharacterProfileSnapshot {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
  characteristics?: {
    description?: string;
    personality?: string[];
    importance?: string;
  };
  voicePreferences?: {
    dialogueStyle?: string;
  };
  genderHint?: string | null;
  ageHint?: number | null;
}

export interface ScriptProductionBook {
  id: string;
  textSegments: ScriptProductionBookSegment[];
  characterProfiles: CharacterProfileSnapshot[];
}

export interface RuntimeSegmentState {
  segmentId: string;
  chapterId?: string | null;
  orderIndex?: number;
  sourceText: string;
}

export interface SegmentRuntimeCounters {
  persistedSentenceCount: number;
  persistedCharacterCount: number;
  formatRepairCount: number;
  semanticRetryCount: number;
}

export interface SegmentSuccessResult {
  status: "success";
  dialogueLines: DialogueLine[];
  summary: SegmentSummary;
  counters: SegmentRuntimeCounters;
  draft: SegmentScriptDraft;
  manualReviewFailure?: SegmentFailureDetail;
}

export interface SegmentFailureResult {
  status: "failed";
  failure: SegmentFailureDetail;
  counters: SegmentRuntimeCounters;
}

export type SegmentRunResult = SegmentSuccessResult | SegmentFailureResult;

export const createEmptySegmentCounters = (): SegmentRuntimeCounters => ({
  persistedSentenceCount: 0,
  persistedCharacterCount: 0,
  formatRepairCount: 0,
  semanticRetryCount: 0,
});

export const mergeSegmentCounters = (
  left: SegmentRuntimeCounters,
  right: SegmentRuntimeCounters
): SegmentRuntimeCounters => ({
  persistedSentenceCount:
    left.persistedSentenceCount + right.persistedSentenceCount,
  persistedCharacterCount:
    left.persistedCharacterCount + right.persistedCharacterCount,
  formatRepairCount: left.formatRepairCount + right.formatRepairCount,
  semanticRetryCount: left.semanticRetryCount + right.semanticRetryCount,
});
