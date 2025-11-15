import { TTSError } from "./error-handler";

// IndexTTS API 相关类型定义
export interface ReferenceAudio {
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  format: string;
  audioType: "example" | "uploaded" | "emotion";
  description?: string;
  speakerId?: string;
  url: string;
}

export interface AudioAnalysis {
  filename: string;
  duration: number;
  sampleRate: number;
  fileSize: number;
  format: string;
  speakerId: string;
  confidence: number;
  embeddingShape: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface SpeakerComparison {
  audioFile1: string;
  audioFile2: string;
  cosineSimilarity: number;
  euclideanDistance: number;
  sameSpeakerProbability: number;
  isSameSpeaker: boolean;
}

export interface EmotionVector {
  happy: number;
  angry: number;
  sad: number;
  afraid: number;
  disgusted: number;
  melancholic: number;
  surprised: number;
  calm: number;
}

export interface SynthesizeRequest {
  text: string;
  referenceAudio: string;
  emoControlMethod:
    | "Same as the voice reference"
    | "Use separate emotion reference"
    | "Use emotion vectors";
  emotionReference?: string;
  emotionVector?: EmotionVector;
  emotionWeight?: number;
  sample?: number;
  temperature?: number;
  beamSearch?: boolean;
  topK?: number;
  topP?: number;
}

export interface SynthesizeResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  audioUrl?: string;
  duration?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface UploadResult {
  filename: string;
  originalName: string;
  url: string;
  fileSize: number;
  duration?: number;
  format: string;
}

/**
 * IndexTTS API 客户端服务
 */
export class IndexTTSService {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
  }) {
    this.baseUrl =
      config?.baseUrl ||
      process.env.INDEXTTS_API_URL ||
      "http://192.168.88.9:8001";
    this.apiKey = config?.apiKey || process.env.INDEXTTS_API_KEY;
    const defaultTimeout = 300000; // allow long-running syntheses (~5 minutes)
    const envTimeoutRaw = process.env.INDEXTTS_TIMEOUT;
    const envTimeoutValue =
      envTimeoutRaw !== undefined ? parseInt(envTimeoutRaw, 10) : undefined;

    const resolvedTimeout =
      config?.timeout ||
      (Number.isFinite(envTimeoutValue) ? (envTimeoutValue as number) : undefined) ||
      defaultTimeout;

    // 保证服务端至少有默认的超时时间，避免环境变量仍旧配置较小值
    this.timeout = Math.max(resolvedTimeout, defaultTimeout);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestStartedAt = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
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
          `IndexTTS API error: ${response.status} ${response.statusText} - ${errorText}`,
          "TTS_SERVICE_DOWN",
          "indextts"
        );
      }

      return await response.json();
    } catch (error) {
      const elapsed = Date.now() - requestStartedAt;
      console.warn(
        `[IndexTTS] Request failed`,
        JSON.stringify({
          endpoint,
          configuredTimeoutMs: this.timeout,
          elapsedMs: elapsed,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        })
      );
      if (error instanceof TTSError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new TTSError(
          "IndexTTS API request timeout",
          "TTS_SERVICE_DOWN",
          "indextts",
          true
        );
      }
      throw new TTSError(
        `IndexTTS API connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TTS_SERVICE_DOWN",
        "indextts",
        true
      );
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest("/api/health");
  }

  /**
   * 获取参考音频列表
   */
  async getReferenceAudios(): Promise<ReferenceAudio[]> {
    const response = await this.makeRequest<any[]>("/api/audio/list");

    // 转换API响应格式到我们的ReferenceAudio格式
    return response.map((audio: any) => ({
      filename: audio.filename,
      originalName: audio.filename,
      filePath: audio.path,
      fileSize: audio.size,
      duration: 0, // API没有返回duration信息，使用默认值
      sampleRate: 0, // API没有返回sampleRate信息，使用默认值
      format: audio.filename.split('.').pop() || 'wav',
      audioType: audio.type === 'example' ? 'example' : 'uploaded',
      description: audio.filename,
      url: `${this.baseUrl}${audio.url}`,
      speakerId: undefined,
    }));
  }

  /**
   * 上传音频文件
   */
  async uploadAudio(file: File, description?: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (description) {
      formData.append("description", description);
    }

    const url = `${this.baseUrl}/api/audio/upload`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new TTSError(
          `IndexTTS upload error: ${response.status} ${response.statusText} - ${errorText}`,
          "TTS_SERVICE_DOWN",
          "indextts"
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError(
        `IndexTTS upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TTS_SERVICE_DOWN",
        "indextts",
        true
      );
    }
  }

  /**
   * 删除音频文件
   */
  async deleteAudio(filename: string): Promise<void> {
    await this.makeRequest(`/api/audio/${filename}`, {
      method: "DELETE",
    });
  }

  /**
   * 分析音频文件
   */
  async analyzeAudio(filename: string): Promise<AudioAnalysis> {
    const response = await this.makeRequest<{
      success: boolean;
      data: AudioAnalysis;
    }>("/api/audio/analyze", {
      method: "POST",
      body: JSON.stringify({ audio_file: filename }),
    });
    return response.data;
  }

  /**
   * 比较两个音频的说话人相似度
   */
  async compareSpeakers(
    audioFile1: string,
    audioFile2: string
  ): Promise<SpeakerComparison> {
    const response = await this.makeRequest<{
      success: boolean;
      data: SpeakerComparison;
    }>("/api/audio/compare-speakers", {
      method: "POST",
      body: JSON.stringify({
        audio_file1: audioFile1,
        audio_file2: audioFile2,
      }),
    });
    return response.data;
  }

  /**
   * 语音合成
   */
  async synthesize(request: SynthesizeRequest): Promise<SynthesizeResult> {
    // FastAPI 服务使用 snake_case 字段命名，因此在发送前需转换请求结构
    const payload: Record<string, any> = {
      text: request.text,
      reference_audio: request.referenceAudio,
      emo_control_method: request.emoControlMethod,
      emotion_weight: request.emotionWeight,
      sample: request.sample,
      temperature: request.temperature,
      beam_search: request.beamSearch,
      top_k: request.topK,
      top_p: request.topP,
    };

    if (request.emotionReference) {
      payload.emotion_reference = request.emotionReference;
    }

    if (request.emotionVector) {
      payload.emotion_vector = request.emotionVector;
    }

    const response = await this.makeRequest<any>("/api/tts/synthesize", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return this.normalizeSynthesisResult(response);
  }

  /**
   * 获取合成任务状态
   */
  async getSynthesisTask(taskId: string): Promise<SynthesizeResult> {
    const response = await this.makeRequest<any>(`/api/tts/tasks/${taskId}`);
    return this.normalizeSynthesisResult(response);
  }

  /**
   * 等待合成任务完成
   */
  async waitForSynthesisTask(
    taskId: string,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<SynthesizeResult> {
    const { timeout = 60000, interval = 2000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const task = await this.getSynthesisTask(taskId);

      if (task.status === "completed") {
        return task;
      }

      if (task.status === "failed") {
        throw new TTSError(
          `Synthesis task failed: ${task.errorMessage}`,
          "TTS_SYNTHESIS_FAILED",
          "indextts"
        );
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TTSError(
      "Synthesis task timeout",
      "TTS_SERVICE_DOWN",
      "indextts",
      true
    );
  }

  /**
   * 完整的语音合成流程（包含等待）
   */
  async synthesizeAndWait(
    request: SynthesizeRequest,
    options?: { timeout?: number; interval?: number }
  ): Promise<SynthesizeResult> {
    const initialResult = await this.synthesize(request);

    if (initialResult.status === "completed") {
      return initialResult;
    }

    return this.waitForSynthesisTask(initialResult.taskId, options);
  }

  /**
   * 获取音频文件的完整 URL
   */
  getAudioUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`;
  }

  /**
   * 获取用于客户端播放的音频URL
   * 考虑客户端访问环境，使用public URL或相对路径
   */
  getPublicAudioUrl(filename: string): string {
    // 如果配置了public URL，使用它
    const publicBaseUrl = process.env.NEXT_PUBLIC_INDEXTTS_API_URL;
    if (publicBaseUrl) {
      return `${publicBaseUrl}/${filename}`;
    }

    // 否则尝试使用相对路径（适用于同源部署）
    return `/${filename}`;
  }

  /**
   * 验证音频文件格式
   */
  static validateAudioFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = [
      "audio/wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/flac",
      "audio/m4a",
      "audio/x-m4a",
      "audio/ogg",
    ];

    // 后端支持的文件扩展名
    const allowedExtensions = [".wav", ".mp3", ".flac", ".m4a", ".ogg"];
    const maxSize = parseInt(process.env.INDEXTTS_MAX_FILE_SIZE || "104857600"); // 100MB

    // 获取文件扩展名
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `不支持的文件格式: ${fileExtension}。支持的格式: ${allowedExtensions.join(", ")}`,
      };
    }

    // 同时检查MIME类型（某些浏览器可能无法正确识别所有音频类型的MIME）
    if (file.type && !allowedTypes.includes(file.type)) {
      console.warn(`MIME type ${file.type} may not be recognized, but file extension ${fileExtension} is supported`);
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `文件大小超过限制: ${(file.size / 1024 / 1024).toFixed(
          2
        )}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    return { valid: true };
  }

  private normalizeSynthesisResult(response: any): SynthesizeResult {
    const rawResult =
      response && typeof response === "object" && "data" in response
        ? response.data
        : response;

    if (!rawResult) {
      throw new TTSError(
        "IndexTTS API returned empty response",
        "TTS_SERVICE_DOWN",
        "indextts",
        true
      );
    }

    const rawAudioUrl = rawResult.audioUrl || rawResult.audio_url;

    return {
      taskId: rawResult.taskId || rawResult.task_id || "",
      status: rawResult.status || "pending",
      audioUrl: rawAudioUrl ? this.buildAbsoluteUrl(rawAudioUrl) : undefined,
      duration: rawResult.duration,
      errorMessage: rawResult.errorMessage || rawResult.error_message,
      metadata: rawResult.metadata,
    };
  }

  private buildAbsoluteUrl(path: string): string {
    if (!path) {
      return path;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const normalized = path.startsWith("/") ? path.slice(1) : path;
    return `${this.baseUrl}/${normalized}`;
  }
}

// 全局 IndexTTS 服务实例
export const indexTTSService = new IndexTTSService();
