// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from "./error-handler";

export interface VoxCPMReferenceAudio {
  filename: string;
  originalName: string;
  fileSize: number;
  audioType: "uploaded";
  url: string;
}

export interface VoxCPMSynthesizeRequest {
  text: string;
  referenceAudio?: string;
  promptText?: string;
}

export interface VoxCPMSynthesizeResult {
  audioUrl: string;
  duration?: number;
  sampleRate?: number;
  metadata?: Record<string, any>;
}

export interface VoxCPMUploadResult {
  filename: string;
  originalName: string;
  url: string;
  fileSize: number;
  audioType: "uploaded";
}

type VoxCPMApiResponse<T> =
  | {
      success?: boolean;
      data?: T;
    }
  | T;

/**
 * VoxCPM API 客户端服务
 */
export class VoxCPMService {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl =
      config?.baseUrl || process.env.VOXCPM_API_URL || "http://192.168.88.9:8012";

    const timeoutRaw = process.env.VOXCPM_TIMEOUT;
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
          `VoxCPM API error: ${response.status} ${response.statusText} - ${errorText}`,
          "TTS_SERVICE_DOWN",
          "voxcpm"
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TTSError(
          "VoxCPM API request timeout",
          "TTS_SERVICE_DOWN",
          "voxcpm",
          true
        );
      }

      throw new TTSError(
        `VoxCPM API connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TTS_SERVICE_DOWN",
        "voxcpm",
        true
      );
    }
  }

  async healthCheck(): Promise<{ status: string; modelLoaded?: boolean }> {
    return this.makeRequest("/api/health");
  }

  async getReferenceAudios(): Promise<VoxCPMReferenceAudio[]> {
    const response = await this.makeRequest<VoxCPMApiResponse<any[]>>(
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
      audioType: "uploaded",
      url: this.buildAbsoluteUrl(String(audio.url || "")),
    }));
  }

  async uploadAudio(file: File): Promise<VoxCPMUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.makeRequest<VoxCPMApiResponse<any>>(
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
      audioType: "uploaded",
    };
  }

  async deleteAudio(filename: string): Promise<void> {
    await this.makeRequest<VoxCPMApiResponse<any>>(
      `/api/audio/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      }
    );
  }

  async synthesize(
    request: VoxCPMSynthesizeRequest
  ): Promise<VoxCPMSynthesizeResult> {
    const payload: Record<string, any> = {
      text: request.text,
    };

    const referenceAudio = request.referenceAudio?.trim();
    if (referenceAudio) {
      payload.reference_audio = referenceAudio;
    }

    if (request.promptText !== undefined) {
      payload.prompt_text = request.promptText;
    }

    const response = await this.makeRequest<VoxCPMApiResponse<any>>(
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
        "VoxCPM synthesis completed without audio URL",
        "TTS_SYNTHESIS_FAILED",
        "voxcpm"
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
      metadata: {
        filename: result.filename,
        model: result.model,
      },
    };
  }

  private unwrapResponseData<T>(response: VoxCPMApiResponse<T>): T {
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

export const voxCPMService = new VoxCPMService();
