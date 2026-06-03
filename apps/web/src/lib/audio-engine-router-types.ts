// 一旦我被更新，请更新我的开头注释
// input: 音频路由上下文/候选/健康快照
// output: 音频路由共享类型
// pos: 音频引擎路由模块
export type AudioRouteSource =
  | "manual_voice_profile"
  | "speaker_engine_variant"
  | "character_voice_binding"
  | "narration_fallback";

export interface AudioRouteEmotionPreset {
  emotionLabel: string;
  aliases: string[];
  intensityDefault?: number | null;
  prosodyPreset?: Record<string, unknown>;
  engineParams?: Record<string, unknown>;
}

export interface RoutedVoiceProfile {
  id?: string | null;
  provider: string;
  voiceId: string;
  referenceAudio?: string | null;
  promptAudio?: string | null;
  promptText?: string | null;
  defaultParameters?: Record<string, unknown>;
}

export interface AudioRouteCandidate {
  candidateId: string;
  source: AudioRouteSource;
  provider: string;
  voiceId?: string | null;
  voiceProfile: RoutedVoiceProfile | null;
  isDefault?: boolean;
  routingWeight?: number;
  capability?: Record<string, unknown>;
  speakerProfileId?: number | null;
  speakerEngineVariantId?: string | null;
  emotionPresets?: AudioRouteEmotionPreset[];
}

export interface AudioRouteEngineHealth {
  provider: string;
  sampleSize: number;
  failureRate: number;
  timeoutRate: number;
  healthy: boolean;
  updatedAt: string;
}

export interface AudioRouteContext {
  roleType?: string | null;
  emotionLabel?: string | null;
  priority?: string | null;
  engineHint?: string | null;
  preferredProvider?: string | null;
  policyVersion: string;
  debugEnabled: boolean;
}

export interface AudioRouteCandidateTrace {
  candidateId: string;
  source: AudioRouteSource;
  provider: string;
  voiceId: string | null;
  score: number;
  eligible: boolean;
  healthy: boolean;
  rule: string;
  presetMatch: "none" | "exact" | "alias";
  reason: string[];
}

export interface AudioRouteDecision {
  policyVersion: string;
  roleType: string | null;
  emotionLabel: string | null;
  priority: string | null;
  engineHint: string | null;
  preferredProvider: string | null;
  selectedEngine: string | null;
  selectedVoiceId: string | null;
  selectedSource: AudioRouteSource | null;
  selectedRule: string | null;
  selectedCandidateId: string | null;
  fallbackDepth: number;
  isFallback: boolean;
  candidateCount: number;
  engineHealth: Record<string, AudioRouteEngineHealth>;
  candidateTrace: AudioRouteCandidateTrace[];
  fallbackPath: Array<{
    candidateId: string;
    provider: string;
    source: AudioRouteSource;
    reason: string[];
  }>;
}

export interface RankedAudioRouteCandidate extends AudioRouteCandidate {
  voiceId: string | null;
  score: number;
  eligible: boolean;
  healthy: boolean;
  rule: string;
  reason: string[];
  presetMatch: "none" | "exact" | "alias";
  matchedPreset: AudioRouteEmotionPreset | null;
}

export interface AudioRouteSelectionResult {
  selectedCandidate: RankedAudioRouteCandidate | null;
  rankedCandidates: RankedAudioRouteCandidate[];
  decision: AudioRouteDecision;
}
