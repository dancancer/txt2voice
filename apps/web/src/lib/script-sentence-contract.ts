// 一旦我被更新，请更新我的开头注释
// input: 原始请求参数/台词字段
// output: 统一台词契约结构
// pos: 协议适配层
import { ValidationError } from "@/lib/error-handler";

export interface ScriptSentenceFilters {
  characterId?: string;
  segmentId?: string;
  chapterId?: string | null;
  search?: string;
  tone?: string;
}

export interface NormalizedScriptUpdate {
  id: string;
  characterId?: string | null;
  text?: string;
  rawSpeaker?: string | null;
  tone?: string;
  roleType?: string;
  emotionLabel?: string;
  emotionIntensity?: number;
  engineHint?: string;
  priority?: string;
  prosody?: unknown;
  strength?: number;
  pauseAfter?: number;
  ttsParameters?: unknown;
  orderInSegment?: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function parseScriptSentenceFilters(
  searchParams: URLSearchParams
): ScriptSentenceFilters {
  const chapterValue = searchParams.get("chapterId");
  const chapterId = chapterValue
    ? chapterValue === "unassigned"
      ? null
      : chapterValue
    : undefined;

  return {
    characterId: searchParams.get("characterId") || undefined,
    segmentId: searchParams.get("segmentId") || undefined,
    chapterId,
    search: searchParams.get("search") || undefined,
    tone: searchParams.get("tone") || undefined,
  };
}

export function buildScriptSentenceWhere(
  bookId: string,
  filters: ScriptSentenceFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = { bookId };

  if (filters.characterId) {
    where.characterId = filters.characterId;
  }

  if (filters.segmentId) {
    where.segmentId = filters.segmentId;
  }

  if (filters.chapterId !== undefined) {
    where.chapterId = filters.chapterId;
  }

  if (filters.search) {
    where.text = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  if (filters.tone) {
    where.tone = filters.tone;
  }

  return where;
}

export function normalizeScriptUpdatePayload(
  body: unknown
): NormalizedScriptUpdate[] {
  const payload = asRecord(body);
  const rawList =
    payload && Array.isArray(payload.scripts) ? payload.scripts : null;

  if (!rawList || rawList.length === 0) {
    throw new ValidationError("请提供要更新的台本句子列表");
  }

  return rawList.map((item) => {
    const row = asRecord(item);
    if (!row) {
      throw new ValidationError("台本更新项格式错误");
    }

    const id = asString(row.id);
    if (!id) {
      throw new ValidationError("台本句子ID不能为空");
    }

    const text = asString(row.text);
    const tone = asString(row.tone);

    const characterId = row.characterId === null ? null : asString(row.characterId);

    const update: NormalizedScriptUpdate = {
      id,
      text,
      tone,
      roleType: asString(row.roleType),
      emotionLabel: asString(row.emotionLabel),
      emotionIntensity: asNumber(row.emotionIntensity),
      engineHint: asString(row.engineHint),
      priority: asString(row.priority),
      prosody: row.prosody,
      characterId,
      rawSpeaker:
        row.rawSpeaker === null
          ? null
          : asString(row.rawSpeaker),
      strength: asNumber(row.strength),
      pauseAfter: asNumber(row.pauseAfter),
      ttsParameters: row.ttsParameters,
      orderInSegment: asNumber(row.orderInSegment),
    };

    return update;
  });
}

export function formatScriptSentence(sentence: any) {
  return {
    id: sentence.id,
    bookId: sentence.bookId,
    segmentId: sentence.segmentId,
    chapterId: sentence.chapterId,
    characterId: sentence.characterId,
    text: sentence.text,
    rawSpeaker: sentence.rawSpeaker,
    tone: sentence.tone,
    roleType: sentence.roleType,
    emotionLabel: sentence.emotionLabel,
    emotionIntensity: sentence.emotionIntensity,
    engineHint: sentence.engineHint,
    priority: sentence.priority,
    prosody: sentence.prosody,
    strength: sentence.strength,
    pauseAfter: sentence.pauseAfter,
    ttsParameters: sentence.ttsParameters,
    orderInSegment: sentence.orderInSegment,
    character: sentence.character,
    chapter: sentence.chapter,
    segment: sentence.segment,
    audioFiles: sentence.audioFiles,
    hasAudio: Array.isArray(sentence.audioFiles) && sentence.audioFiles.length > 0,
    createdAt: sentence.createdAt,
    updatedAt: sentence.updatedAt,
  };
}
