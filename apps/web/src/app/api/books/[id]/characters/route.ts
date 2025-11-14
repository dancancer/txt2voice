import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getPaginationFromSearch,
  parsePaginationParams,
  createPaginationResult,
} from "@/lib/pagination";

// GET /api/books/[id]/characters - 获取书籍角色列表（分页）
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析分页参数
    const paginationParams = getPaginationFromSearch(searchParams);
    const { page, limit, offset } = parsePaginationParams(paginationParams);

    // 解析过滤参数
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    // 构建查询条件
    const where: any = { bookId };
    if (isActive !== null) {
      where.isActive = isActive === "true";
    }
    if (search) {
      where.OR = [
        { canonicalName: { contains: search, mode: "insensitive" } },
        {
          aliases: {
            some: { alias: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    // 获取总数
    const total = await prisma.characterProfile.count({ where });

    // 获取角色列表（获取所有数据，然后在内存中排序）
    const characters = await prisma.characterProfile.findMany({
      where,
      include: {
        aliases: {
          select: {
            id: true,
            alias: true,
            confidence: true,
          },
        },
        voiceBindings: {
          include: {
            voiceProfile: {
              select: {
                id: true,
                provider: true,
                voiceId: true,
                voiceName: true,
                displayName: true,
                isAvailable: true,
              },
            },
          },
        },
        _count: {
          select: {
            scriptSentences: true,
          },
        },
      },
      skip: offset,
      take: limit * 2, // 获取更多数据以便在内存中正确排序
    });

    // 解析 characteristics.description 中的提及数和对话数
    const parseMentionsAndQuotes = (characteristics: any) => {
      const description = characteristics?.description || '';
      const mentionsMatch = description.match(/提及(\d+)次/);
      const quotesMatch = description.match(/对话(\d+)次/);

      return {
        mentions: mentionsMatch ? parseInt(mentionsMatch[1]) : 0,
        quotes: quotesMatch ? parseInt(quotesMatch[1]) : 0
      };
    };

    // 在内存中解析并排序
    const charactersWithParsedData = characters.map((character) => {
      const parsed = parseMentionsAndQuotes(character.characteristics);
      return {
        ...character,
        parsedMentions: parsed.mentions,
        parsedQuotes: parsed.quotes
      };
    });

    // 排序
    charactersWithParsedData.sort((a, b) => {
      // 1. 按提及次数降序
      if (b.parsedMentions !== a.parsedMentions) {
        return b.parsedMentions - a.parsedMentions;
      }
      // 2. 按引用次数降序
      if (b.parsedQuotes !== a.parsedQuotes) {
        return b.parsedQuotes - a.parsedQuotes;
      }
      // 3. 按对话次数降序
      if (b._count.scriptSentences !== a._count.scriptSentences) {
        return b._count.scriptSentences - a._count.scriptSentences;
      }
      // 4. 按角色名称升序
      return a.canonicalName.localeCompare(b.canonicalName);
    });

    // 取前 limit 条记录
    const sortedCharacters = charactersWithParsedData.slice(0, limit);

    // 格式化返回数据
    const formattedCharacters = sortedCharacters.map((character) => ({
      id: character.id,
      canonicalName: character.canonicalName,
      characteristics: character.characteristics,
      genderHint: character.genderHint,
      ageHint: character.ageHint,
      emotionBaseline: character.emotionBaseline,
      isActive: character.isActive,
      mentions: character.parsedMentions,
      quotes: character.parsedQuotes,
      aliases: character.aliases,
      voiceBindings: character.voiceBindings.map((binding) => ({
        id: binding.id,
        isDefault: binding.isDefault,
        customParameters: binding.customParameters,
        emotionMappings: binding.emotionMappings,
        voiceProfile: binding.voiceProfile,
      })),
      scriptSentencesCount: character._count.scriptSentences,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    }));

    const result = createPaginationResult(
      formattedCharacters,
      total,
      page,
      limit
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

// POST /api/books/[id]/characters - 创建新角色
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const {
      canonicalName,
      characteristics,
      genderHint,
      ageHint,
      emotionBaseline,
    } = body;

    // 检查书籍是否存在
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 检查角色名是否已存在
    const existingCharacter = await prisma.characterProfile.findFirst({
      where: {
        bookId,
        canonicalName: canonicalName.toLowerCase(),
      },
    });

    if (existingCharacter) {
      throw new ValidationError("角色名已存在");
    }

    const character = await prisma.characterProfile.create({
      data: {
        bookId,
        canonicalName: canonicalName.trim(),
        characteristics: characteristics || {},
        genderHint: genderHint || "unknown",
        ageHint: ageHint,
        emotionBaseline: emotionBaseline || "neutral",
      },
      include: {
        aliases: true,
        voiceBindings: {
          include: {
            voiceProfile: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: character,
    });
  }
);
