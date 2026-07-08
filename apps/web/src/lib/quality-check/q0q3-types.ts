import type { QualityGateVerdict, QualityIssueType } from "@/lib/quality-gate/types";

export type FastSignalSource =
  | "heuristic"
  | "attempt_metrics"
  | "task_payload"
  | "mixed"
  | "disabled";

export type MetadataSource = "default" | "book_metadata" | "task_override";
export type SignalProvider = "heuristic" | "attempt_metrics" | "task_payload";

export interface Q0Q3ProviderConfig {
  q0: SignalProvider[];
  q1: SignalProvider[];
  q2: SignalProvider[];
  q3: SignalProvider[];
}

export interface Q0Q3SignalSourceResolution {
  config: Q0Q3ProviderConfig;
  source: MetadataSource;
}

export interface Q0Q3ThresholdTemplate {
  q0PassScore: number;
  q0ManualReviewScore: number;
  q0MaxTextLength: number;
  q1PassScore: number;
  q1ManualReviewScore: number;
  q1HardFailCharsPerSecond: number;
  q1LeadingSilenceMsMax: number;
  q1TrailingSilenceMsMax: number;
  q1LufsTarget: number;
  q1LufsTolerance: number;
  q2CerNarrationPass: number;
  q2CerDialoguePass: number;
  q2CerHighEmotionPass: number;
  q2CerManualReviewDelta: number;
  q2CerHardFail: number;
  q3SpeakerLeadPass: number;
  q3SpeakerSupportPass: number;
  q3SpeakerManualReviewGap: number;
  q3SpeakerHardFail: number;
  fastPassScore: number;
  fastManualReviewScore: number;
}

export interface Q0Q3ThresholdResolution {
  template: Q0Q3ThresholdTemplate;
  source: MetadataSource;
}

export interface Q0Q3RawSignals {
  cer: number | null;
  speakerSimilarity: number | null;
  clipping: boolean | null;
  leadingSilenceMs: number | null;
  trailingSilenceMs: number | null;
  lufs: number | null;
}

export interface EvaluateQ0Q3Input {
  text: string;
  roleType?: string | null;
  priority?: string | null;
  emotionIntensity?: number | null;
  durationSeconds: number;
  hasVoiceProfile: boolean;
  rawSignals: Q0Q3RawSignals;
  signalSources: Q0Q3ProviderConfig;
  thresholds: Q0Q3ThresholdTemplate;
}

export interface Q0Q3EvaluationResult {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q0Score: number;
  q1Score: number;
  q2Score: number;
  q3Score: number;
  charsPerSecond: number;
  reasons: string[];
  issueType: QualityIssueType;
  primarySignal: "q0_precheck" | "q1_audio" | "q2_cer" | "q3_speaker";
  signalSources: {
    q0: FastSignalSource;
    q1: FastSignalSource;
    q2: FastSignalSource;
    q3: FastSignalSource;
  };
  signalValues: {
    q0PrecheckRisk: number;
    q2Cer: number | null;
    q3SpeakerSimilarity: number | null;
    q1Clipping: boolean | null;
    q1LeadingSilenceMs: number | null;
    q1TrailingSilenceMs: number | null;
    q1Lufs: number | null;
  };
}

export const DEFAULT_SIGNAL_SOURCES: Q0Q3ProviderConfig = {
  q0: ["heuristic"],
  q1: ["attempt_metrics", "heuristic"],
  q2: ["attempt_metrics", "task_payload", "heuristic"],
  q3: ["attempt_metrics", "task_payload", "heuristic"],
};

export const DEFAULT_Q0Q3_THRESHOLD_TEMPLATE: Q0Q3ThresholdTemplate = {
  q0PassScore: 84,
  q0ManualReviewScore: 62,
  q0MaxTextLength: 220,
  q1PassScore: 82,
  q1ManualReviewScore: 64,
  q1HardFailCharsPerSecond: 12,
  q1LeadingSilenceMsMax: 120,
  q1TrailingSilenceMsMax: 250,
  q1LufsTarget: -19,
  q1LufsTolerance: 1,
  q2CerNarrationPass: 0.05,
  q2CerDialoguePass: 0.08,
  q2CerHighEmotionPass: 0.1,
  q2CerManualReviewDelta: 0.03,
  q2CerHardFail: 0.12,
  q3SpeakerLeadPass: 0.82,
  q3SpeakerSupportPass: 0.76,
  q3SpeakerManualReviewGap: 0.06,
  q3SpeakerHardFail: 0.7,
  fastPassScore: 85,
  fastManualReviewScore: 70,
};
