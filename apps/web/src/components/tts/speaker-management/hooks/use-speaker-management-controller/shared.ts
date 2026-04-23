// 一旦我被更新，请更新我的开头注释
// input: TTS provider 原始值
// output: speaker management controller 共享常量
// pos: TTS speaker management
import type { TTSReferenceProvider } from "../../types";

export const PROVIDER_STORAGE_KEY = "tts.speaker-management.provider";

export const SUPPORTED_PROVIDER_LIST: readonly TTSReferenceProvider[] = [
  "qwen3voice",
];

export const isTTSReferenceProvider = (
  value: unknown
): value is TTSReferenceProvider =>
  SUPPORTED_PROVIDER_LIST.includes(value as TTSReferenceProvider);
