// 一旦我被更新，请更新我的开头注释
// input: qwen3-voice 服务地址/TTS 请求
// output: qwen3voice provider 实现
// pos: TTS provider
import { TTSError } from "@/lib/error-handler";
import { createRemoteAudioResponse } from "@/lib/tts/remote-audio";
import type { TTSRequest, TTSResponse, TTSVoice } from "@/lib/tts/types";

export interface Qwen3VoiceSpeaker {
  id: string;
  name: string;
  source_type?: string;
  language?: string | null;
  reference_text?: string | null;
  tags?: string[];
  meta?: Record<string, unknown>;
  reference_audio_url?: string;
  preview_audio_url?: string | null;
  created_at?: string;
}

interface Qwen3VoiceJobResponse {
  id: string;
  speaker_id: string;
  mode: "file" | "stream";
  status: string;
  file_url: string | null;
  created_at: string;
  error_message?: string | null;
}

const DEFAULT_BASE_URL = "http://192.168.88.9:18080";
const DEFAULT_TIMEOUT_MS = 300_000;

const normalizeBaseUrl = (baseUrl?: string): string =>
  (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");

const resolveSpeakerLanguage = (language?: string | null): string => {
  const normalized = typeof language === "string" ? language.trim().toLowerCase() : "";
  if (normalized.includes("chinese") || normalized === "zh" || normalized === "zh-cn") {
    return "zh-CN";
  }
  if (normalized.includes("english") || normalized === "en" || normalized === "en-us") {
    return "en-US";
  }
  return "zh-CN";
};

const resolveQwenLanguage = (language?: string): string => {
  const normalized = typeof language === "string" ? language.trim().toLowerCase() : "";
  if (normalized.startsWith("zh")) {
    return "Chinese";
  }
  if (normalized.startsWith("en")) {
    return "English";
  }
  return "Auto";
};

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch (_error) {
    // ignore
  }

  try {
    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch (_error) {
    // ignore
  }

  return `${response.status} ${response.statusText}`.trim();
};

export class Qwen3VoiceTTSService {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = normalizeBaseUrl(baseUrl || process.env.QWEN3VOICE_API_URL);
    this.timeout = timeout;
  }

  async listSpeakers(): Promise<Qwen3VoiceSpeaker[]> {
    const response = await fetch(`${this.baseUrl}/api/speakers`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const detail = await readErrorText(response);
      throw new TTSError(
        `Qwen3Voice speaker list failed: ${detail}`,
        "TTS_SERVICE_DOWN",
        "qwen3voice",
        true
      );
    }

    const speakers = (await response.json()) as Qwen3VoiceSpeaker[];
    return Array.isArray(speakers) ? speakers : [];
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    const speakers = await this.listSpeakers();

    return speakers.map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      displayName: speaker.name,
      language: resolveSpeakerLanguage(speaker.language),
      gender: "neutral",
      age: "adult",
      style: Array.isArray(speaker.tags) && speaker.tags.length > 0 ? speaker.tags : ["qwen3voice"],
      sampleRate: 24000,
      description:
        speaker.reference_text ||
        speaker.meta?.voice_instruction?.toString() ||
        `${speaker.source_type || "qwen3voice"} speaker`,
      isNeural: true,
      locale: resolveSpeakerLanguage(speaker.language),
    }));
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          speaker_id: request.voice.id,
          text: request.text,
          params: {
            language: resolveQwenLanguage(request.voice.language),
            ...(typeof request.temperature === "number"
              ? { temperature: request.temperature }
              : {}),
            ...(typeof request.topK === "number" ? { top_k: request.topK } : {}),
            ...(typeof request.topP === "number" ? { top_p: request.topP } : {}),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await readErrorText(response);
        throw new TTSError(
          `Qwen3Voice synthesis failed: ${detail}`,
          "TTS_SYNTHESIS_FAILED",
          "qwen3voice",
          response.status >= 500
        );
      }

      const job = (await response.json()) as Qwen3VoiceJobResponse;
      if (!job.file_url) {
        throw new TTSError(
          "Qwen3Voice synthesis completed without file URL",
          "TTS_SYNTHESIS_FAILED",
          "qwen3voice"
        );
      }

      return createRemoteAudioResponse(
        job.file_url,
        {
          provider: "qwen3voice",
          fallbackFormat: request.outputFormat,
          fallbackSampleRate: request.voice.sampleRate || 24000,
        },
        {
          jobId: job.id,
          speakerId: job.speaker_id || request.voice.id,
          status: job.status,
          mode: job.mode,
          createdAt: job.created_at,
        }
      );
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === "AbortError";
      throw new TTSError(
        isAbort ? "Qwen3Voice synthesis timed out" : "Qwen3Voice service connection failed",
        "TTS_SERVICE_DOWN",
        "qwen3voice",
        true
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
