// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from "./error-handler";

export type CosyVoiceMode =
  | "zero_shot"
  | "cross_lingual"
  | "sft"
  | "instruct2";

export interface CosyVoiceReferenceAudio {
  filename: string;
  originalName: string;
  fileSize: number;
  audioType: "example" | "uploaded";
  url: string;
}

export interface CosyVoiceSynthesizeRequest {
  text: string;
  referenceAudio?: string;
  mode?: CosyVoiceMode;
  promptText?: string;
  speakerId?: string;
  instructText?: string;
}

export interface CosyVoiceSynthesizeResult {
  audioUrl: string;
  duration?: number;
  sampleRate?: number;
  mode?: CosyVoiceMode;
  metadata?: Record<string, any>;
}

export interface CosyVoiceUploadResult {
  filename: string;
  originalName: string;
  url: string;
  fileSize: number;
  audioType: "uploaded" | "example";
}

type CosyVoiceApiResponse<T> =
  | {
      success?: boolean;
      data?: T;
    }
  | T;

const COSYVOICE_MODES: readonly CosyVoiceMode[] = [
  "zero_shot",
  "cross_lingual",
  "sft",
  "instruct2",
];

/**
 * CosyVoice API 客户端服务
 */
export class CosyVoiceService {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl =
      config?.baseUrl ||
      process.env.COSYVOICE_API_URL ||
      "http://192.168.88.9:8011";

    const timeoutRaw = process.env.COSYVOICE_TIMEOUT;
    const timeoutFromEnv =
      timeoutRaw !== undefined ? parseInt(timeoutRaw, 10) : undefined;
    this.timeout =
      config?.timeout ||
      (Number.isFinite(timeoutFromEnv) ? (timeoutFromEnv as number) : undefined) ||
      120000;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new TTSError(
          `CosyVoice API error: ${response.status} ${response.statusText} - ${errorText}`,
          "TTS_SERVICE_DOWN",
          "cosyvoice"
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TTSError(
          "CosyVoice API request timeout",
          "TTS_SERVICE_DOWN",
          "cosyvoice",
          true
        );
      }

      throw new TTSError(
        `CosyVoice API connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TTS_SERVICE_DOWN",
        "cosyvoice",
        true
      );
    }
  }

  async healthCheck(): Promise<{ status: string; modelLoaded?: boolean }> {
    return this.makeRequest("/api/health");
  }

  async getReferenceAudios(): Promise<CosyVoiceReferenceAudio[]> {
    const response = await this.makeRequest<CosyVoiceApiResponse<any[]>>(
      "/api/audio/list"
    );
    const rawItems = this.unwrapResponseData(response);

    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems.map((audio) => ({
      filename: String(audio.filename || ""),
      originalName: String(audio.originalName || audio.filename || ""),
      fileSize: Number(audio.fileSize ?? audio.size ?? 0),
      audioType: audio.audioType === "example" ? "example" : "uploaded",
      url: this.buildAbsoluteUrl(String(audio.url || "")),
    }));
  }

  async uploadAudio(file: File): Promise<CosyVoiceUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.makeRequest<CosyVoiceApiResponse<any>>(
      "/api/audio/upload",
      {
        method: "POST",
        body: formData,
      }
    );
    const result = this.unwrapResponseData(response);

    return {
      filename: String(result.filename || ""),
      originalName: String(result.originalName || file.name),
      url: this.buildAbsoluteUrl(String(result.url || "")),
      fileSize: Number(result.fileSize ?? file.size ?? 0),
      audioType: result.audioType === "example" ? "example" : "uploaded",
    };
  }

  async deleteAudio(filename: string): Promise<void> {
    await this.makeRequest<CosyVoiceApiResponse<any>>(
      `/api/audio/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      }
    );
  }

  async synthesize(
    request: CosyVoiceSynthesizeRequest
  ): Promise<CosyVoiceSynthesizeResult> {
    const mode = this.resolveMode(request.mode);
    const referenceAudio = request.referenceAudio?.trim();
    const speakerId = request.speakerId?.trim();

    if (mode === "sft" && !speakerId) {
      throw new TTSError(
        "CosyVoice sft mode requires speakerId",
        "TTS_SYNTHESIS_FAILED",
        "cosyvoice"
      );
    }

    if (mode !== "sft" && !referenceAudio) {
      throw new TTSError(
        "CosyVoice synthesis requires reference audio",
        "TTS_SYNTHESIS_FAILED",
        "cosyvoice"
      );
    }

    if (mode === "instruct2" && !request.instructText?.trim()) {
      throw new TTSError(
        "CosyVoice instruct2 mode requires instructText",
        "TTS_SYNTHESIS_FAILED",
        "cosyvoice"
      );
    }

    const payload: Record<string, any> = {
      text: request.text,
      mode,
    };

    if (referenceAudio) {
      payload.reference_audio = referenceAudio;
    }
    if (request.promptText !== undefined) {
      payload.prompt_text = request.promptText;
    }
    if (speakerId) {
      payload.speaker_id = speakerId;
    }
    if (request.instructText !== undefined) {
      payload.instruct_text = request.instructText;
    }

    const response = await this.makeRequest<CosyVoiceApiResponse<any>>(
      "/api/tts/synthesize",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    const result = this.unwrapResponseData(response);
    const audioUrl = result?.audioUrl || result?.audio_url;

    if (!audioUrl) {
      throw new TTSError(
        "CosyVoice synthesis completed without audio URL",
        "TTS_SYNTHESIS_FAILED",
        "cosyvoice"
      );
    }

    return {
      audioUrl: this.buildAbsoluteUrl(audioUrl),
      duration: typeof result.duration === "number" ? result.duration : 0,
      sampleRate:
        typeof result.sampleRate === "number"
          ? result.sampleRate
          : typeof result.sample_rate === "number"
            ? result.sample_rate
            : undefined,
      mode: this.resolveMode(result.mode, mode),
      metadata: {
        filename: result.filename,
        model: result.model,
      },
    };
  }

  private resolveMode(
    mode?: string,
    fallback: CosyVoiceMode = "cross_lingual"
  ): CosyVoiceMode {
    if (mode && COSYVOICE_MODES.includes(mode as CosyVoiceMode)) {
      return mode as CosyVoiceMode;
    }
    return fallback;
  }

  private unwrapResponseData<T>(response: CosyVoiceApiResponse<T>): T {
    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      response.data !== undefined
    ) {
      return response.data as T;
    }

    return response as T;
  }

  private buildAbsoluteUrl(path: string): string {
    if (!path) {
      return path;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${normalized}`;
  }
}

export const cosyVoiceService = new CosyVoiceService();
