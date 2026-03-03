import prisma from "@/lib/prisma";
import { addCharacterToMap } from "./character-utils";
import type { DialogueLine, GeneratedScript } from "../types";

interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
}

const buildSentenceData = (
  bookId: string,
  line: DialogueLine,
  characterId: string | null
) => {
  return {
    bookId,
    segmentId: line.segmentId,
    chapterId: line.chapterId ?? null,
    characterId,
    rawSpeaker: line.rawSpeaker || line.characterName || null,
    text: line.text,
    tone: line.tone,
    strength:
      typeof line.strength === "number"
        ? Math.max(0, Math.min(100, Math.round(line.strength)))
        : 75,
    pauseAfter:
      typeof line.pauseAfter === "number"
        ? Number(line.pauseAfter.toFixed(1))
        : 1.5,
    orderInSegment: line.orderInSegment,
    ttsParameters: line.ttsParameters || {},
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
