import { NextResponse, NextRequest } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const SKIPPED_SPEAKERS = ["旁白", "narrator"];

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const scriptSentences = await prisma.scriptSentence.findMany({
      where: { bookId },
      select: {
        id: true,
        rawSpeaker: true,
        characterId: true,
      },
    });

    if (scriptSentences.length === 0) {
      throw new ValidationError("没有可供抽取的台本句子");
    }

    const speakerMap = new Map<
      string,
      { name: string; count: number; sentenceIds: string[] }
    >();

    scriptSentences.forEach((sentence) => {
      const raw = sentence.rawSpeaker?.trim();
      if (!raw) return;
      const normalized = raw.toLowerCase();
      if (SKIPPED_SPEAKERS.includes(normalized)) return;

      if (!speakerMap.has(normalized)) {
        speakerMap.set(normalized, {
          name: raw,
          count: 0,
          sentenceIds: [],
        });
      }

      const entry = speakerMap.get(normalized)!;
      entry.count += 1;
      if (!sentence.characterId) {
        entry.sentenceIds.push(sentence.id);
      }
    });

    if (speakerMap.size === 0) {
      throw new ValidationError("台本中没有可识别的角色信息");
    }

    const existingCharacters = await prisma.characterProfile.findMany({
      where: { bookId },
      include: { aliases: true },
    });

    const existingNameMap = new Map<
      string,
      { id: string; canonicalName: string }
    >();
    existingCharacters.forEach((character) => {
      existingNameMap.set(character.canonicalName.toLowerCase(), {
        id: character.id,
        canonicalName: character.canonicalName,
      });
      character.aliases.forEach((alias) => {
        if (!alias.alias) return;
        existingNameMap.set(alias.alias.toLowerCase(), {
          id: character.id,
          canonicalName: character.canonicalName,
        });
      });
    });

    let createdCount = 0;
    let linkedSentences = 0;
    const createdCharacters: Array<{ id: string; canonicalName: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const [key, entry] of speakerMap.entries()) {
        const existing = existingNameMap.get(key);
        if (existing) {
          if (entry.sentenceIds.length > 0) {
            const updateResult = await tx.scriptSentence.updateMany({
              where: {
                id: { in: entry.sentenceIds },
                characterId: null,
              },
              data: { characterId: existing.id },
            });
            linkedSentences += updateResult.count;
          }
          continue;
        }

        if (entry.sentenceIds.length === 0) {
          // 所有台词都已经绑定到了其他角色，跳过创建
          continue;
        }

        const description = `提及${entry.count}次，对话${entry.count}次（台本抽取）`;
        const profile = await tx.characterProfile.create({
          data: {
            bookId,
            canonicalName: entry.name.trim(),
            characteristics: {
              description,
              source: "script_extraction",
            },
            voicePreferences: {},
            emotionProfile: {},
            genderHint: "unknown",
            emotionBaseline: "neutral",
            mentions: entry.count,
            quotes: entry.count,
            isActive: true,
          },
        });
        createdCount += 1;
        createdCharacters.push({
          id: profile.id,
          canonicalName: profile.canonicalName,
        });

        if (entry.sentenceIds.length > 0) {
          const updateResult = await tx.scriptSentence.updateMany({
            where: {
              id: { in: entry.sentenceIds },
              characterId: null,
            },
            data: { characterId: profile.id },
          });
          linkedSentences += updateResult.count;
        }
      }
    });

    logger.info("Script character extraction completed", {
      bookId,
      createdCount,
      linkedSentences,
    });

    return NextResponse.json({
      success: true,
      data: {
        createdCount,
        linkedSentences,
        detectedSpeakers: speakerMap.size,
        createdCharacters,
      },
    });
  }
);
