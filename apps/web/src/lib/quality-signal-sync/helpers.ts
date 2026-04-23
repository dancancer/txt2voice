// 一旦我被更新，请更新我的开头注释
// input: task payload/音频元数据/模型输出
// output: quality signal sync 辅助函数
// pos: 信号生产执行器
import { Prisma } from "@/lib/prisma";

export type QualitySignalSyncTaskType = "book" | "chapter" | "batch";
type SignalValueSource = "task_payload" | "provider" | "heuristic" | "existing";

export interface SyncSignalResult {
  value: number | null;
  source: SignalValueSource;
}

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
};

export const buildWhere = ({
  bookId,
  type,
  chapterId,
  audioFileIds,
}: {
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}): Prisma.AudioFileWhereInput => {
  if (type === "chapter" && !chapterId) {
    throw new Error("章节信号生产必须提供 chapterId");
  }
  if (type === "batch" && (!audioFileIds || audioFileIds.length === 0)) {
    throw new Error("批量信号生产必须提供 audioFileIds");
  }

  return {
    bookId,
    status: "completed",
    ...(type === "chapter" ? { chapterId } : {}),
    ...(type === "batch" ? { id: { in: audioFileIds } } : {}),
  };
};

export const readSignalPayload = ({
  metadata,
  audioFileId,
  sentenceId,
}: {
  metadata: Record<string, unknown> | null;
  audioFileId: string;
  sentenceId: string | null;
}): Record<string, unknown> => {
  const byAudio = asRecord(metadata?.signalPayloadByAudioFileId || metadata?.signalPayload);
  const audioPayload = asRecord(byAudio?.[audioFileId]);
  if (audioPayload) {
    return audioPayload;
  }

  if (sentenceId) {
    const bySentence = asRecord(metadata?.signalPayloadBySentenceId || byAudio?.bySentenceId);
    const sentencePayload = asRecord(bySentence?.[sentenceId]);
    if (sentencePayload) {
      return sentencePayload;
    }
  }

  return {};
};

export const estimateCer = ({
  text,
  durationSeconds,
  roleType,
}: {
  text: string;
  durationSeconds: number;
  roleType: string | null | undefined;
}): number => {
  const normalizedText = text.trim();
  const charsPerSecond = normalizedText.length / Math.max(durationSeconds, 0.0001);
  const digitPenalty = (normalizedText.match(/\d/g) || []).length * 0.0025;
  const foreignPenalty = (normalizedText.match(/[A-Za-z]/g) || []).length * 0.0008;
  const quotePenalty = (normalizedText.match(/[“”"']/g) || []).length * 0.001;
  const roleBase = (roleType || "narration") === "dialogue" ? 0.052 : 0.034;
  const pacePenalty = Math.max(charsPerSecond - 4.8, 0) * 0.008;

  return clampUnit(roleBase + digitPenalty + foreignPenalty + quotePenalty + pacePenalty);
};

export const estimateSpeakerSimilarity = ({
  hasVoiceProfile,
  roleType,
  priority,
}: {
  hasVoiceProfile: boolean;
  roleType: string | null | undefined;
  priority: string | null | undefined;
}): number => {
  const normalizedRole = (roleType || "narration").trim().toLowerCase();
  const normalizedPriority = (priority || "normal").trim().toLowerCase();
  const base = hasVoiceProfile ? 0.86 : 0.69;
  const roleDelta = normalizedRole === "dialogue" ? -0.03 : 0.01;
  const priorityDelta = normalizedPriority === "high" ? 0.015 : 0;
  return clampUnit(base + roleDelta + priorityDelta);
};

export const resolveSignal = ({
  currentValue,
  payloadValue,
  providerValue,
  fallbackValue,
  forceResync,
}: {
  currentValue: number | null;
  payloadValue: number | null;
  providerValue: number | null;
  fallbackValue: number;
  forceResync: boolean;
}): SyncSignalResult => {
  if (!forceResync && currentValue !== null) {
    return {
      value: currentValue,
      source: "existing",
    };
  }

  if (payloadValue !== null) {
    return {
      value: clampUnit(payloadValue),
      source: "task_payload",
    };
  }

  if (providerValue !== null) {
    return {
      value: clampUnit(providerValue),
      source: "provider",
    };
  }

  return {
    value: clampUnit(fallbackValue),
    source: "heuristic",
  };
};

export const toJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};
