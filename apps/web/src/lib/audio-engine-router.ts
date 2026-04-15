// 一旦我被更新，请更新我的开头注释
// input: 路由上下文/候选配置/引擎健康快照
// output: 路由决策/候选评分明细
// pos: 音频引擎路由模块
import type {
  AudioRouteCandidate,
  AudioRouteContext,
  AudioRouteEngineHealth,
  AudioRouteEmotionPreset,
  AudioRouteSelectionResult,
  AudioRouteSource,
  RankedAudioRouteCandidate,
} from "./audio-engine-router-types";

const BASE_SCORE_BY_SOURCE: Record<AudioRouteSource, number> = {
  manual_voice_profile: 200,
  speaker_engine_variant: 110,
  character_voice_binding: 90,
  narration_fallback: 70,
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeEmotion = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/[_\s-]+/g, "");
};

const normalizeAliasList = (aliases: string[] | undefined): string[] => {
  if (!Array.isArray(aliases)) {
    return [];
  }
  return Array.from(
    new Set(
      aliases
        .map((entry) => normalizeEmotion(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  );
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const getCapabilityBoolean = (
  capability: Record<string, unknown> | undefined,
  keys: string[]
): boolean => {
  if (!capability) {
    return false;
  }

  for (const key of keys) {
    if (capability[key] === true) {
      return true;
    }
  }

  return false;
};

const resolvePresetMatch = ({
  presets,
  emotionLabel,
}: {
  presets: AudioRouteEmotionPreset[];
  emotionLabel: string | null;
}): {
  preset: AudioRouteEmotionPreset | null;
  matchType: "none" | "exact" | "alias";
} => {
  if (!emotionLabel || presets.length === 0) {
    return {
      preset: null,
      matchType: "none",
    };
  }

  const normalizedEmotion = normalizeEmotion(emotionLabel);
  if (!normalizedEmotion) {
    return {
      preset: null,
      matchType: "none",
    };
  }

  for (const preset of presets) {
    const normalizedPresetEmotion = normalizeEmotion(preset.emotionLabel);
    if (normalizedPresetEmotion && normalizedPresetEmotion === normalizedEmotion) {
      return {
        preset,
        matchType: "exact",
      };
    }
  }

  for (const preset of presets) {
    const aliases = normalizeAliasList(preset.aliases);
    if (aliases.includes(normalizedEmotion)) {
      return {
        preset,
        matchType: "alias",
      };
    }
  }

  return {
    preset: null,
    matchType: "none",
  };
};

const resolveHealthPenalty = (health: AudioRouteEngineHealth | undefined): number => {
  if (!health) {
    return 0;
  }

  if (health.sampleSize < 3) {
    return 0;
  }

  if (health.healthy) {
    return 0;
  }

  if (health.failureRate >= 0.8 || health.timeoutRate >= 0.35) {
    return -120;
  }

  return -Math.round(
    clamp(health.failureRate * 60 + health.timeoutRate * 40, 25, 80)
  );
};

const resolvePriorityBoost = ({
  priority,
  capability,
}: {
  priority: string | null;
  capability: Record<string, unknown> | undefined;
}): number => {
  if (!priority || priority !== "high") {
    return 0;
  }

  if (getCapabilityBoolean(capability, ["lowLatency", "highPriority", "fastPath"])) {
    return 6;
  }

  return 0;
};

const resolveRoleBoost = ({
  roleType,
  capability,
}: {
  roleType: string | null;
  capability: Record<string, unknown> | undefined;
}): number => {
  if (!roleType || !capability) {
    return 0;
  }

  if (roleType === "narration") {
    return getCapabilityBoolean(capability, ["narration", "narrator"]) ? 8 : 0;
  }

  if (roleType === "dialogue") {
    return getCapabilityBoolean(capability, ["dialogue", "dialog"]) ? 8 : 0;
  }

  return 0;
};

const buildRule = ({
  source,
  matchType,
  preferredProviderHit,
  engineHintHit,
  roleBoost,
  priorityBoost,
  healthPenalty,
}: {
  source: AudioRouteSource;
  matchType: "none" | "exact" | "alias";
  preferredProviderHit: boolean;
  engineHintHit: boolean;
  roleBoost: number;
  priorityBoost: number;
  healthPenalty: number;
}): string => {
  const labels: string[] = [source];

  if (matchType !== "none") {
    labels.push(`emotion_${matchType}`);
  }
  if (preferredProviderHit) {
    labels.push("preferred_provider");
  }
  if (engineHintHit) {
    labels.push("engine_hint");
  }
  if (roleBoost > 0) {
    labels.push("role_capability");
  }
  if (priorityBoost > 0) {
    labels.push("priority_capability");
  }
  if (healthPenalty < 0) {
    labels.push("health_penalty");
  }

  return labels.join("+");
};

export const selectAudioRouteCandidate = ({
  candidates,
  context,
  engineHealth,
}: {
  candidates: AudioRouteCandidate[];
  context: AudioRouteContext;
  engineHealth: Record<string, AudioRouteEngineHealth>;
}): AudioRouteSelectionResult => {
  const roleType = normalizeText(context.roleType);
  const emotionLabel = normalizeText(context.emotionLabel);
  const priority = normalizeText(context.priority);
  const preferredProvider = normalizeText(context.preferredProvider);
  const engineHint = normalizeText(context.engineHint);

  const rankedCandidates: RankedAudioRouteCandidate[] = candidates.map((candidate) => {
    const provider = normalizeText(candidate.provider) || "unknown";
    const health = engineHealth[provider];
    const presets = candidate.emotionPresets || [];
    const presetMatch = resolvePresetMatch({
      presets,
      emotionLabel,
    });

    let score = BASE_SCORE_BY_SOURCE[candidate.source] || 50;
    const reason: string[] = [`base:${score}`];

    const normalizedVoiceId = normalizeText(candidate.voiceId) || null;
    const eligible = Boolean(candidate.voiceProfile && normalizedVoiceId);
    if (!eligible) {
      score -= 80;
      reason.push("missing_voice");
    }

    const routingWeight =
      typeof candidate.routingWeight === "number" && Number.isFinite(candidate.routingWeight)
        ? clamp(candidate.routingWeight, 0, 5)
        : 1;
    if (candidate.source === "speaker_engine_variant") {
      const routingBoost = Math.round(routingWeight * 8);
      score += routingBoost;
      reason.push(`routing_weight:+${routingBoost}`);
    }

    if (candidate.isDefault) {
      score += 6;
      reason.push("default:+6");
    }

    if (presetMatch.matchType === "exact") {
      score += 16;
      reason.push("emotion_exact:+16");
    } else if (presetMatch.matchType === "alias") {
      score += 10;
      reason.push("emotion_alias:+10");
    }

    const preferredProviderHit = Boolean(preferredProvider && provider === preferredProvider);
    if (preferredProviderHit) {
      score += 18;
      reason.push("preferred_provider:+18");
    } else if (preferredProvider) {
      score -= 18;
      reason.push("preferred_provider_miss:-18");
    }

    const engineHintHit = Boolean(engineHint && provider === engineHint);
    if (engineHintHit) {
      score += 12;
      reason.push("engine_hint:+12");
    }

    const roleBoost = resolveRoleBoost({
      roleType,
      capability: candidate.capability,
    });
    if (roleBoost > 0) {
      score += roleBoost;
      reason.push(`role_boost:+${roleBoost}`);
    }

    const priorityBoost = resolvePriorityBoost({
      priority,
      capability: candidate.capability,
    });
    if (priorityBoost > 0) {
      score += priorityBoost;
      reason.push(`priority_boost:+${priorityBoost}`);
    }

    const healthPenalty = resolveHealthPenalty(health);
    if (healthPenalty < 0) {
      score += healthPenalty;
      reason.push(`health_penalty:${healthPenalty}`);
    }

    const rule = buildRule({
      source: candidate.source,
      matchType: presetMatch.matchType,
      preferredProviderHit,
      engineHintHit,
      roleBoost,
      priorityBoost,
      healthPenalty,
    });

    return {
      ...candidate,
      provider,
      voiceId: normalizedVoiceId,
      score,
      eligible,
      healthy: health ? health.healthy : true,
      rule,
      reason,
      presetMatch: presetMatch.matchType,
      matchedPreset: presetMatch.preset,
    };
  });

  rankedCandidates.sort((left, right) => {
    if (left.eligible !== right.eligible) {
      return left.eligible ? -1 : 1;
    }
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }
    return left.candidateId.localeCompare(right.candidateId);
  });

  const selectedCandidate = rankedCandidates.find((candidate) => candidate.eligible) || null;
  const fallbackDepth = selectedCandidate
    ? Math.max(0, rankedCandidates.findIndex((candidate) => candidate.candidateId === selectedCandidate.candidateId))
    : 0;
  const isFallback = Boolean(
    selectedCandidate && (fallbackDepth > 0 || selectedCandidate.source === "narration_fallback")
  );

  const candidateTrace = rankedCandidates.slice(0, context.debugEnabled ? 12 : 6).map((candidate) => ({
    candidateId: candidate.candidateId,
    source: candidate.source,
    provider: candidate.provider,
    voiceId: candidate.voiceId,
    score: candidate.score,
    eligible: candidate.eligible,
    healthy: candidate.healthy,
    rule: candidate.rule,
    presetMatch: candidate.presetMatch,
    reason: candidate.reason,
  }));

  const fallbackPath = selectedCandidate
    ? rankedCandidates
        .slice(0, fallbackDepth)
        .map((candidate) => ({
          candidateId: candidate.candidateId,
          provider: candidate.provider,
          source: candidate.source,
          reason: candidate.reason,
        }))
    : [];

  return {
    selectedCandidate,
    rankedCandidates,
    decision: {
      policyVersion: context.policyVersion,
      roleType,
      emotionLabel,
      priority,
      engineHint,
      preferredProvider,
      selectedEngine: selectedCandidate?.provider || null,
      selectedVoiceId: selectedCandidate?.voiceId || null,
      selectedSource: selectedCandidate?.source || null,
      selectedRule: selectedCandidate?.rule || null,
      selectedCandidateId: selectedCandidate?.candidateId || null,
      fallbackDepth,
      isFallback,
      candidateCount: rankedCandidates.length,
      engineHealth,
      candidateTrace,
      fallbackPath,
    },
  };
};
export type {
  AudioRouteCandidate,
  AudioRouteCandidateTrace,
  AudioRouteContext,
  AudioRouteDecision,
  AudioRouteEngineHealth,
  AudioRouteEmotionPreset,
  AudioRouteSelectionResult,
  AudioRouteSource,
  RankedAudioRouteCandidate,
  RoutedVoiceProfile,
} from "./audio-engine-router-types";
