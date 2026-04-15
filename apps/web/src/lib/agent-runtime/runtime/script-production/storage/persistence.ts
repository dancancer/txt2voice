import prisma, { Prisma } from "@/lib/prisma";
import { addCharacterToMap } from "./character-utils";
import {
  buildSentenceData,
  CharacterProfileLike,
  isNarrationLine,
  mapSegmentScriptDraftToDialogueLines,
  mergeProfileBuckets,
  SegmentScriptDraftLike,
} from "./persistence-helpers";
import type { DialogueLine, GeneratedScript } from "../types";
import {
  ensureNarrationCharacter,
} from "@/lib/narration-character";

type ScriptPersistenceClient = Prisma.TransactionClient;

const saveSegmentScriptToDatabaseWithDb = async (params: {
  bookId: string;
  segmentId: string;
  dialogueLines: DialogueLine[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  db: ScriptPersistenceClient;
}): Promise<void> => {
  const { bookId, segmentId, dialogueLines, characterProfiles, characterMap } =
    params;
  const { db } = params;

  const existingProfiles = await db.characterProfile.findMany({
    where: {
      bookId,
      isActive: true,
    },
    include: {
      aliases: true,
    },
  });
  const runtimeProfiles = mergeProfileBuckets(characterProfiles, existingProfiles);
  const runtimeMap = new Map(characterMap);
  const profileByCanonical = new Map<string, CharacterProfileLike>();

  for (const profile of runtimeProfiles) {
    if (!profile?.canonicalName) {
      continue;
    }
    profileByCanonical.set(profile.canonicalName, profile);
    addCharacterToMap(runtimeMap, profile);
    addCharacterToMap(characterMap, profile);
  }

  await db.scriptSentence.deleteMany({
    where: {
      bookId,
      segmentId,
    },
  });

  for (const line of dialogueLines) {
    const speaker = (line.characterName || "").trim();
    const canonicalName = speaker
      ? runtimeMap.get(speaker) || speaker
      : undefined;
    const character = canonicalName
      ? profileByCanonical.get(canonicalName)
      : undefined;

    let characterId: string | null = null;
    if (character?.id) {
      characterId = character.id;
    } else if (!isNarrationLine(line)) {
      console.warn(`未找到角色: ${line.characterName}`);
    }

    await db.scriptSentence.create({
      data: buildSentenceData(bookId, line, characterId),
    });
  }
};

export async function saveSegmentScriptToDatabase(params: {
  bookId: string;
  segmentId: string;
  dialogueLines: DialogueLine[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  db?: ScriptPersistenceClient;
}): Promise<void> {
  if (params.db) {
    await saveSegmentScriptToDatabaseWithDb({
      ...params,
      db: params.db,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await saveSegmentScriptToDatabaseWithDb({
      ...params,
      db: tx,
    });
  });
}

export { mapSegmentScriptDraftToDialogueLines, normalizeEmotionLabel } from "./persistence-helpers";

const resolveCharacterId = async (params: {
  tx: any;
  bookId: string;
  line: DialogueLine;
  narrationCharacterId?: string | null;
}): Promise<string | null> => {
  const { tx, bookId, line, narrationCharacterId } = params;

  if (isNarrationLine(line)) {
    if (narrationCharacterId) {
      return narrationCharacterId;
    }
    const narrationCharacter = await ensureNarrationCharacter(bookId, tx);
    return narrationCharacter.id;
  }

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

  if (!isNarrationLine(line)) {
    console.warn(`未找到角色: ${line.characterName}`);
  }

  return null;
};

export async function savePartialScriptToDatabase(
  bookId: string,
  script: GeneratedScript
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const narrationCharacter = script.dialogueLines.some(isNarrationLine)
      ? await ensureNarrationCharacter(bookId, tx)
      : null;
    const segmentIds = script.segments.map((seg) => seg.segmentId);

    await tx.scriptSentence.deleteMany({
      where: {
        bookId,
        segmentId: { in: segmentIds },
      },
    });

    for (const line of script.dialogueLines) {
      const characterId = await resolveCharacterId({
        tx,
        bookId,
        line,
        narrationCharacterId: narrationCharacter?.id ?? null,
      });
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
    const narrationCharacter = script.dialogueLines.some(isNarrationLine)
      ? await ensureNarrationCharacter(bookId, tx)
      : null;
    await tx.scriptSentence.deleteMany({
      where: { bookId },
    });

    for (const line of script.dialogueLines) {
      const characterId = await resolveCharacterId({
        tx,
        bookId,
        line,
        narrationCharacterId: narrationCharacter?.id ?? null,
      });
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
