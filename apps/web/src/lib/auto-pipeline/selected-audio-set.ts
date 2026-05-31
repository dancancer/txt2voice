// 一旦我被更新，请更新我的开头注释
// input: 目标句子与已完成音频候选
// output: 自动编排选中音频集合与稳定 hash
// pos: 自动编排音频证据模块
import { createHash } from "crypto";

export interface SelectedAudioCandidate {
  id: string;
  sentenceId: string | null;
  status: string;
  attemptNo?: number | null;
  createdAt: Date | string;
  filePath: string;
  fileSize?: bigint | number | string | null;
  duration?: { toString(): string } | number | string | null;
  format?: string | null;
}

export interface SelectedAudioTuple {
  sentenceId: string;
  selectedAudioFileId: string;
  attemptNo: number;
  audioFileCreatedAt: string;
  audioArtifactHash: string;
}

export interface SelectedAudioSet {
  selectedAudioFileIds: string[];
  selectedBySentenceId: Record<string, string>;
  selectedTuples: SelectedAudioTuple[];
  missingSentenceIds: string[];
  targetSentenceIdsHash: string;
  missingSentenceIdsHash: string;
  selectedAudioSetHash: string;
  selectedCount: number;
  missingCount: number;
}

const sha1 = (value: string): string =>
  createHash("sha1").update(value).digest("hex");

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toStableString = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const hashJson = (value: unknown): string => sha1(JSON.stringify(value));

export const computeAudioArtifactHash = (
  audio: Pick<
    SelectedAudioCandidate,
    "filePath" | "fileSize" | "duration" | "format" | "createdAt"
  >
): string =>
  sha1(
    [
      audio.filePath,
      toStableString(audio.fileSize),
      toStableString(audio.duration),
      toStableString(audio.format),
      toIso(audio.createdAt),
    ].join("")
  );

const isBetterCandidate = (
  candidate: SelectedAudioCandidate,
  current: SelectedAudioCandidate | undefined
): boolean => {
  if (!current) {
    return true;
  }

  const candidateAttempt = candidate.attemptNo ?? 0;
  const currentAttempt = current.attemptNo ?? 0;
  if (candidateAttempt !== currentAttempt) {
    return candidateAttempt > currentAttempt;
  }

  const candidateTime = new Date(candidate.createdAt).getTime();
  const currentTime = new Date(current.createdAt).getTime();
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime;
  }

  return candidate.id > current.id;
};

const selectBySentence = (
  targetSentenceIds: string[],
  audioFiles: SelectedAudioCandidate[]
): Map<string, SelectedAudioCandidate> => {
  const targetSet = new Set(targetSentenceIds);
  const selected = new Map<string, SelectedAudioCandidate>();

  for (const audio of audioFiles) {
    if (audio.status !== "completed" || !audio.sentenceId) {
      continue;
    }
    if (!targetSet.has(audio.sentenceId)) {
      continue;
    }
    if (isBetterCandidate(audio, selected.get(audio.sentenceId))) {
      selected.set(audio.sentenceId, audio);
    }
  }

  return selected;
};

export const buildSelectedAudioSet = ({
  targetSentenceIds,
  audioFiles,
}: {
  targetSentenceIds: string[];
  audioFiles: SelectedAudioCandidate[];
}): SelectedAudioSet => {
  const selected = selectBySentence(targetSentenceIds, audioFiles);
  const selectedBySentenceId: Record<string, string> = {};
  const selectedTuples: SelectedAudioTuple[] = [];
  const missingSentenceIds: string[] = [];

  for (const sentenceId of targetSentenceIds) {
    const audio = selected.get(sentenceId);
    if (!audio) {
      missingSentenceIds.push(sentenceId);
      continue;
    }

    selectedBySentenceId[sentenceId] = audio.id;
    selectedTuples.push({
      sentenceId,
      selectedAudioFileId: audio.id,
      attemptNo: audio.attemptNo ?? 0,
      audioFileCreatedAt: toIso(audio.createdAt),
      audioArtifactHash: computeAudioArtifactHash(audio),
    });
  }

  const targetSentenceIdsHash = hashJson(targetSentenceIds);
  const missingSentenceIdsHash = hashJson(missingSentenceIds);
  const selectedAudioSetHash = hashJson({
    targetSentenceIdsHash,
    selectedTuples,
    missingSentenceIdsHash,
    missingCount: missingSentenceIds.length,
  });

  return {
    selectedAudioFileIds: selectedTuples.map((item) => item.selectedAudioFileId),
    selectedBySentenceId,
    selectedTuples,
    missingSentenceIds,
    targetSentenceIdsHash,
    missingSentenceIdsHash,
    selectedAudioSetHash,
    selectedCount: selectedTuples.length,
    missingCount: missingSentenceIds.length,
  };
};
