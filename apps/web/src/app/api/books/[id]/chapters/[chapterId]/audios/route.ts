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

const toSafeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

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

    const where = {
      bookId,
      chapterId,
      status: "completed",
    } as const;

    const [audioFiles, total] = await Promise.all([
      prisma.audioFile.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
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
      }),
      prisma.audioFile.count({ where }),
    ]);

    const data = audioFiles.map((audio) => {
      const kind = audio.sentenceId
        ? "line"
        : audio.provider === "merged"
        ? "chapter"
        : "chapter";

      return {
        id: audio.id,
        type: kind,
        status: audio.status,
        chapterId: audio.chapterId,
        segmentId: audio.segmentId,
        sentenceId: audio.sentenceId,
        filename: audio.fileName,
        format: audio.format,
        provider: audio.provider,
        duration: toSafeNumber(audio.duration),
        fileSize: toSafeNumber(audio.fileSize),
        createdAt: audio.createdAt,
        audioUrl: `/api/audio/${audio.id}`,
        scriptSentence: audio.scriptSentence
          ? {
              id: audio.scriptSentence.id,
              text: audio.scriptSentence.text,
              orderInSegment: audio.scriptSentence.orderInSegment,
              character: audio.scriptSentence.character,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      ...createPaginationResponse(data, total, page, limit),
    });
  }
);
