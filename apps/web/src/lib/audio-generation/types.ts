import { Prisma } from "@/generated/prisma";
import type {
  AudioRouteEmotionPreset,
  AudioRouteEngineHealth,
  AudioRouteSelectionResult,
  RankedAudioRouteCandidate,
  RoutedVoiceProfile,
} from "@/lib/audio-engine-router";

export interface AudioGenerationRequest {
  scriptSentenceId: string;
  voiceProfileId?: string;
  overrides?: {
    speed?: number;
    pitch?: number;
    volume?: number;
    emotion?: string;
    style?: string;
  };
  outputFormat?: "mp3" | "wav" | "ogg";
}

export interface AudioGenerationOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  priority?: "low" | "normal" | "high";
  skipExisting?: boolean;
  overwriteExisting?: boolean;
  provider?: string;
  routerPolicyVersion?: string;
  enableRouterDebug?: boolean;
}

export interface AudioGenerationResult {
  success: boolean;
  audioFileId?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AudioReliabilityPassSummary {
  passName: "pass-1" | "pass-2" | "pass-3";
  requestCount: number;
  successCount: number;
  failedCount: number;
  concurrency: number;
  durationMs: number;
}

export interface AudioReliabilityProviderFailure {
  provider: string;
  failed: number;
}

export interface AudioReliabilitySummary {
  policyProvider: string;
  firstPassSuccessRate: number;
  retryRounds: number;
  averageDurationMs: number;
  providerFailures: AudioReliabilityProviderFailure[];
  passSummaries: AudioReliabilityPassSummary[];
}

export interface AudioBatchGenerationSummary {
  results: AudioGenerationResult[];
  reliability: AudioReliabilitySummary;
}

export interface AudioBatchGenerationHooks {
  onPassComplete?: (summary: AudioReliabilityPassSummary) => void | Promise<void>;
  assertContinue?: () => void | Promise<void>;
}

export interface VoiceRouteResolution {
  selectedCandidate: RankedAudioRouteCandidate | null;
  rankedCandidates: RankedAudioRouteCandidate[];
  routeDecision: AudioRouteSelectionResult["decision"];
}

export interface EngineHealthCacheValue {
  expiresAt: number;
  snapshot: Record<string, AudioRouteEngineHealth>;
}

export interface RouteAttemptContext {
  selectedCandidate: RankedAudioRouteCandidate;
  rankedCandidates: RankedAudioRouteCandidate[];
  routeDecision: AudioRouteSelectionResult["decision"];
  candidateIndex: number;
  policyVersion: string;
}

export interface RouteCandidateRecord {
  id?: string | null;
  provider: string;
  voiceId: string;
  defaultParameters?: Record<string, unknown>;
}

export interface VoiceRouteCandidateContext {
  selectedCandidate: RankedAudioRouteCandidate;
  rankedCandidates: RankedAudioRouteCandidate[];
  routeDecision: AudioRouteSelectionResult["decision"];
  candidateIndex: number;
  policyVersion: string;
}

export interface CollectedRouteCandidate {
  candidateId: string;
  source: string;
  provider: string;
  voiceId: string | null;
  voiceProfile: RoutedVoiceProfile | null;
  isDefault: boolean;
  routingWeight: number;
  capability?: Record<string, unknown>;
  speakerProfileId?: string;
  speakerEngineVariantId?: string;
  emotionPresets?: AudioRouteEmotionPreset[];
}

export const asRecord = (
  value: Prisma.JsonValue | null | undefined
): Record<string, any> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
