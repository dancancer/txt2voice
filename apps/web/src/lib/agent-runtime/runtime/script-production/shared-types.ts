import type { LLMExecutionEvent } from "@/lib/llm-service";
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

export interface ScriptProductionBookSegment {
  id: string;
  chapterId?: string | null;
  orderIndex?: number;
  content: string;
}

export interface SegmentOutcomeIndexItem {
  segmentId: string;
  finalStatus: "success" | "failed";
  terminalStage: string;
  errorCode?: string;
}

export interface CharacterProfileSnapshot {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
}

export interface ScriptProductionBook {
  id: string;
  textSegments: ScriptProductionBookSegment[];
  characterProfiles: CharacterProfileSnapshot[];
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
