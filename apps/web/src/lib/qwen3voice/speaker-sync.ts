// 一旦我被更新，请更新我的开头注释
// input: 远端 qwen speaker/prisma 客户端
// output: 本地 speaker/voice 同步结果
// pos: qwen3voice 同步辅助
import type prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import type { Qwen3VoiceSpeaker, Qwen3VoiceTTSService } from "@/lib/tts/providers/qwen3voice";

const DEFAULT_VOICE_PARAMS = {
  rate: 1,
  pitch: 0,
  volume: 1,
};

const resolveLanguage = (language?: string | null): string =>
  typeof language === "string" && language.toLowerCase().includes("english")
    ? "en-US"
    : "zh-CN";

const buildSpeakerMetadata = (speaker: Qwen3VoiceSpeaker) => ({
  qwen3voiceSpeakerId: speaker.id,
  qwen3voice: {
    sourceType: speaker.source_type || "remote",
    language: speaker.language || "Chinese",
    referenceText: speaker.reference_text || "",
    tags: Array.isArray(speaker.tags) ? speaker.tags : [],
    referenceAudioUrl: speaker.reference_audio_url || null,
    previewAudioUrl: speaker.preview_audio_url || null,
  },
});

const findRemoteSpeaker = async (
  service: Qwen3VoiceTTSService,
  remoteSpeakerId: string
): Promise<Qwen3VoiceSpeaker> => {
  const speakers = await service.listSpeakers();
  const speaker = speakers.find((item) => item.id === remoteSpeakerId);
  if (!speaker) {
    throw new ValidationError("远端说话人不存在");
  }
  return speaker;
};

export async function syncQwen3VoiceSpeakerAssets(params: {
  remoteSpeakerId: string;
  prismaClient: typeof prisma;
  service: Qwen3VoiceTTSService;
}) {
  const { remoteSpeakerId, prismaClient, service } = params;
  const remoteSpeaker = await findRemoteSpeaker(service, remoteSpeakerId);
  const speakerMetadata = buildSpeakerMetadata(remoteSpeaker);

  const existingSpeakerProfile = await prismaClient.speakerProfile.findFirst({
    where: {
      metadata: {
        path: ["qwen3voiceSpeakerId"],
        equals: remoteSpeaker.id,
      },
    },
  });

  const speakerProfile = existingSpeakerProfile
    ? await prismaClient.speakerProfile.update({
        where: { id: existingSpeakerProfile.id },
        data: {
          name: remoteSpeaker.name,
          description: remoteSpeaker.reference_text || existingSpeakerProfile.description,
          referenceAudio:
            remoteSpeaker.reference_audio_url ||
            remoteSpeaker.preview_audio_url ||
            existingSpeakerProfile.referenceAudio,
          metadata: speakerMetadata,
          isActive: true,
          syncedAt: new Date(),
        },
      })
    : await prismaClient.speakerProfile.create({
        data: {
          name: remoteSpeaker.name,
          description: remoteSpeaker.reference_text || null,
          referenceAudio:
            remoteSpeaker.reference_audio_url || remoteSpeaker.preview_audio_url || null,
          metadata: speakerMetadata,
          isActive: true,
          syncedAt: new Date(),
        },
      });

  const existingVoiceProfile = await prismaClient.tTSVoiceProfile.findFirst({
    where: {
      provider: "qwen3voice",
      voiceId: remoteSpeaker.id,
    },
  });

  const voiceProfile = existingVoiceProfile
    ? await prismaClient.tTSVoiceProfile.update({
        where: { id: existingVoiceProfile.id },
        data: {
          voiceName: remoteSpeaker.name,
          displayName: remoteSpeaker.name,
          description: remoteSpeaker.reference_text || existingVoiceProfile.description,
          characteristics: {
            language: resolveLanguage(remoteSpeaker.language),
            gender: "neutral",
            ageRange: "adult",
            style: Array.isArray(remoteSpeaker.tags) ? remoteSpeaker.tags : [],
            sourceType: remoteSpeaker.source_type || "remote",
          },
          defaultParameters: DEFAULT_VOICE_PARAMS,
          isAvailable: true,
        },
      })
    : await prismaClient.tTSVoiceProfile.create({
        data: {
          provider: "qwen3voice",
          voiceId: remoteSpeaker.id,
          voiceName: remoteSpeaker.name,
          displayName: remoteSpeaker.name,
          description: remoteSpeaker.reference_text || null,
          characteristics: {
            language: resolveLanguage(remoteSpeaker.language),
            gender: "neutral",
            ageRange: "adult",
            style: Array.isArray(remoteSpeaker.tags) ? remoteSpeaker.tags : [],
            sourceType: remoteSpeaker.source_type || "remote",
          },
          defaultParameters: DEFAULT_VOICE_PARAMS,
          isAvailable: true,
        },
      });

  return {
    remoteSpeaker,
    speakerProfile,
    voiceProfile,
  };
}

export async function ensureCharacterVoiceBinding(params: {
  characterId: string;
  voiceProfileId: string;
  isDefault: boolean;
  prismaClient: typeof prisma;
}) {
  const { characterId, voiceProfileId, isDefault, prismaClient } = params;

  const existingBinding = await prismaClient.characterVoiceBinding.findFirst({
    where: {
      characterId,
      voiceProfileId,
    },
  });

  if (isDefault) {
    await prismaClient.characterVoiceBinding.updateMany({
      where: {
        characterId,
        isDefault: true,
        ...(existingBinding ? { id: { not: existingBinding.id } } : {}),
      },
      data: { isDefault: false },
    });
  }

  if (existingBinding) {
    return prismaClient.characterVoiceBinding.update({
      where: { id: existingBinding.id },
      data: {
        isDefault: isDefault || existingBinding.isDefault,
      },
    });
  }

  return prismaClient.characterVoiceBinding.create({
    data: {
      characterId,
      voiceProfileId,
      isDefault,
    },
  });
}
