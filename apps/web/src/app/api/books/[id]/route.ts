import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { formatProcessingTask } from "@/lib/processing-task-utils";

// GET /api/books/[id] - 获取书籍基本信息
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析包含参数，决定返回哪些数据的统计信息
    const include = searchParams.get("include")?.split(",") || [];

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        _count: {
          select: {
            characterProfiles: {
              where: { isActive: true },
            },
            textSegments: true,
            scriptSentences: true,
            audioFiles: true,
          },
        },
        processingTasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        // 只有明确要求时才包含详细数据
        ...(include.includes("characters") && {
          characterProfiles: {
            where: { isActive: true },
            select: {
              id: true,
              canonicalName: true,
              genderHint: true,
              isActive: true,
              mentions: true,
              quotes: true,
            },
            orderBy: { mentions: "desc" },
            take: 10, // 限制返回数量
          },
        }),
        ...(include.includes("segments") && {
          textSegments: {
            select: {
              id: true,
              segmentIndex: true,
              content: true,
              wordCount: true,
              status: true,
              orderIndex: true,
            },
            orderBy: [{ orderIndex: "asc" }, { segmentIndex: "asc" }],
            take: 10, // 限制返回数量
          },
        }),
        ...(include.includes("scripts") && {
          scriptSentences: {
            select: {
              id: true,
              text: true,
              tone: true,
              orderInSegment: true,
              character: {
                select: {
                  id: true,
                  canonicalName: true,
                },
              },
              segment: {
                select: {
                  id: true,
                  segmentIndex: true,
                },
              },
            },
            orderBy: [{ segmentId: "asc" }, { orderInSegment: "asc" }],
            take: 20, // 限制返回数量
          },
        }),
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 构建返回数据
    const formattedBook = {
      id: book.id,
      title: book.title,
      author: book.author,
      originalFilename: book.originalFilename,
      fileSize: book.fileSize,
      totalWords: book.totalWords,
      totalCharacters: book.totalCharacters,
      totalSegments: book.totalSegments,
      encoding: book.encoding,
      fileFormat: book.fileFormat,
      status: book.status,
      metadata: book.metadata,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      // 统计信息
      stats: {
        charactersCount: book._count.characterProfiles,
        segmentsCount: book._count.textSegments,
        scriptsCount: book._count.scriptSentences,
        audioFilesCount: book._count.audioFiles,
      },
      // 处理任务
      processingTasks: book.processingTasks.map(formatProcessingTask),
      // 详细数据（仅在请求时包含）
      ...(include.includes("characters") && {
        characterProfiles: book.characterProfiles,
      }),
      ...(include.includes("segments") && {
        textSegments: book.textSegments,
      }),
      ...(include.includes("scripts") && {
        scriptSentences: book.scriptSentences,
      }),
    };

    return NextResponse.json({
      success: true,
      data: formattedBook,
    });
  }
);

// PUT /api/books/[id] - 更新书籍信息
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const { title, author, status } = body;

    const updateData: any = {};
    if (title) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (status) updateData.status = status;

    const book = await prisma.book.update({
      where: { id: bookId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: book,
    });
  }
);

// DELETE /api/books/[id] - 删除书籍
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    await prisma.book.delete({
      where: { id: bookId },
    });

    return NextResponse.json({
      success: true,
      message: "书籍已删除",
    });
  }
);
