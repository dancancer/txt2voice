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

    // 获取角色列表
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
      orderBy: [{ mentions: "desc" }, { canonicalName: "asc" }],
      skip: offset,
      take: limit,
    });

    // 格式化返回数据
    const formattedCharacters = characters.map((character) => ({
      id: character.id,
      canonicalName: character.canonicalName,
      characteristics: character.characteristics,
      genderHint: character.genderHint,
      ageHint: character.ageHint,
      emotionBaseline: character.emotionBaseline,
      isActive: character.isActive,
      mentions: character.mentions,
      quotes: character.quotes,
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
