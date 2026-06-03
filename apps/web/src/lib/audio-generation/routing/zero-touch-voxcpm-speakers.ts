// 一旦我被更新，请更新我的开头注释
// input: 台词/音频请求/路由选项/Prisma 客户端
// output: 带稳定 VoxCPM speaker binding 的台词对象
// pos: 音频路由前置补全
import type prisma from "@/lib/prisma";
import { isNarrationSpeaker } from "@/lib/narration-character";

import type {
  AudioGenerationOptions,
  AudioGenerationRequest,
} from "../types";

const VOXCPM_PROVIDER = "voxcpm";
const VOXCPM_VOICE_ID = "__voxcpm_default__";
const NARRATOR_ROLE = "narrator";

const isZeroTouchVoxCpm = (
  request: AudioGenerationRequest,
  options: AudioGenerationOptions
): boolean =>
  !request.voiceProfileId &&
  typeof options.preferredProvider === "string" &&
  options.preferredProvider.trim().toLowerCase() === VOXCPM_PROVIDER;

const speakerBindingInclude = {
  speakerProfile: {
    include: {
      engineVariants: {
        where: { isActive: true },
        include: { emotionPresets: { where: { isActive: true } } },
        orderBy: [
          { isDefault: "desc" as const },
          { routingWeight: "desc" as const },
          { createdAt: "asc" as const },
        ],
      },
    },
  },
};

const hasVoxCpmVariant = (character: any): boolean =>
  (character?.speakerBindings || []).some((binding: any) =>
    (binding.speakerProfile?.engineVariants || []).some(
      (variant: any) =>
        variant?.isActive !== false &&
        typeof variant.engine === "string" &&
        variant.engine.trim().toLowerCase() === VOXCPM_PROVIDER
    )
  );

const shouldUseNarrator = (sentence: any): boolean =>
  sentence?.roleType === "narration" ||
  isNarrationSpeaker(sentence?.rawSpeaker || "") ||
  isNarrationSpeaker(sentence?.character?.canonicalName || "");

const loadNarrator = async (params: {
  scriptSentence: any;
  prismaClient: typeof prisma;
}) => {
  const { scriptSentence, prismaClient } = params;
  const existing = await prismaClient.characterProfile.findFirst({
    where: {
      bookId: scriptSentence.bookId,
      systemRoleType: NARRATOR_ROLE,
    },
    include: { speakerBindings: { include: speakerBindingInclude } },
  });
  if (existing) return existing;

  return prismaClient.characterProfile.create({
    data: {
      bookId: scriptSentence.bookId,
      canonicalName: "旁白",
      isSystemRole: true,
      systemRoleType: NARRATOR_ROLE,
      genderHint: "unknown",
      characteristics: {},
      voicePreferences: {},
      emotionProfile: {},
    },
    include: { speakerBindings: { include: speakerBindingInclude } },
  });
};

const resolveCharacter = async (params: {
  scriptSentence: any;
  prismaClient: typeof prisma;
}) => {
  const { scriptSentence, prismaClient } = params;
  if (scriptSentence.character) return scriptSentence.character;
  if (!shouldUseNarrator(scriptSentence)) return null;

  const character = await loadNarrator(params);
  await prismaClient.scriptSentence.update({
    where: { id: scriptSentence.id },
    data: { characterId: character.id },
  });
  return character;
};

const buildSpeakerBinding = (params: {
  characterId: string;
  speakerProfile: any;
  variant: any;
}) => ({
  id: `zero-touch:${params.characterId}:${params.speakerProfile.id}`,
  isDefault: true,
  speakerProfile: {
    ...params.speakerProfile,
    engineVariants: [params.variant],
  },
});

const createVoxCpmBinding = async (params: {
  character: any;
  prismaClient: typeof prisma;
}) => {
  const { character, prismaClient } = params;
  const speakerProfile = await prismaClient.speakerProfile.create({
    data: {
      name: character.canonicalName || "旁白",
      gender: character.genderHint || "unknown",
      ageGroup: "adult",
      toneStyle: "neutral",
      metadata: {
        source: "zero_touch_voxcpm",
        characterId: character.id,
      },
    },
  });
  const variant = await prismaClient.speakerEngineVariant.create({
    data: {
      speakerProfileId: speakerProfile.id,
      engine: VOXCPM_PROVIDER,
      providerVoiceId: VOXCPM_VOICE_ID,
      referenceAudio: null,
      capability: {
        dialogue: true,
        narration: true,
        defaultParameters: {},
      },
      routingWeight: 1,
      isDefault: true,
      isActive: true,
    },
  });
  await prismaClient.characterSpeakerBinding.create({
    data: {
      characterId: character.id,
      speakerProfileId: speakerProfile.id,
      isDefault: true,
      metadata: { source: "zero_touch_voxcpm" },
    },
  });
  return buildSpeakerBinding({ characterId: character.id, speakerProfile, variant });
};

export const ensureZeroTouchVoxCpmSpeakerRoute = async (params: {
  scriptSentence: any;
  request: AudioGenerationRequest;
  options: AudioGenerationOptions;
  prismaClient: typeof prisma;
}) => {
  const { scriptSentence, request, options, prismaClient } = params;
  if (!isZeroTouchVoxCpm(request, options)) return scriptSentence;

  const character = await resolveCharacter({ scriptSentence, prismaClient });
  if (!character?.id || hasVoxCpmVariant(character)) {
    return character ? { ...scriptSentence, character } : scriptSentence;
  }

  const speakerBinding = await createVoxCpmBinding({ character, prismaClient });
  return {
    ...scriptSentence,
    character: {
      ...character,
      speakerBindings: [speakerBinding, ...(character.speakerBindings || [])],
    },
  };
};
