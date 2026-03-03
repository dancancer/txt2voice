// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";

export const GET = withErrorHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; chapterId: string }> }
  ) => {
    const { id: bookId, chapterId } = await params;

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
      },
      select: {
        id: true,
        bookId: true,
        chapterIndex: true,
        title: true,
        status: true,
        wordCount: true,
        characterCount: true,
        totalSegments: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!chapter) {
      throw new ValidationError("章节不存在");
    }

    const [segments, scriptsCount, audioCount] = await Promise.all([
      prisma.textSegment.findMany({
        where: {
          bookId,
          chapterId,
        },
        orderBy: [
          { chapterOrderIndex: "asc" },
          { orderIndex: "asc" },
          { segmentIndex: "asc" },
        ],
        select: {
          id: true,
          chapterId: true,
          segmentIndex: true,
          chapterOrderIndex: true,
          orderIndex: true,
          content: true,
          wordCount: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              scriptSentences: true,
              audioFiles: true,
            },
          },
        },
      }),
      prisma.scriptSentence.count({
        where: {
          bookId,
          chapterId,
        },
      }),
      prisma.audioFile.count({
        where: {
          bookId,
          chapterId,
          status: "completed",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        chapter,
        segments: segments.map((segment) => ({
          id: segment.id,
          chapterId: segment.chapterId,
          segmentIndex: segment.segmentIndex,
          chapterOrderIndex: segment.chapterOrderIndex,
          orderIndex: segment.orderIndex,
          content: segment.content,
          wordCount: segment.wordCount,
          status: segment.status,
          createdAt: segment.createdAt,
          counts: {
            scripts: segment._count.scriptSentences,
            audioFiles: segment._count.audioFiles,
          },
        })),
        statistics: {
          scripts: scriptsCount,
          audioFiles: audioCount,
        },
      },
    });
  }
);
