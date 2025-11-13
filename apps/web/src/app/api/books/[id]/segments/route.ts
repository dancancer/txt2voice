import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getPaginationFromSearch,
  parsePaginationParams,
  createPaginationResult,
} from "@/lib/pagination";

// GET /api/books/[id]/segments - 获取书籍分段列表（分页）
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
    const status = searchParams.get("status");
    const segmentType = searchParams.get("segmentType");
    const search = searchParams.get("search");
    const hasAudio = searchParams.get("hasAudio");

    // 构建查询条件
    const where: any = { bookId };
    if (status) {
      where.status = status;
    }
    if (segmentType) {
      where.segmentType = segmentType;
    }
    if (search) {
      where.content = { contains: search, mode: "insensitive" };
    }
    if (hasAudio !== null) {
      where.audioFiles =
        hasAudio === "true"
          ? {
              some: {},
            }
          : {
              none: {},
            };
    }

    // 获取总数
    const total = await prisma.textSegment.count({ where });

    // 获取分段列表
    const segments = await prisma.textSegment.findMany({
      where,
      include: {
        scriptSentences: {
          select: {
            id: true,
            text: true,
            characterId: true,
            character: {
              select: {
                id: true,
                canonicalName: true,
                genderHint: true,
              },
            },
          },
          orderBy: { orderInSegment: "asc" },
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
        _count: {
          select: {
            scriptSentences: true,
            audioFiles: true,
          },
        },
      },
      orderBy: [{ orderIndex: "asc" }, { segmentIndex: "asc" }],
      skip: offset,
      take: limit,
    });

    // 格式化返回数据
    const formattedSegments = segments.map((segment) => ({
      id: segment.id,
      segmentIndex: segment.segmentIndex,
      startPosition: segment.startPosition,
      endPosition: segment.endPosition,
      content: segment.content,
      wordCount: segment.wordCount,
      segmentType: segment.segmentType,
      orderIndex: segment.orderIndex,
      metadata: segment.metadata,
      status: segment.status,
      scriptSentences: segment.scriptSentences,
      audioFiles: segment.audioFiles,
      scriptSentencesCount: segment._count.scriptSentences,
      audioFilesCount: segment._count.audioFiles,
      createdAt: segment.createdAt,
    }));

    const result = createPaginationResult(
      formattedSegments,
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

// POST /api/books/[id]/segments - 创建新分段
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const {
      content,
      segmentIndex,
      startPosition,
      endPosition,
      wordCount,
      segmentType,
      orderIndex,
      metadata,
    } = body;

    // 检查书籍是否存在
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 如果没有指定orderIndex，获取当前最大的orderIndex
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const maxOrder = await prisma.textSegment.findFirst({
        where: { bookId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      finalOrderIndex = (maxOrder?.orderIndex || 0) + 1;
    }

    const segment = await prisma.textSegment.create({
      data: {
        bookId,
        content: content.trim(),
        segmentIndex: segmentIndex || 0,
        startPosition: startPosition || 0,
        endPosition: endPosition || 0,
        wordCount: wordCount || 0,
        segmentType,
        orderIndex: finalOrderIndex,
        metadata: metadata || {},
        status: "pending",
      },
      include: {
        scriptSentences: {
          select: {
            id: true,
            text: true,
            characterId: true,
            character: {
              select: {
                id: true,
                canonicalName: true,
                genderHint: true,
              },
            },
          },
          orderBy: { orderInSegment: "asc" },
        },
        audioFiles: {
          select: {
            id: true,
            filePath: true,
            duration: true,
            status: true,
            provider: true,
          },
        },
        _count: {
          select: {
            scriptSentences: true,
            audioFiles: true,
          },
        },
      },
    });

    // 更新书籍的分段总数
    await prisma.book.update({
      where: { id: bookId },
      data: {
        totalSegments: {
          increment: 1,
        },
      },
    });

    // 格式化返回数据
    const formattedSegment = {
      id: segment.id,
      segmentIndex: segment.segmentIndex,
      startPosition: segment.startPosition,
      endPosition: segment.endPosition,
      content: segment.content,
      wordCount: segment.wordCount,
      segmentType: segment.segmentType,
      orderIndex: segment.orderIndex,
      metadata: segment.metadata,
      status: segment.status,
      scriptSentences: segment.scriptSentences,
      audioFiles: segment.audioFiles,
      scriptSentencesCount: segment._count.scriptSentences,
      audioFilesCount: segment._count.audioFiles,
      createdAt: segment.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedSegment,
    });
  }
);

// PUT /api/books/[id]/segments - 批量更新分段
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const { segments } = body;

    if (!Array.isArray(segments) || segments.length === 0) {
      throw new ValidationError("请提供要更新的分段列表");
    }

    // 验证所有分段都属于该书籍
    const segmentIds = segments.map((s) => s.id);
    const existingSegments = await prisma.textSegment.findMany({
      where: {
        id: { in: segmentIds },
        bookId,
      },
    });

    if (existingSegments.length !== segments.length) {
      throw new ValidationError("部分分段不存在或不属于该书籍");
    }

    // 批量更新
    const updatePromises = segments.map((segment) =>
      prisma.textSegment.update({
        where: { id: segment.id },
        data: {
          content: segment.content?.trim(),
          segmentIndex: segment.segmentIndex,
          startPosition: segment.startPosition,
          endPosition: segment.endPosition,
          wordCount: segment.wordCount,
          segmentType: segment.segmentType,
          orderIndex: segment.orderIndex,
          metadata: segment.metadata,
          status: segment.status,
        },
        include: {
          scriptSentences: {
            select: {
              id: true,
              text: true,
              characterId: true,
              character: {
                select: {
                  id: true,
                  canonicalName: true,
                  genderHint: true,
                },
              },
            },
            orderBy: { orderInSegment: "asc" },
          },
          audioFiles: {
            select: {
              id: true,
              filePath: true,
              duration: true,
              status: true,
              provider: true,
            },
          },
          _count: {
            select: {
              scriptSentences: true,
              audioFiles: true,
            },
          },
        },
      })
    );

    const updatedSegments = await Promise.all(updatePromises);

    // 格式化返回数据
    const formattedSegments = updatedSegments.map((segment) => ({
      id: segment.id,
      segmentIndex: segment.segmentIndex,
      startPosition: segment.startPosition,
      endPosition: segment.endPosition,
      content: segment.content,
      wordCount: segment.wordCount,
      segmentType: segment.segmentType,
      orderIndex: segment.orderIndex,
      metadata: segment.metadata,
      status: segment.status,
      scriptSentences: segment.scriptSentences,
      audioFiles: segment.audioFiles,
      scriptSentencesCount: segment._count.scriptSentences,
      audioFilesCount: segment._count.audioFiles,
      createdAt: segment.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedSegments,
    });
  }
);
