import type {
  extractQ0Q3RawSignals,
  resolveQ0Q3SignalSources,
  resolveQ0Q3ThresholdTemplate,
} from "@/lib/quality-check/q0q3-runtime";

export type QualityCheckTaskType = "book" | "chapter" | "batch";
export type FastGateVerdict = "pass" | "repair" | "manual_review" | "hard_fail";

export interface QualityCheckRunParams {
  taskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}

export interface FastGateInput {
  text: string;
  roleType?: string | null;
  priority?: string | null;
  emotionIntensity?: number | null;
  durationSeconds: number;
  hasVoiceProfile: boolean;
  rawSignals?: ReturnType<typeof extractQ0Q3RawSignals>;
  signalSources?: ReturnType<typeof resolveQ0Q3SignalSources>["config"];
  thresholds?: ReturnType<typeof resolveQ0Q3ThresholdTemplate>["template"];
}
