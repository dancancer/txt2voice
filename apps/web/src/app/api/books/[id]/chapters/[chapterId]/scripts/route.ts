// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  createPaginationResponse,
  parsePaginationParams,
} from "@/lib/api-utils";

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; chapterId: string }> }
  ) => {
    const { id: bookId, chapterId } = await params;
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      select: { id: true },
    });

    if (!chapter) {
      throw new ValidationError("章节不存在");
    }

    const [scripts, total] = await Promise.all([
      prisma.scriptSentence.findMany({
        where: {
          bookId,
          chapterId,
        },
        orderBy: [{ segment: { orderIndex: "asc" } }, { orderInSegment: "asc" }],
        skip,
        take: limit,
        include: {
          character: {
            select: {
              id: true,
              canonicalName: true,
              genderHint: true,
            },
          },
          segment: {
            select: {
              id: true,
              segmentIndex: true,
              chapterOrderIndex: true,
              orderIndex: true,
            },
          },
          audioFiles: {
            where: { status: "completed" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              duration: true,
              format: true,
              createdAt: true,
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
    ]);

    const data = scripts.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      rawSpeaker: sentence.rawSpeaker,
      tone: sentence.tone,
      strength: sentence.strength,
      pauseAfter: sentence.pauseAfter,
      orderInSegment: sentence.orderInSegment,
      segmentId: sentence.segmentId,
      chapterId: sentence.chapterId,
      createdAt: sentence.createdAt,
      character: sentence.character,
      segment: sentence.segment,
      audio: sentence.audioFiles[0]
        ? {
            id: sentence.audioFiles[0].id,
            status: sentence.audioFiles[0].status,
            duration: sentence.audioFiles[0].duration,
            format: sentence.audioFiles[0].format,
            createdAt: sentence.audioFiles[0].createdAt,
            url: `/api/audio/${sentence.audioFiles[0].id}`,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      ...createPaginationResponse(data, total, page, limit),
    });
  }
);
