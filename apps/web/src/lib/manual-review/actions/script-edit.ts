import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { resolveScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/options";
import {
  buildSegmentProcessingResultFromStructuredResult,
  persistSegmentProcessingResult,
} from "@/lib/agent-runtime/runtime/script-production/manual-review-processor";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type {
  ManualReviewResolveResult,
  SaveManualReviewScriptEditInput,
} from "@/lib/manual-review/types";
import {
  appendResolutionNote,
  asRecord,
  asString,
  formatManualReviewItem,
  isStructuredScriptResult,
  MANUAL_REVIEW_INCLUDE,
} from "@/lib/manual-review/utils";

export const saveManualReviewScriptEdit = async ({
  bookId,
  itemId,
  payload,
}: SaveManualReviewScriptEditInput): Promise<ManualReviewResolveResult> => {
  if (!isStructuredScriptResult(payload?.structuredResult)) {
    throw new ValidationError("structuredResult 必填，且必须是对象");
  }

  const item = await prisma.manualReviewItem.findUnique({
    where: { id: itemId },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (!item || item.bookId !== bookId) {
    throw new ValidationError("复核项不存在");
  }
  if (item.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE) {
    throw new ValidationError("仅 SCRIPT_VALIDATION 复核项支持人工修订保存");
  }
  if (item.status !== "pending") {
    throw new ValidationError("仅 pending 状态的复核项支持人工修订保存");
  }
  if (!item.segmentId) {
    throw new ValidationError("当前脚本复核项缺少 segmentId，无法保存人工修订结果");
  }

  const detail = asRecord(item.issueDetail);
  const segmentContent = asString(detail?.segmentContent);
  if (!segmentContent) {
    throw new ValidationError("当前复核项缺少完整段落原文，无法保存人工修订结果");
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characterProfiles: {
        where: { isActive: true },
        include: { aliases: true },
      },
    },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  const characterMap = new Map<string, string>();
  for (const character of book.characterProfiles) {
    characterMap.set(character.canonicalName, character.canonicalName);
    for (const alias of character.aliases || []) {
      if (alias.alias) {
        characterMap.set(alias.alias, character.canonicalName);
      }
    }
  }

  const segmentResult = buildSegmentProcessingResultFromStructuredResult({
    segment: {
      id: item.segmentId,
      chapterId: item.chapterId,
      orderIndex:
        typeof detail?.orderIndex === "number" ? Number(detail.orderIndex) : -1,
      content: segmentContent,
    },
    structuredResult: payload.structuredResult,
    characterMap,
    options: resolveScriptGenerationOptions(),
  });

  const updated = await prisma.$transaction(async (tx) => {
    await persistSegmentProcessingResult({
      bookId,
      segmentId: item.segmentId as string,
      result: segmentResult,
      characterMap,
      characterProfiles: book.characterProfiles,
      db: tx,
    });

    const now = new Date();
    return tx.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: "resolved",
        resolutionType: "manual_edit_saved",
        resolutionNote: appendResolutionNote(
          item.resolutionNote,
          `manual_edit_saved:${now.toISOString()}`
        ),
        resolvedAt: now,
        issueDetail: {
          ...(detail || {}),
          manualEditedStructuredResult: payload.structuredResult,
          manualEditedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });
  });

  return {
    item: formatManualReviewItem(updated),
    retryTask: null,
  };
};
