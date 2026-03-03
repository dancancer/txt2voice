// 一旦我被更新，请更新我的开头注释
// input: 函数参数/环境变量
// output: 路径解析结果
// pos: 共享业务库
import { existsSync } from "fs";
import { isAbsolute, join, normalize } from "path";

const DEFAULT_UPLOAD_DIR = "uploads";
const UPLOADS_DIR_SEGMENT = "uploads";

const BOOKS_DIR_SEGMENT = "books";
const AUDIO_DIR_SEGMENT = "audio";
const MERGED_DIR_SEGMENT = "merged";
const TEMP_DIR_SEGMENT = "temp";

export interface AudioPathLocatorInput {
  filePath: string;
  fileName?: string | null;
  bookId?: string | null;
  provider?: string | null;
}

const trimLeadingSeparators = (value: string): string =>
  value.replace(/^[/\\]+/, "");

const ensureAbsolutePath = (baseDir: string, pathValue: string): string => {
  if (isAbsolute(pathValue)) {
    return normalize(pathValue);
  }

  return normalize(join(baseDir, trimLeadingSeparators(pathValue)));
};

const extractUploadsRelativePath = (pathValue: string): string | null => {
  const normalizedPath = normalize(pathValue);
  const parts = normalizedPath.split(/[\\/]/).filter(Boolean);
  const uploadIndex = parts.lastIndexOf(UPLOADS_DIR_SEGMENT);

  if (uploadIndex < 0 || uploadIndex === parts.length - 1) {
    return null;
  }

  return join(...parts.slice(uploadIndex + 1));
};

const appendCandidate = (
  candidates: Set<string>,
  candidate?: string | null
): void => {
  if (!candidate) {
    return;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return;
  }

  candidates.add(normalize(trimmed));
};

export function getUploadRootDir(): string {
  const configured = process.env.UPLOAD_DIR || process.env.AUDIO_DIR;
  if (!configured) {
    return join(process.cwd(), DEFAULT_UPLOAD_DIR);
  }

  return isAbsolute(configured)
    ? normalize(configured)
    : normalize(join(process.cwd(), configured));
}

export function getBookUploadDir(bookId: string): string {
  return join(getUploadRootDir(), BOOKS_DIR_SEGMENT, bookId);
}

export function getBookAudioDir(bookId: string): string {
  return join(getUploadRootDir(), AUDIO_DIR_SEGMENT, bookId);
}

export function getBookMergedAudioDir(bookId: string): string {
  return join(getBookAudioDir(bookId), MERGED_DIR_SEGMENT);
}

export function getUploadTempDir(): string {
  return join(getUploadRootDir(), TEMP_DIR_SEGMENT);
}

export function buildAudioFilePathCandidates(
  input: AudioPathLocatorInput
): string[] {
  const uploadRootDir = getUploadRootDir();
  const candidates = new Set<string>();

  appendCandidate(candidates, ensureAbsolutePath(uploadRootDir, input.filePath));

  const uploadsRelativePath = extractUploadsRelativePath(input.filePath);
  if (uploadsRelativePath) {
    appendCandidate(candidates, join(uploadRootDir, uploadsRelativePath));
  }

  if (input.fileName && input.bookId) {
    appendCandidate(
      candidates,
      join(uploadRootDir, AUDIO_DIR_SEGMENT, input.bookId, input.fileName)
    );
    appendCandidate(
      candidates,
      join(
        uploadRootDir,
        AUDIO_DIR_SEGMENT,
        input.bookId,
        MERGED_DIR_SEGMENT,
        input.fileName
      )
    );
  }

  return Array.from(candidates);
}

export function resolveExistingAudioFilePath(
  input: AudioPathLocatorInput
): string | null {
  const candidates = buildAudioFilePathCandidates(input);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
