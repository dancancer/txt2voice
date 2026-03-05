import prisma, { Prisma } from "@/lib/prisma";
import { addCharacterToMap } from "./character-utils";
import type { DialogueLine, GeneratedScript } from "../types";

interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

const EMOTION_LABEL_MAP: Array<{ label: string; aliases: string[] }> = [
  { label: "calm", aliases: ["平静", "冷静", "calm", "neutral", "中性"] },
  { label: "joy", aliases: ["开心", "喜悦", "兴奋", "joy", "happy"] },
  { label: "angry", aliases: ["愤怒", "生气", "angry"] },
  { label: "sad", aliases: ["悲伤", "伤心", "sad"] },
  { label: "cold", aliases: ["冷笑", "冷漠", "cold"] },
  { label: "romantic_arousal", aliases: ["春情萌动", "暧昧", "romantic"] },
];

export const normalizeEmotionLabel = (tone?: string | null): string => {
  if (!tone || tone.trim().length === 0) {
    return "calm";
  }

  const normalizedTone = tone.trim().toLowerCase();
  const matched = EMOTION_LABEL_MAP.find(({ aliases }) =>
    aliases.some((alias) => normalizedTone.includes(alias.toLowerCase()))
  );

  return matched?.label || "calm";
};

const resolveRoleType = (line: DialogueLine): string => {
  const speaker = (line.characterName || line.rawSpeaker || "").trim();
  return line.isNarration || speaker === "旁白" ? "narration" : "dialogue";
};

const resolveEmotionIntensity = (strength?: number): number | null => {
  if (typeof strength !== "number" || Number.isNaN(strength)) {
    return null;
  }

  const value = Math.max(0, Math.min(100, strength)) / 100;
  return Number(value.toFixed(2));
};

const resolveEngineHint = (line: DialogueLine): string | null => {
  const ttsParams = asRecord(line.ttsParameters);
  if (!ttsParams) {
    return null;
  }

  const directHint = ttsParams.engineHint;
  if (typeof directHint === "string" && directHint.trim().length > 0) {
    return directHint.trim();
  }

  const hints = asRecord(ttsParams.ttsHints);
  const hintEngine = hints?.engine ?? hints?.provider;
  return typeof hintEngine === "string" && hintEngine.trim().length > 0
    ? hintEngine.trim()
    : null;
};

const resolvePriority = (line: DialogueLine): string => {
  const text = line.text.trim();
  if (text.includes("！") || text.includes("!")) {
    return "high";
  }
  if (text.length <= 6) {
    return "low";
  }
  return "normal";
};

const resolveProsody = (line: DialogueLine): Record<string, number> => {
  const ttsParams = asRecord(line.ttsParameters);
  const hints = asRecord(ttsParams?.ttsHints);

  const pace =
    typeof hints?.rate === "number" && Number.isFinite(hints.rate)
      ? Number(hints.rate.toFixed(2))
      : 1;
  const pitch =
    typeof hints?.pitch === "number" && Number.isFinite(hints.pitch)
      ? Number(hints.pitch.toFixed(2))
      : 0;
  const pauseMsAfter =
    typeof line.pauseAfter === "number" && Number.isFinite(line.pauseAfter)
      ? Math.round(line.pauseAfter * 1000)
      : 1500;

  return {
    pace,
    pitch,
    pauseMsAfter,
  };
};

const buildSentenceData = (
  bookId: string,
  line: DialogueLine,
  characterId: string | null
) => {
  const roleType = resolveRoleType(line);

  return {
    bookId,
    segmentId: line.segmentId,
    chapterId: line.chapterId ?? null,
    characterId,
    rawSpeaker: line.rawSpeaker || line.characterName || null,
    text: line.text,
    tone: line.tone,
    roleType,
    emotionLabel: normalizeEmotionLabel(line.tone),
    emotionIntensity: resolveEmotionIntensity(line.strength),
    engineHint: resolveEngineHint(line),
    priority: line.priority || resolvePriority(line),
    prosody: toJsonValue(line.prosody ?? resolveProsody(line)),
    strength:
      typeof line.strength === "number"
        ? Math.max(0, Math.min(100, Math.round(line.strength)))
        : 75,
    pauseAfter:
      typeof line.pauseAfter === "number"
        ? Number(line.pauseAfter.toFixed(1))
        : 1.5,
    orderInSegment: line.orderInSegment,
    ttsParameters: toJsonValue(line.ttsParameters || {}),
  };
};

export async function saveSegmentScriptToDatabase(params: {
  bookId: string;
  segmentId: string;
  dialogueLines: DialogueLine[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
}): Promise<void> {
  const { bookId, segmentId, dialogueLines, characterProfiles, characterMap } =
    params;

  await prisma.$transaction(async (tx) => {
    await tx.scriptSentence.deleteMany({
      where: {
        bookId,
        segmentId,
      },
    });

    for (const line of dialogueLines) {
      let character = characterProfiles.find(
        (char) => char.canonicalName === line.characterName
      );

      if (!character && line.characterName && line.characterName !== "旁白") {
        const newCharacter = await tx.characterProfile.create({
          data: {
            bookId,
            canonicalName: line.characterName,
            characteristics: {
              description: `台本生成自动创建的角色：${line.characterName}`,
              personality: [],
              importance: "minor",
              relationships: {},
            },
            voicePreferences: {
              dialogueStyle: "自然",
            },
            genderHint: "unknown",
            ageHint: null,
            emotionBaseline: "neutral",
            isActive: true,
          },
        });

        character = {
          ...newCharacter,
          aliases: [],
        };

        characterProfiles.push(character);
        addCharacterToMap(characterMap, character);
        console.log(`自动创建新角色: ${line.characterName}`);
      }

      let characterId: string | null = null;
      if (character?.id) {
        characterId = character.id;
      } else if (line.characterName !== "旁白") {
        console.warn(`未找到角色: ${line.characterName}`);
      }

      await tx.scriptSentence.create({
        data: buildSentenceData(bookId, line, characterId),
      });
    }
  });
}

const resolveCharacterId = async (params: {
  tx: any;
  bookId: string;
  line: DialogueLine;
}): Promise<string | null> => {
  const { tx, bookId, line } = params;

  const character = await tx.characterProfile.findFirst({
    where: {
      bookId,
      canonicalName: line.characterName,
      isActive: true,
    },
  });

  if (character) {
    return character.id;
  }

  if (line.characterName !== "旁白") {
    console.warn(`未找到角色: ${line.characterName}`);
  }

  return null;
};

export async function savePartialScriptToDatabase(
  bookId: string,
  script: GeneratedScript
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const segmentIds = script.segments.map((seg) => seg.segmentId);

    await tx.scriptSentence.deleteMany({
      where: {
        bookId,
        segmentId: { in: segmentIds },
      },
    });

    for (const line of script.dialogueLines) {
      const characterId = await resolveCharacterId({ tx, bookId, line });
      await tx.scriptSentence.create({
        data: buildSentenceData(bookId, line, characterId),
      });
    }

    await tx.book.update({
      where: { id: bookId },
      data: {
        status: "script_generated",
        metadata: {
          scriptGeneratedAt: new Date().toISOString(),
          lastPartialGenerationAt: new Date().toISOString(),
          partialGenerationSegments: segmentIds.length,
        },
      },
    });
  });
}

export async function saveScriptToDatabase(
  bookId: string,
  script: GeneratedScript
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.scriptSentence.deleteMany({
      where: { bookId },
    });

    for (const line of script.dialogueLines) {
      const characterId = await resolveCharacterId({ tx, bookId, line });
      await tx.scriptSentence.create({
        data: buildSentenceData(bookId, line, characterId),
      });
    }

    await tx.book.update({
      where: { id: bookId },
      data: {
        status: "script_generated",
        metadata: {
          scriptGeneratedAt: new Date().toISOString(),
          totalScriptLines: script.summary.totalLines,
          dialogueCount: script.summary.dialogueCount,
          narrationCount: script.summary.narrationCount,
        },
      },
    });
  });
}
