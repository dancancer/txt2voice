import type { AudioRouteEmotionPreset, RankedAudioRouteCandidate } from "@/lib/audio-engine-router";

import type {
  AudioGenerationRequest,
  RouteAttemptContext,
  VoiceRouteResolution,
} from "../types";
import { toFiniteNumber } from "../synthesis/tts-parameter-normalizer";

export function applyRouterPresetToRequest(
  request: AudioGenerationRequest,
  preset: AudioRouteEmotionPreset | null
): AudioGenerationRequest {
  if (!preset) {
    return request;
  }

  const engineParams = preset.engineParams || {};
  const speed = toFiniteNumber(engineParams.speed ?? engineParams.rate, null);
  const pitch = toFiniteNumber(engineParams.pitch, null);
  const volume = toFiniteNumber(engineParams.volume, null);
  const style =
    typeof engineParams.style === "string" && engineParams.style.trim().length > 0
      ? engineParams.style.trim()
      : undefined;
  const controlInstruction =
    typeof engineParams.controlInstruction === "string" &&
    engineParams.controlInstruction.trim().length > 0
      ? engineParams.controlInstruction.trim()
      : undefined;
  const cfgValue = toFiniteNumber(engineParams.cfgValue ?? engineParams.cfg_value, null);
  const inferenceTimesteps = toFiniteNumber(
    engineParams.inferenceTimesteps ?? engineParams.inference_timesteps,
    null
  );

  return {
    ...request,
    overrides: {
      ...(request.overrides || {}),
      ...(speed !== null ? { speed } : {}),
      ...(pitch !== null ? { pitch } : {}),
      ...(volume !== null ? { volume } : {}),
      ...(style ? { style } : {}),
      ...(controlInstruction ? { controlInstruction } : {}),
      ...(cfgValue !== null ? { cfgValue } : {}),
      ...(inferenceTimesteps !== null ? { inferenceTimesteps } : {}),
      ...(typeof engineParams.normalize === "boolean"
        ? { normalize: engineParams.normalize }
        : {}),
      ...(typeof engineParams.denoise === "boolean" ? { denoise: engineParams.denoise } : {}),
      ...(request.overrides?.emotion ? {} : { emotion: preset.emotionLabel }),
    },
  };
}

export function createRouteAttemptContext(params: {
  routeResolution: VoiceRouteResolution;
  selectedCandidate: RankedAudioRouteCandidate | null;
  candidateIndex: number;
}): RouteAttemptContext {
  const { routeResolution, candidateIndex } = params;
  const candidate =
    params.selectedCandidate ||
    routeResolution.selectedCandidate ||
    routeResolution.rankedCandidates[0];

  if (!candidate) {
    const placeholderCandidate: RankedAudioRouteCandidate = {
      candidateId: "unknown",
      source: "narration_fallback",
      provider: "unknown",
      voiceId: null,
      voiceProfile: null,
      isDefault: false,
      routingWeight: 0,
      score: 0,
      eligible: false,
      healthy: false,
      rule: "none",
      reason: ["missing_candidate"],
      presetMatch: "none",
      matchedPreset: null,
    };

    return {
      selectedCandidate: placeholderCandidate,
      rankedCandidates: routeResolution.rankedCandidates,
      routeDecision: routeResolution.routeDecision,
      candidateIndex,
      policyVersion: routeResolution.routeDecision.policyVersion,
    };
  }

  const selectedIndex = routeResolution.rankedCandidates.findIndex(
    (item) => item.candidateId === candidate.candidateId
  );
  const fallbackDepth = selectedIndex < 0 ? 0 : selectedIndex;
  const fallbackPath =
    fallbackDepth > 0
      ? routeResolution.rankedCandidates.slice(0, fallbackDepth).map((item) => ({
          candidateId: item.candidateId,
          provider: item.provider,
          source: item.source,
          reason: item.reason,
        }))
      : [];

  const routeDecision = {
    ...routeResolution.routeDecision,
    selectedEngine: candidate.provider,
    selectedVoiceId: candidate.voiceId,
    selectedSource: candidate.source,
    selectedRule: candidate.rule,
    selectedCandidateId: candidate.candidateId,
    fallbackDepth,
    isFallback: fallbackDepth > 0 || candidate.source === "narration_fallback",
    fallbackPath,
  };

  return {
    selectedCandidate: candidate,
    rankedCandidates: routeResolution.rankedCandidates,
    routeDecision,
    candidateIndex,
    policyVersion: routeDecision.policyVersion,
  };
}
