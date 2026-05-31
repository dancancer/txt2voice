import type prisma from "@/lib/prisma";
import {
  selectAudioRouteCandidate,
  type AudioRouteCandidate,
  type AudioRouteContext,
  type AudioRouteEmotionPreset,
} from "@/lib/audio-engine-router";

import {
  type AudioGenerationOptions,
  type AudioGenerationRequest,
  type VoiceRouteResolution,
  asRecord,
} from "../types";
import { toFiniteNumber } from "../synthesis/tts-parameter-normalizer";
import { getEngineHealthSnapshot } from "./engine-health";

export function resolveRouterPolicyVersion(
  scriptSentence: any,
  options: AudioGenerationOptions
): string {
  if (
    typeof options.routerPolicyVersion === "string" &&
    options.routerPolicyVersion.trim().length > 0
  ) {
    return options.routerPolicyVersion.trim();
  }

  const metadata = asRecord(scriptSentence?.book?.metadata);
  const audioRouter = asRecord(metadata?.audioRouter);
  const metadataVersion =
    (typeof audioRouter?.policyVersion === "string" &&
      audioRouter.policyVersion.trim()) ||
    (typeof metadata?.routerPolicyVersion === "string" &&
      metadata.routerPolicyVersion.trim());

  return metadataVersion || "engine-router-v1";
}

export function parseEmotionPresets(rawPresets: any[]): AudioRouteEmotionPreset[] {
  if (!Array.isArray(rawPresets) || rawPresets.length === 0) {
    return [];
  }

  return rawPresets
    .map((preset) => {
      const aliases = Array.isArray(preset?.rawAliases)
        ? preset.rawAliases.filter(
            (alias: unknown): alias is string => typeof alias === "string"
          )
        : [];
      const emotionLabel =
        typeof preset?.emotionLabel === "string" ? preset.emotionLabel.trim() : "";

      if (!emotionLabel) {
        return null;
      }

      return {
        emotionLabel,
        aliases,
        intensityDefault: toFiniteNumber(preset?.intensityDefault, null),
        prosodyPreset: asRecord(preset?.prosodyPreset) || {},
        engineParams: asRecord(preset?.engineParams) || {},
      } as AudioRouteEmotionPreset;
    })
    .filter((preset): preset is AudioRouteEmotionPreset => Boolean(preset));
}

export function resolveVariantVoiceId(
  provider: string,
  providerVoiceId: unknown
): string | null {
  if (typeof providerVoiceId === "string" && providerVoiceId.trim().length > 0) {
    return providerVoiceId.trim();
  }

  if (provider === "voxcpm") {
    return "__voxcpm_default__";
  }

  return null;
}

export async function findNarrationFallbackVoice(params: {
  bookId: string;
  provider?: string;
  prismaClient: typeof prisma;
}): Promise<any | null> {
  const { bookId, provider, prismaClient } = params;

  const preferredBinding = await prismaClient.characterVoiceBinding.findFirst({
    where: {
      character: {
        bookId,
        isActive: true,
      },
      voiceProfile: {
        isAvailable: true,
        ...(provider ? { provider } : {}),
      },
    },
    include: {
      voiceProfile: true,
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (preferredBinding?.voiceProfile) {
    return preferredBinding.voiceProfile;
  }

  return prismaClient.tTSVoiceProfile.findFirst({
    where: {
      isAvailable: true,
      ...(provider ? { provider } : {}),
    },
    orderBy: [{ rating: "desc" }, { usageCount: "desc" }, { createdAt: "asc" }],
  });
}

export async function collectRouteCandidates(params: {
  scriptSentence: any;
  request: AudioGenerationRequest;
  options: AudioGenerationOptions;
  prismaClient: typeof prisma;
}): Promise<AudioRouteCandidate[]> {
  const { scriptSentence, request, options, prismaClient } = params;
  const preferredProvider =
    typeof options.preferredProvider === "string" && options.preferredProvider.trim()
      ? options.preferredProvider.trim().toLowerCase()
      : null;
  const candidates: AudioRouteCandidate[] = [];

  if (request.voiceProfileId) {
    const selectedProfile = await prismaClient.tTSVoiceProfile.findUnique({
      where: { id: request.voiceProfileId },
    });
    if (!selectedProfile) {
      return [];
    }

    candidates.push({
      candidateId: `manual:${selectedProfile.id}`,
      source: "manual_voice_profile",
      provider: selectedProfile.provider,
      voiceId: selectedProfile.voiceId,
      voiceProfile: {
        id: selectedProfile.id,
        provider: selectedProfile.provider,
        voiceId: selectedProfile.voiceId,
        defaultParameters: asRecord(selectedProfile.defaultParameters),
      },
      isDefault: true,
      routingWeight: 1,
    });

    return candidates;
  }

  for (const binding of scriptSentence.character?.voiceBindings || []) {
    const voiceProfile = binding.voiceProfile;
    if (!voiceProfile || voiceProfile.isAvailable === false) {
      continue;
    }

    const provider =
      typeof voiceProfile.provider === "string"
        ? voiceProfile.provider.trim().toLowerCase()
        : "";
    if (!provider) {
      continue;
    }

    candidates.push({
      candidateId: `binding:${binding.id}`,
      source: "character_voice_binding",
      provider,
      voiceId: voiceProfile.voiceId,
      voiceProfile: {
        id: voiceProfile.id,
        provider,
        voiceId: voiceProfile.voiceId,
        defaultParameters: asRecord(voiceProfile.defaultParameters),
      },
      isDefault: Boolean(binding.isDefault),
      routingWeight: 1,
    });
  }

  const speakerBindings = scriptSentence.character?.speakerBindings || [];
  for (const speakerBinding of speakerBindings) {
    const speakerProfile = speakerBinding.speakerProfile;
    if (!speakerProfile?.isActive) {
      continue;
    }

    for (const variant of speakerProfile.engineVariants || []) {
      const provider =
        typeof variant.engine === "string" ? variant.engine.trim().toLowerCase() : "";
      if (!provider) {
        continue;
      }

      const voiceId = resolveVariantVoiceId(provider, variant.providerVoiceId);
      const capability = asRecord(variant.capability) || {};
      candidates.push({
        candidateId: `variant:${variant.id}`,
        source: "speaker_engine_variant",
        provider,
        voiceId,
        voiceProfile: voiceId
          ? {
              provider,
              voiceId,
              defaultParameters: {
                ...(asRecord(capability.defaultParameters) || {}),
              },
            }
          : null,
        isDefault: Boolean(variant.isDefault || speakerBinding.isDefault),
        routingWeight: toFiniteNumber(variant.routingWeight, 1) ?? 1,
        capability,
        speakerProfileId: speakerProfile.id,
        speakerEngineVariantId: variant.id,
        emotionPresets: parseEmotionPresets(variant.emotionPresets || []),
      });
    }
  }

  const narrationFallback = await findNarrationFallbackVoice({
    bookId: scriptSentence.bookId,
    provider: preferredProvider || undefined,
    prismaClient,
  });
  if (narrationFallback) {
    candidates.push({
      candidateId: `fallback:${narrationFallback.id}`,
      source: "narration_fallback",
      provider: narrationFallback.provider,
      voiceId: narrationFallback.voiceId,
      voiceProfile: {
        id: narrationFallback.id,
        provider: narrationFallback.provider,
        voiceId: narrationFallback.voiceId,
        defaultParameters: asRecord(narrationFallback.defaultParameters),
      },
      isDefault: true,
      routingWeight: 1,
    });
  }

  if (!narrationFallback && preferredProvider === "voxcpm") {
    candidates.push({
      candidateId: "fallback:voxcpm-default",
      source: "narration_fallback",
      provider: "voxcpm",
      voiceId: "__voxcpm_default__",
      voiceProfile: {
        provider: "voxcpm",
        voiceId: "__voxcpm_default__",
        defaultParameters: {},
      },
      isDefault: true,
      routingWeight: 1,
    });
  }

  return candidates;
}

export async function resolveVoiceRouteForSentence(params: {
  scriptSentence: any;
  request: AudioGenerationRequest;
  options: AudioGenerationOptions;
  prismaClient: typeof prisma;
}): Promise<VoiceRouteResolution | null> {
  const { scriptSentence, request, options, prismaClient } = params;
  const policyVersion = resolveRouterPolicyVersion(scriptSentence, options);
  const preferredProvider =
    typeof options.preferredProvider === "string" && options.preferredProvider.trim()
      ? options.preferredProvider.trim().toLowerCase()
      : null;
  const context: AudioRouteContext = {
    roleType: typeof scriptSentence.roleType === "string" ? scriptSentence.roleType : null,
    emotionLabel:
      typeof scriptSentence.emotionLabel === "string" &&
      scriptSentence.emotionLabel.trim()
        ? scriptSentence.emotionLabel
        : scriptSentence.tone,
    priority: typeof scriptSentence.priority === "string" ? scriptSentence.priority : null,
    engineHint:
      typeof scriptSentence.engineHint === "string" ? scriptSentence.engineHint : null,
    preferredProvider,
    policyVersion,
    debugEnabled: options.enableRouterDebug === true,
  };

  const candidates = await collectRouteCandidates({
    scriptSentence,
    request,
    options,
    prismaClient,
  });
  if (candidates.length === 0) {
    return null;
  }

  const providers = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.provider.trim().toLowerCase())
        .filter((provider) => provider.length > 0)
    )
  );

  const engineHealth = await getEngineHealthSnapshot({
    bookId: scriptSentence.bookId,
    providers,
    prismaClient,
  });
  const selection = selectAudioRouteCandidate({
    candidates,
    context,
    engineHealth,
  });

  return {
    selectedCandidate: selection.selectedCandidate,
    rankedCandidates: selection.rankedCandidates,
    routeDecision: selection.decision,
  };
}
