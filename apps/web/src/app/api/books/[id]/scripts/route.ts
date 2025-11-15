import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getPaginationFromSearch,
  parsePaginationParams,
  createPaginationResult,
} from "@/lib/pagination";

// GET /api/books/[id]/scripts - 获取书籍台本列表（分页）
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
    const characterId = searchParams.get("characterId");
    const segmentId = searchParams.get("segmentId");
    const search = searchParams.get("search");
    const tone = searchParams.get("tone");

    // 构建查询条件
    const where: any = { bookId };
    if (characterId) {
      where.characterId = characterId;
    }
    if (segmentId) {
      where.segmentId = segmentId;
    }
    if (search) {
      where.text = { contains: search, mode: "insensitive" };
    }
    if (tone) {
      where.tone = tone;
    }

    // 获取总数
    const total = await prisma.scriptSentence.count({ where });

    // 获取台本列表
    const scripts = await prisma.scriptSentence.findMany({
      where,
      include: {
        character: {
          select: {
            id: true,
            canonicalName: true,
            genderHint: true,
            emotionBaseline: true,
          },
        },
        segment: {
          select: {
            id: true,
            content: true,
            segmentIndex: true,
            orderIndex: true,
          },
        },
        audioFiles: {
          select: {
            id: true,
            filePath: true,
            duration: true,
            status: true,
            provider: true,
            voiceProfile: {
              select: {
                id: true,
                voiceName: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [{ segmentId: "asc" }, { orderInSegment: "asc" }],
      skip: offset,
      take: limit,
    });

    // 格式化返回数据
    const formattedScripts = scripts.map((script) => ({
      id: script.id,
      bookId: script.bookId,
      segmentId: script.segmentId,
      characterId: script.characterId,
      text: script.text,
      rawSpeaker: script.rawSpeaker,
      tone: script.tone,
      strength: script.strength,
      pauseAfter: script.pauseAfter,
      ttsParameters: script.ttsParameters,
      orderInSegment: script.orderInSegment,
      character: script.character,
      segment: script.segment,
      audioFiles: script.audioFiles,
      createdAt: script.createdAt,
    }));

    const result = createPaginationResult(formattedScripts, total, page, limit);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

// POST /api/books/[id]/scripts - 创建新台本句子
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const {
      segmentId,
      characterId,
      text,
      rawSpeaker,
      tone,
      strength,
      pauseAfter,
      ttsParameters,
      orderInSegment,
    } = body;

    // 检查书籍是否存在
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 检查分段是否存在
    const segment = await prisma.textSegment.findFirst({
      where: { id: segmentId, bookId },
    });

    if (!segment) {
      throw new ValidationError("分段不存在");
    }

    // 如果指定了角色ID，检查角色是否存在
    if (characterId) {
      const character = await prisma.characterProfile.findFirst({
        where: { id: characterId, bookId },
      });

      if (!character) {
        throw new ValidationError("角色不存在");
      }
    }

    // 如果没有指定orderInSegment，获取当前分段的最大orderInSegment
    let finalOrderInSegment = orderInSegment;
    if (finalOrderInSegment === undefined) {
      const maxOrder = await prisma.scriptSentence.findFirst({
        where: { segmentId },
        orderBy: { orderInSegment: "desc" },
        select: { orderInSegment: true },
      });
      finalOrderInSegment = (maxOrder?.orderInSegment || 0) + 1;
    }

    const script = await prisma.scriptSentence.create({
      data: {
        bookId,
        segmentId,
        characterId,
        text: text.trim(),
        rawSpeaker,
        tone,
        strength,
        pauseAfter,
        ttsParameters,
        orderInSegment: finalOrderInSegment,
      },
      include: {
        character: {
          select: {
            id: true,
            canonicalName: true,
            genderHint: true,
            emotionBaseline: true,
          },
        },
        segment: {
          select: {
            id: true,
            content: true,
            segmentIndex: true,
            orderIndex: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: script,
    });
  }
);

// PUT /api/books/[id]/scripts - 批量更新台本句子
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const { scripts } = body;

    if (!Array.isArray(scripts) || scripts.length === 0) {
      throw new ValidationError("请提供要更新的台本句子列表");
    }

    // 验证所有台本句子都属于该书籍
    const scriptIds = scripts.map((s) => s.id);
    const existingScripts = await prisma.scriptSentence.findMany({
      where: {
        id: { in: scriptIds },
        bookId,
      },
    });

    if (existingScripts.length !== scripts.length) {
      throw new ValidationError("部分台本句子不存在或不属于该书籍");
    }

    // 批量更新
    const updatePromises = scripts.map((script) =>
      prisma.scriptSentence.update({
        where: { id: script.id },
        data: {
          characterId: script.characterId,
          text: script.text?.trim(),
          rawSpeaker: script.rawSpeaker,
          tone: script.tone,
          strength: script.strength,
          pauseAfter: script.pauseAfter,
          ttsParameters: script.ttsParameters,
          orderInSegment: script.orderInSegment,
        },
        include: {
          character: {
            select: {
              id: true,
              canonicalName: true,
              genderHint: true,
              emotionBaseline: true,
            },
          },
          segment: {
            select: {
              id: true,
              content: true,
              segmentIndex: true,
              orderIndex: true,
            },
          },
        },
      })
    );

    const updatedScripts = await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      data: updatedScripts,
    });
  }
);
