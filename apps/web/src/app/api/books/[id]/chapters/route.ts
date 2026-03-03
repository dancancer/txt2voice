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

    const chapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { chapterIndex: "asc" },
      include: {
        _count: {
          select: {
            segments: true,
            scriptSentences: true,
            audioFiles: true,
          },
        },
        segments: {
          orderBy: { chapterOrderIndex: "asc" },
          take: 1,
          select: {
            id: true,
            content: true,
            wordCount: true,
          },
        },
      },
    });

    const data = chapters.map((chapter) => {
      const firstSegment = chapter.segments[0];
      const previewText = firstSegment?.content
        ?.replace(/\s+/g, " ")
        .slice(0, 80)
        .trim();

      return {
        id: chapter.id,
        bookId: chapter.bookId,
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        status: chapter.status,
        totalSegments: chapter.totalSegments,
        wordCount: chapter.wordCount,
        characterCount: chapter.characterCount,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        counts: {
          segments: chapter._count.segments,
          scripts: chapter._count.scriptSentences,
          audioFiles: chapter._count.audioFiles,
        },
        preview: previewText ? `${previewText}${previewText.length >= 80 ? "…" : ""}` : "",
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  }
);
