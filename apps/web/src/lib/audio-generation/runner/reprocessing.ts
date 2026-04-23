import prisma from "@/lib/prisma";
import type { AudioGenerationTaskType } from "@/lib/audio-generation/runner/types";

const appendResolutionNote = (
  current: string | null | undefined,
  next: string
): string => {
  if (!current) {
    return next;
  }
  if (current.includes(next)) {
    return current;
  }
  return `${current}\n${next}`;
};

export const rejectManualReviewReprocessingItem = async ({
  bookId,
  manualReviewItemId,
  resolutionType,
  note,
}: {
  bookId: string;
  manualReviewItemId: string;
  resolutionType: string;
  note: string;
}): Promise<boolean> => {
  const reprocessingItem = await prisma.manualReviewItem.findFirst({
    where: {
      id: manualReviewItemId,
      bookId,
      status: "reprocessing",
    },
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (!reprocessingItem) {
    return false;
  }

  await prisma.manualReviewItem.update({
    where: { id: reprocessingItem.id },
    data: {
      status: "rejected",
      resolutionType,
      resolutionNote: appendResolutionNote(reprocessingItem.resolutionNote, note),
      resolvedAt: new Date(),
    },
  });

  return true;
};

export const rejectQcRetryReprocessingItems = async ({
  bookId,
  reviewItemIds,
  resolutionType,
  note,
}: {
  bookId: string;
  reviewItemIds: string[];
  resolutionType: string;
  note: string;
}): Promise<number> => {
  if (reviewItemIds.length === 0) {
    return 0;
  }

  const reprocessingItems = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      id: {
        in: reviewItemIds,
      },
      status: "reprocessing",
    },
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (reprocessingItems.length === 0) {
    return 0;
  }

  for (const item of reprocessingItems) {
    await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "rejected",
        resolutionType,
        resolutionNote: appendResolutionNote(item.resolutionNote, note),
        resolvedAt: new Date(),
      },
    });
  }

  return reprocessingItems.length;
};

export const rejectQcRetryReprocessingItemsBySentenceIds = async ({
  bookId,
  reviewItemIds,
  sentenceIds,
  resolutionType,
  note,
}: {
  bookId: string;
  reviewItemIds: string[];
  sentenceIds: string[];
  resolutionType: string;
  note: string;
}): Promise<number> => {
  if (reviewItemIds.length === 0 || sentenceIds.length === 0) {
    return 0;
  }

  const reprocessingItems = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      id: {
        in: reviewItemIds,
      },
      sentenceId: {
        in: sentenceIds,
      },
      status: "reprocessing",
    },
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (reprocessingItems.length === 0) {
    return 0;
  }

  for (const item of reprocessingItems) {
    await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "rejected",
        resolutionType,
        resolutionNote: appendResolutionNote(item.resolutionNote, note),
        resolvedAt: new Date(),
      },
    });
  }

  return reprocessingItems.length;
};

export const collectFailedBatchSentenceIds = ({
  type,
  scriptSentenceIds,
  results,
}: {
  type: AudioGenerationTaskType;
  scriptSentenceIds?: string[];
  results: Array<{ success?: boolean }>;
}): string[] => {
  if (type !== "batch" || !scriptSentenceIds || scriptSentenceIds.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      scriptSentenceIds.filter((sentenceId, index) => results[index]?.success !== true)
    )
  );
};
