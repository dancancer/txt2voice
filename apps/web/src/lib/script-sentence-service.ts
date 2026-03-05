// 一旦我被更新，请更新我的开头注释
// input: 书籍ID/请求参数/请求体
// output: 台词数据读写结果
// pos: 脚本句子服务层
import { ValidationError } from "@/lib/error-handler";
import {
  createPaginationResult,
  getPaginationFromSearch,
  parsePaginationParams,
} from "@/lib/pagination";
import prisma, { Prisma } from "@/lib/prisma";
import {
  buildScriptSentenceWhere,
  formatScriptSentence,
  normalizeScriptUpdatePayload,
  parseScriptSentenceFilters,
} from "@/lib/script-sentence-contract";

const scriptSentenceInclude = {
  character: {
    select: {
      id: true,
      canonicalName: true,
      genderHint: true,
      emotionBaseline: true,
    },
  },
  chapter: {
    select: {
      id: true,
      chapterIndex: true,
      title: true,
    },
  },
  segment: {
    select: {
      id: true,
      content: true,
      segmentIndex: true,
      orderIndex: true,
      chapterOrderIndex: true,
    },
  },
  audioFiles: {
    select: {
      id: true,
      filePath: true,
      duration: true,
      status: true,
      provider: true,
      voiceProfileId: true,
      voiceProfile: {
        select: {
          id: true,
          voiceName: true,
          displayName: true,
        },
      },
    },
  },
} as const;

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

async function ensureBookExists(bookId: string): Promise<void> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }
}

export async function listBookScriptSentences(
  bookId: string,
  searchParams: URLSearchParams
) {
  await ensureBookExists(bookId);

  const paginationParams = getPaginationFromSearch(searchParams);
  const { page, limit, offset } = parsePaginationParams(paginationParams);
  const filters = parseScriptSentenceFilters(searchParams);
  const where = buildScriptSentenceWhere(bookId, filters) as any;

  const [total, scripts, toneStats, characterStats] = await Promise.all([
    prisma.scriptSentence.count({ where }),
    prisma.scriptSentence.findMany({
      where,
      include: scriptSentenceInclude,
      orderBy: [{ segment: { orderIndex: "asc" } }, { orderInSegment: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.scriptSentence.groupBy({
      by: ["tone"],
      where: { bookId },
      _count: true,
    }),
    prisma.scriptSentence.groupBy({
      by: ["characterId"],
      where: {
        bookId,
        characterId: { not: null },
      },
      _count: true,
    }),
  ]);

  const formatted = scripts.map(formatScriptSentence);
  const pagination = createPaginationResult(formatted, total, page, limit);

  return {
    ...pagination,
    statistics: {
      totalLines: total,
      toneDistribution: toneStats.reduce((acc, stat) => {
        acc[stat.tone || "unknown"] = Number(stat._count);
        return acc;
      }, {} as Record<string, number>),
      characterDistribution: characterStats.reduce((acc, stat) => {
        acc[stat.characterId || "unknown"] = Number(stat._count);
        return acc;
      }, {} as Record<string, number>),
    },
  };
}

export async function createBookScriptSentence(bookId: string, body: unknown) {
  await ensureBookExists(bookId);

  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  if (!payload) {
    throw new ValidationError("请求体格式错误");
  }

  const segmentId =
    typeof payload.segmentId === "string" && payload.segmentId.trim().length > 0
      ? payload.segmentId
      : null;
  if (!segmentId) {
    throw new ValidationError("segmentId 不能为空");
  }

  const rawText = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!rawText) {
    throw new ValidationError("text 不能为空");
  }

  const segment = await prisma.textSegment.findFirst({
    where: { id: segmentId, bookId },
    select: {
      id: true,
      chapterId: true,
    },
  });

  if (!segment) {
    throw new ValidationError("分段不存在");
  }

  const characterId =
    payload.characterId === null
      ? null
      : typeof payload.characterId === "string" && payload.characterId.trim().length > 0
      ? payload.characterId
      : undefined;

  if (characterId) {
    const character = await prisma.characterProfile.findFirst({
      where: { id: characterId, bookId },
      select: { id: true },
    });

    if (!character) {
      throw new ValidationError("角色不存在");
    }
  }

  let orderInSegment =
    typeof payload.orderInSegment === "number" && Number.isFinite(payload.orderInSegment)
      ? payload.orderInSegment
      : undefined;

  if (orderInSegment === undefined) {
    const maxOrder = await prisma.scriptSentence.findFirst({
      where: { segmentId },
      orderBy: { orderInSegment: "desc" },
      select: { orderInSegment: true },
    });
    orderInSegment = (maxOrder?.orderInSegment || 0) + 1;
  }

  const created = await prisma.scriptSentence.create({
    data: {
      bookId,
      segmentId,
      chapterId: segment.chapterId,
      characterId,
      text: rawText,
      rawSpeaker:
        payload.rawSpeaker === null
          ? null
          : typeof payload.rawSpeaker === "string"
          ? payload.rawSpeaker
          : undefined,
      tone:
        typeof payload.tone === "string"
          ? payload.tone
          : undefined,
      roleType: toStringValue(payload.roleType),
      emotionLabel: toStringValue(payload.emotionLabel),
      emotionIntensity:
        typeof payload.emotionIntensity === "number" &&
        Number.isFinite(payload.emotionIntensity)
          ? payload.emotionIntensity
          : undefined,
      engineHint: toStringValue(payload.engineHint),
      priority: toStringValue(payload.priority),
      prosody: toJsonValue(payload.prosody),
      strength:
        typeof payload.strength === "number" && Number.isFinite(payload.strength)
          ? payload.strength
          : undefined,
      pauseAfter:
        typeof payload.pauseAfter === "number" && Number.isFinite(payload.pauseAfter)
          ? payload.pauseAfter
          : undefined,
      ttsParameters: toJsonValue(payload.ttsParameters),
      orderInSegment,
    },
    include: scriptSentenceInclude,
  });

  return formatScriptSentence(created);
}

export async function updateBookScriptSentences(bookId: string, body: unknown) {
  await ensureBookExists(bookId);

  const scripts = normalizeScriptUpdatePayload(body);
  const scriptIds = scripts.map((item) => item.id);

  const existingScripts = await prisma.scriptSentence.findMany({
    where: {
      id: { in: scriptIds },
      bookId,
    },
    select: { id: true },
  });

  if (existingScripts.length !== scripts.length) {
    throw new ValidationError("部分台本句子不存在或不属于该书籍");
  }

  const updates = scripts.map((item) =>
    prisma.scriptSentence.update({
      where: { id: item.id },
      data: {
        characterId: item.characterId,
        text: item.text,
        rawSpeaker: item.rawSpeaker,
        tone: item.tone,
        roleType: item.roleType,
        emotionLabel: item.emotionLabel,
        emotionIntensity: item.emotionIntensity,
        engineHint: item.engineHint,
        priority: item.priority,
        prosody: toJsonValue(item.prosody),
        strength: item.strength,
        pauseAfter: item.pauseAfter,
        ttsParameters: toJsonValue(item.ttsParameters),
        orderInSegment: item.orderInSegment,
      },
      include: scriptSentenceInclude,
    })
  );

  const updated = await Promise.all(updates);
  return updated.map(formatScriptSentence);
}

export async function deleteBookScriptSentences(
  bookId: string,
  searchParams: URLSearchParams
) {
  await ensureBookExists(bookId);

  const sentenceIds = searchParams.get("ids");
  const segmentId = searchParams.get("segmentId");

  const whereClause: Record<string, unknown> = { bookId };

  if (sentenceIds) {
    const ids = sentenceIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      throw new ValidationError("台词ID列表不能为空");
    }

    whereClause.id = { in: ids };
  } else if (segmentId) {
    whereClause.segmentId = segmentId;
  } else {
    throw new ValidationError("请提供要删除的台词ID或段落ID");
  }

  const sentencesWithAudio = await prisma.scriptSentence.findMany({
    where: whereClause as any,
    include: {
      audioFiles: {
        select: { id: true },
      },
    },
  });

  const withAudioCount = sentencesWithAudio.filter(
    (sentence) => sentence.audioFiles.length > 0
  ).length;

  if (withAudioCount > 0) {
    throw new ValidationError(`有 ${withAudioCount} 条台词已生成音频，无法删除`);
  }

  const result = await prisma.scriptSentence.deleteMany({
    where: whereClause as any,
  });

  return {
    deleted: result.count,
    message: `已删除 ${result.count} 条台词`,
  };
}

export async function reorderBookScriptSentences(bookId: string, body: unknown) {
  await ensureBookExists(bookId);

  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  const segmentId =
    payload && typeof payload.segmentId === "string" && payload.segmentId.trim().length > 0
      ? payload.segmentId
      : null;
  const newOrders = payload && Array.isArray(payload.newOrders) ? payload.newOrders : null;

  if (!segmentId || !newOrders) {
    throw new ValidationError("请提供段落ID和新的排序");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of newOrders) {
      const row =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;

      const sentenceId = row && typeof row.sentenceId === "string" ? row.sentenceId : null;
      const orderInSegment =
        row && typeof row.orderInSegment === "number" && Number.isFinite(row.orderInSegment)
          ? row.orderInSegment
          : null;

      if (!sentenceId || orderInSegment === null) {
        throw new ValidationError("排序参数无效");
      }

      await tx.scriptSentence.update({
        where: {
          id: sentenceId,
          bookId,
          segmentId,
        },
        data: {
          orderInSegment,
        },
      });
    }
  });

  return {
    message: "台词排序已更新",
  };
}
