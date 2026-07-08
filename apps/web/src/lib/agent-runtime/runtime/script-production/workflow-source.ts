import { TTSError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";

export const loadBookForGeneration = async (params: {
  bookId: string;
  segmentIds?: string[];
}) => {
  const { bookId, segmentIds } = params;

  const segmentWhere =
    Array.isArray(segmentIds) && segmentIds.length > 0
      ? { id: { in: segmentIds } }
      : undefined;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      textSegments: {
        where: segmentWhere,
        orderBy: { orderIndex: "asc" },
      },
      characterProfiles: {
        where: { isActive: true },
        include: {
          aliases: true,
        },
      },
    },
  });

  if (!book) {
    throw new TTSError(
      "书籍不存在",
      "TTS_SERVICE_DOWN",
      "mastra-script-production"
    );
  }

  return book;
};

export const resolvePartialSegments = (params: {
  segments: any[];
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
}): any[] => {
  const { segments, startFromSegmentId, startFromOrderIndex, limitToSegments } =
    params;

  let startIndex = 0;
  let hasExplicitStart = false;

  if (typeof startFromOrderIndex === "number") {
    hasExplicitStart = true;
    startIndex = segments.findIndex((seg) => seg.orderIndex === startFromOrderIndex);
  }

  if ((startIndex === -1 || !hasExplicitStart) && startFromSegmentId) {
    hasExplicitStart = true;
    startIndex = segments.findIndex((seg) => seg.id === startFromSegmentId);
  }

  if (hasExplicitStart && startIndex === -1) {
    throw new TTSError(
      "未找到指定的起始段落",
      "TTS_SERVICE_DOWN",
      "mastra-script-production"
    );
  }

  const hasLimit = typeof limitToSegments === "number" && limitToSegments > 0;
  const endIndex = hasLimit
    ? Math.min(startIndex + limitToSegments, segments.length)
    : segments.length;

  if (startIndex >= endIndex) {
    throw new TTSError(
      "没有可处理的文本段落",
      "TTS_SERVICE_DOWN",
      "mastra-script-production"
    );
  }

  return segments.slice(startIndex, endIndex);
};
