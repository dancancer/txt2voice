// 一旦我被更新，请更新我的开头注释
// input: 音频文件路径/ffmpeg 运行环境
// output: audio merger 辅助类型与函数
// pos: 共享业务库
import { exec } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

import { resolveExistingAudioFilePath } from "./storage-path";

export const execAsync = promisify(exec);

export interface AudioMergeOptions {
  format?: "mp3" | "wav" | "ogg";
  bitrate?: string;
  silenceDuration?: number;
  normalizeVolume?: boolean;
}

export interface AudioMergeResult {
  success: boolean;
  outputPath?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  error?: string;
  metadata?: {
    audioFileCount: number;
    totalDuration: number;
    format: string;
  };
}

export const defaultAudioMergeOptions: AudioMergeOptions = {
  format: "mp3",
  bitrate: "128k",
  silenceDuration: 0.5,
  normalizeVolume: false,
};

export const resolveReadableAudioPath = (audioFile: {
  filePath: string;
  fileName?: string | null;
  bookId: string;
  provider?: string | null;
}): string | null => {
  const directPath = audioFile.filePath;
  if (existsSync(directPath)) {
    return directPath;
  }

  return resolveExistingAudioFilePath({
    filePath: audioFile.filePath,
    fileName: audioFile.fileName,
    bookId: audioFile.bookId,
    provider: audioFile.provider,
  });
};

export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (error) {
    console.error("FFmpeg not available:", error);
    return false;
  }
}
