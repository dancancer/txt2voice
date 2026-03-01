// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { formatProcessingTask } from "@/lib/processing-task-utils";

const toSafeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseIncludes = (rawInclude: string | null): Set<string> =>
  new Set(
    (rawInclude || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

// GET /api/books/[id] - 获取书籍基本信息
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    const include = parseIncludes(searchParams.get("include"));
    const includeCharacters = include.has("characters");
    const includeSegments = include.has("segments");
    const includeChapters = include.has("chapters");
    const includeScripts = include.has("scripts");
    const includeAudioFiles = include.has("audioFiles");

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        _count: {
          select: {
            characterProfiles: {
              where: { isActive: true },
            },
            chapters: true,
            textSegments: true,
            scriptSentences: true,
            audioFiles: true,
          },
        },
        processingTasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        ...(includeCharacters && {
          characterProfiles: {
            where: { isActive: true },
            select: {
              id: true,
              canonicalName: true,
              genderHint: true,
              isActive: true,
              mentions: true,
              quotes: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { mentions: "desc" },
          },
        }),
        ...(includeSegments && {
          textSegments: {
            select: {
              id: true,
              segmentIndex: true,
              chapterId: true,
              chapterOrderIndex: true,
              content: true,
              wordCount: true,
              status: true,
              orderIndex: true,
              createdAt: true,
            },
            orderBy: [{ orderIndex: "asc" }, { segmentIndex: "asc" }],
          },
        }),
        ...(includeChapters && {
          chapters: {
            select: {
              id: true,
              chapterIndex: true,
              title: true,
              totalSegments: true,
              status: true,
              metadata: true,
              createdAt: true,
            },
            orderBy: { chapterIndex: "asc" },
          },
        }),
        ...(includeScripts && {
          scriptSentences: {
            select: {
              id: true,
              text: true,
              tone: true,
              strength: true,
              pauseAfter: true,
              ttsParameters: true,
              orderInSegment: true,
              chapterId: true,
              createdAt: true,
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
              audioFiles: {
                select: {
                  id: true,
                  status: true,
                  duration: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: [{ segmentId: "asc" }, { orderInSegment: "asc" }],
          },
        }),
        ...(includeAudioFiles && {
          audioFiles: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              duration: true,
              format: true,
              status: true,
              createdAt: true,
              sentenceId: true,
              scriptSentence: {
                select: {
                  id: true,
                  text: true,
                  orderInSegment: true,
                  character: {
                    select: {
                      id: true,
                      canonicalName: true,
                    },
                  },
                },
              },
            },
            where: { status: "completed" },
            orderBy: { createdAt: "asc" },
          },
        }),
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const counts = {
      characters: book._count.characterProfiles,
      chapters: book._count.chapters,
      segments: book._count.textSegments,
      scripts: book._count.scriptSentences,
      audioFiles: book._count.audioFiles,
    };

    const latestTask = book.processingTasks[0]
      ? formatProcessingTask(book.processingTasks[0])
      : null;

    const formattedBook = {
      id: book.id,
      title: book.title,
      author: book.author,
      originalFilename: book.originalFilename,
      fileSize: toSafeNumber(book.fileSize),
      totalWords: book.totalWords,
      totalCharacters: book.totalCharacters,
      totalSegments: book.totalSegments,
      totalChapters: book.totalChapters,
      encoding: book.encoding,
      fileFormat: book.fileFormat,
      status: book.status,
      metadata: book.metadata,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      counts,
      latestTask,
      processingTasks: book.processingTasks.map(formatProcessingTask),
      ...(includeCharacters && {
        characterProfiles: (book.characterProfiles || []).map((character) => ({
          ...character,
          createdAt: character.createdAt,
          updatedAt: character.updatedAt,
        })),
      }),
      ...(includeSegments && {
        textSegments: (book.textSegments || []).map((segment) => ({
          ...segment,
          createdAt: segment.createdAt,
        })),
      }),
      ...(includeChapters && {
        chapters: (book.chapters || []).map((chapter) => ({
          ...chapter,
          createdAt: chapter.createdAt,
        })),
      }),
      ...(includeScripts && {
        scriptSentences: ((book as any).scriptSentences || []).map((sentence: any) => ({
          ...sentence,
          strength: toSafeNumber(sentence.strength),
          pauseAfter: toSafeNumber(sentence.pauseAfter),
          audioFiles: (sentence.audioFiles || []).map((audio: any) => ({
            ...audio,
            duration: toSafeNumber(audio.duration),
          })),
        })),
      }),
      ...(includeAudioFiles && {
        audioFiles: ((book as any).audioFiles || []).map((audio: any) => ({
          id: audio.id,
          filename: audio.fileName || `${audio.id}.${audio.format || "mp3"}`,
          duration: toSafeNumber(audio.duration) || 0,
          fileSize: toSafeNumber(audio.fileSize) || 0,
          format: audio.format || "mp3",
          status: audio.status,
          createdAt: audio.createdAt,
          scriptSentence: audio.scriptSentence
            ? {
                id: audio.scriptSentence.id,
                text: audio.scriptSentence.text,
                orderInSegment: audio.scriptSentence.orderInSegment,
                character: audio.scriptSentence.character
                  ? {
                      id: audio.scriptSentence.character.id,
                      canonicalName: audio.scriptSentence.character.canonicalName,
                    }
                  : null,
              }
            : null,
          character: audio.scriptSentence?.character
            ? {
                id: audio.scriptSentence.character.id,
                canonicalName: audio.scriptSentence.character.canonicalName,
              }
            : null,
        })),
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
