// 一旦我被更新，请更新我的开头注释
// input: 远端音频 URL/TTS 元数据
// output: 远端音频响应封装
// pos: TTS 远端音频工具
import { TTSError } from "@/lib/error-handler";
import type { TTSRequest, TTSResponse } from "@/lib/tts/types";

const resolveOutputFormat = (
  audioUrl: string | undefined,
  fallback: TTSRequest["outputFormat"]
): string => {
  if (!audioUrl) {
    return fallback;
  }

  try {
    const pathname = audioUrl.startsWith("http")
      ? new URL(audioUrl).pathname
      : audioUrl;
    const extension = pathname.split(".").pop()?.toLowerCase();
    if (extension === "mp3" || extension === "wav" || extension === "ogg") {
      return extension;
    }
  } catch (_error) {
    // ignore parse errors and fall back to request format
  }

  return fallback;
};

const downloadAudioBuffer = async (
  audioUrl: string,
  provider: string
): Promise<ArrayBuffer> => {
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new TTSError(
      `Failed to download ${provider} audio: ${audioResponse.status} ${audioResponse.statusText}`,
      "TTS_SYNTHESIS_FAILED",
      provider,
      true
    );
  }

  return audioResponse.arrayBuffer();
};

export const createRemoteAudioResponse = async (
  audioUrl: string,
  options: {
    provider: string;
    fallbackFormat: TTSRequest["outputFormat"];
    fallbackSampleRate: number;
    duration?: number;
  },
  metadata: Record<string, any>
): Promise<TTSResponse> => {
  const audioBuffer = await downloadAudioBuffer(audioUrl, options.provider);

  return {
    audioBuffer,
    duration: options.duration || 0,
    format: resolveOutputFormat(audioUrl, options.fallbackFormat),
    sampleRate: options.fallbackSampleRate,
    metadata: {
      provider: options.provider,
      audioUrl,
      ...metadata,
    },
  };
};
