// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from "./error-handler";
import { cosyVoiceService } from "./cosyvoice-service";
import type { CosyVoiceMode } from "./cosyvoice-service";
import { EmotionVector, indexTTSService } from "./indextts-service";
import { voxCPMService } from "./voxcpm-service";

export interface TTSProvider {
  name: string;
  type:
    | "azure"
    | "openai"
    | "indextts"
    | "cosyvoice"
    | "voxcpm"
    | "custom";
  apiKey?: string;
  region?: string;
  endpoint?: string;
  model?: string;
  isAvailable: boolean;
  supportedLanguages: string[];
  supportedVoices: TTSVoice[];
  maxCharacters: number;
  rateLimits?: {
    requestsPerMinute: number;
    charactersPerMinute: number;
  };
}

export interface TTSVoice {
  id: string;
  name: string;
  displayName: string;
  language: string;
  gender: "male" | "female" | "neutral";
  age: "child" | "teen" | "adult" | "senior";
  style: string[];
  sampleRate?: number;
  description?: string;
  isNeural?: boolean;
  locale?: string;
}

export interface TTSRequest {
  text: string;
  voice: TTSVoice;
  outputFormat: "mp3" | "wav" | "ogg";
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
  style?: string;
  // IndexTTS provider-specific fields
  referenceAudio?: string;
  emoControlMethod?:
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
  // CosyVoice provider-specific fields
  cosyMode?: CosyVoiceMode;
  cosyPromptText?: string;
  cosySpeakerId?: string;
  cosyInstructText?: string;
  // VoxCPM provider-specific fields
  voxcpmPromptText?: string;
}

export interface TTSResponse {
  audioBuffer: ArrayBuffer;
  duration: number;
  format: string;
  sampleRate: number;
  metadata: Record<string, any>;
}

/**
 * Azure TTS 服务
 */
export class AzureTTSService {
  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey;
    this.region = region;
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Azure voices");
      }

      const voices = await response.json();

      return voices.map((voice: any) => ({
        id: voice.ShortName,
        name: voice.ShortName,
        displayName: voice.LocalName || voice.Name,
        language: voice.Locale,
        gender: voice.Gender.toLowerCase() as "male" | "female",
        age: "adult",
        style: voice.StyleList || [],
        sampleRate: voice.SampleRateHertz,
        description: voice.Description,
        isNeural: voice.VoiceType === "Neural",
        locale: voice.Locale,
      }));
    } catch (error) {
      console.error("Failed to fetch Azure voices:", error);
      return [];
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const ssml = this.generateSSML(request);

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": this.apiKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": this.getOutputFormat(
              request.outputFormat
            ),
          },
          body: ssml,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new TTSError(
          `Azure TTS synthesis failed: ${errorText}`,
          "TTS_SERVICE_DOWN",
          "azure"
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return {
        audioBuffer,
        duration: 0, // 需要分析音频文件获取实际时长
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: "azure",
          voice: request.voice.id,
          ssml,
        },
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError(
        "Azure TTS service connection failed",
        "TTS_SERVICE_DOWN",
        "azure",
        true
      );
    }
  }

  private generateSSML(request: TTSRequest): string {
    const {
      text,
      voice,
      speed = 1.0,
      pitch = 0,
      volume = 1.0,
      emotion,
      style,
    } = request;

    let prosody = "";
    if (speed !== 1.0) prosody += ` rate="${speed}"`;
    if (pitch !== 0) prosody += ` pitch="${pitch > 0 ? "+" : ""}${pitch}Hz"`;
    if (volume !== 1.0) prosody += ` volume="${volume}"`;

    let emotionExpression = "";
    if (emotion && voice.style.includes(emotion)) {
      emotionExpression = ` mstts:express-as="${emotion}"`;
    } else if (style && voice.style.includes(style)) {
      emotionExpression = ` mstts:express-as="${style}"`;
    }

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.language}">
      <voice name="${voice.id}">
        <prosody${prosody}>
          <p${emotionExpression}>
            ${text}
          </p>
        </prosody>
      </voice>
    </speak>`;
  }

  private getOutputFormat(format: string): string {
    const formats = {
      mp3: "audio-24khz-96kbitrate-mono-mp3",
      wav: "riff-24khz-16bit-mono-pcm",
      ogg: "ogg-24khz-16bit-mono-opus",
    };
    return formats[format as keyof typeof formats] || formats.mp3;
  }
}

/**
 * OpenAI TTS 服务
 */
export class OpenAITTSService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    // OpenAI TTS 目前支持的有限声音
    const voices = [
      {
        id: "alloy",
        name: "alloy",
        displayName: "Alloy (中性)",
        language: "zh-CN",
        gender: "neutral" as const,
        age: "adult" as const,
        style: ["neutral"],
        description: "中性声音，适合旁白",
        isNeural: true,
      },
      {
        id: "echo",
        name: "echo",
        displayName: "Echo (男声)",
        language: "zh-CN",
        gender: "male" as const,
        age: "adult" as const,
        style: ["neutral"],
        description: "男性声音",
        isNeural: true,
      },
      {
        id: "fable",
        name: "fable",
        displayName: "Fable (英式男声)",
        language: "en-GB",
        gender: "male" as const,
        age: "adult" as const,
        style: ["narrative"],
        description: "英式男性声音，适合讲故事",
        isNeural: true,
      },
      {
        id: "onyx",
        name: "onyx",
        displayName: "Onyx (深沉男声)",
        language: "zh-CN",
        gender: "male" as const,
        age: "adult" as const,
        style: ["serious"],
        description: "深沉男性声音",
        isNeural: true,
      },
      {
        id: "nova",
        name: "nova",
        displayName: "Nova (女声)",
        language: "zh-CN",
        gender: "female" as const,
        age: "adult" as const,
        style: ["friendly"],
        description: "女性声音",
        isNeural: true,
      },
      {
        id: "shimmer",
        name: "shimmer",
        displayName: "Shimmer (温柔女声)",
        language: "zh-CN",
        gender: "female" as const,
        age: "adult" as const,
        style: ["gentle"],
        description: "温柔女性声音",
        isNeural: true,
      },
    ];

    return voices;
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: request.text,
          voice: request.voice.id,
          response_format: request.outputFormat,
          speed: request.speed || 1.0,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TTSError(
          `OpenAI TTS synthesis failed: ${
            error.error?.message || response.statusText
          }`,
          "TTS_SERVICE_DOWN",
          "openai"
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return {
        audioBuffer,
        duration: 0, // OpenAI doesn't return duration
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: "openai",
          voice: request.voice.id,
          model: "tts-1",
        },
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError(
        "OpenAI TTS service connection failed",
        "TTS_SERVICE_DOWN",
        "openai",
        true
      );
    }
  }
}

/**
 * TTS 服务管理器
 */
export class TTSServiceManager {
  private providers: Map<string, TTSProvider> = new Map();
  private services: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;

  private async initializeProviders() {
    // Azure TTS
    if (process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION) {
      const azureService = new AzureTTSService(
        process.env.AZURE_TTS_KEY,
        process.env.AZURE_TTS_REGION
      );

      try {
        const voices = await azureService.getAvailableVoices();
        this.providers.set("azure", {
          name: "Azure TTS",
          type: "azure",
          apiKey: process.env.AZURE_TTS_KEY,
          region: process.env.AZURE_TTS_REGION,
          isAvailable: true,
          supportedLanguages: [...new Set(voices.map((v) => v.language))],
          supportedVoices: voices,
          maxCharacters: 10000,
          rateLimits: {
            requestsPerMinute: 100,
            charactersPerMinute: 300000,
          },
        });
        this.services.set("azure", azureService);
      } catch (error) {
        console.error("Failed to initialize Azure TTS:", error);
      }
    }

    // OpenAI TTS
    if (process.env.OPENAI_API_KEY) {
      const openaiService = new OpenAITTSService(process.env.OPENAI_API_KEY);

      try {
        const voices = await openaiService.getAvailableVoices();
        this.providers.set("openai", {
          name: "OpenAI TTS",
          type: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          isAvailable: true,
          supportedLanguages: ["zh-CN", "en-US", "en-GB"],
          supportedVoices: voices,
          maxCharacters: 4096,
          rateLimits: {
            requestsPerMinute: 50,
            charactersPerMinute: 100000,
          },
        });
        this.services.set("openai", openaiService);
      } catch (error) {
        console.error("Failed to initialize OpenAI TTS:", error);
      }
    }

    // IndexTTS
    try {
      const referenceAudios = await indexTTSService.getReferenceAudios();
      const indexTTSVoices = referenceAudios.map((audio, index) => ({
        id: audio.filename,
        name: audio.filename,
        displayName: audio.originalName || audio.filename,
        language: "zh-CN",
        gender: "neutral" as const,
        age: "adult" as const,
        style: ["neutral"],
        description: audio.description || `参考音频: ${audio.originalName}`,
        isNeural: true,
        sampleRate: audio.sampleRate,
      }));

      this.providers.set("indextts", {
        name: "IndexTTS",
        type: "indextts",
        endpoint: process.env.INDEXTTS_API_URL || "http://192.168.88.9:8001",
        isAvailable: true,
        supportedLanguages: ["zh-CN"],
        supportedVoices: indexTTSVoices,
        maxCharacters: 10000,
        rateLimits: {
          requestsPerMinute: 30,
          charactersPerMinute: 200000,
        },
      });
      this.services.set("indextts", indexTTSService);
    } catch (error) {
      console.error("Failed to initialize IndexTTS:", error);
    }

    // CosyVoice
    try {
      await cosyVoiceService.healthCheck();
      const referenceAudios = await cosyVoiceService.getReferenceAudios();
      const cosyVoiceVoices = referenceAudios.map((audio) => ({
        id: audio.filename,
        name: audio.filename,
        displayName: audio.originalName || audio.filename,
        language: "zh-CN",
        gender: "neutral" as const,
        age: "adult" as const,
        style:
          audio.audioType === "example"
            ? ["zero-shot", "cross-lingual"]
            : ["zero-shot"],
        description: `参考音频(${audio.audioType}): ${
          audio.originalName || audio.filename
        }`,
        isNeural: true,
        sampleRate: 22050,
      }));

      this.providers.set("cosyvoice", {
        name: "CosyVoice",
        type: "cosyvoice",
        endpoint: process.env.COSYVOICE_API_URL || "http://192.168.88.9:8011",
        isAvailable: true,
        supportedLanguages: ["zh-CN", "en-US", "ja-JP", "ko-KR"],
        supportedVoices: cosyVoiceVoices,
        maxCharacters: 2000,
        rateLimits: {
          requestsPerMinute: 20,
          charactersPerMinute: 80000,
        },
      });
      this.services.set("cosyvoice", cosyVoiceService);
    } catch (error) {
      console.error("Failed to initialize CosyVoice:", error);
    }

    // VoxCPM
    try {
      await voxCPMService.healthCheck();
      const referenceAudios = await voxCPMService.getReferenceAudios();
      const voxCPMVoices = referenceAudios.map((audio) => ({
        id: audio.filename,
        name: audio.filename,
        displayName: audio.originalName || audio.filename,
        language: "zh-CN",
        gender: "neutral" as const,
        age: "adult" as const,
        style: ["cloning"],
        description: `参考音频: ${audio.originalName || audio.filename}`,
        isNeural: true,
        sampleRate: 24000,
      }));

      if (voxCPMVoices.length === 0) {
        voxCPMVoices.push({
          id: "__voxcpm_default__",
          name: "default",
          displayName: "VoxCPM 默认音色",
          language: "zh-CN",
          gender: "neutral" as const,
          age: "adult" as const,
          style: ["default"],
          description: "不使用参考音频，直接用模型默认音色",
          isNeural: true,
          sampleRate: 24000,
        });
      }

      this.providers.set("voxcpm", {
        name: "VoxCPM",
        type: "voxcpm",
        endpoint: process.env.VOXCPM_API_URL || "http://192.168.88.9:8012",
        isAvailable: true,
        supportedLanguages: ["zh-CN", "en-US"],
        supportedVoices: voxCPMVoices,
        maxCharacters: 2000,
        rateLimits: {
          requestsPerMinute: 20,
          charactersPerMinute: 80000,
        },
      });
      this.services.set("voxcpm", voxCPMService);
    } catch (error) {
      console.error("Failed to initialize VoxCPM:", error);
    }
  }

  getAvailableProviders(): TTSProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isAvailable);
  }

  getProvider(providerName: string): TTSProvider | undefined {
    return this.providers.get(providerName);
  }

  getService(providerName: string): any {
    return this.services.get(providerName);
  }

  async getVoice(
    providerName: string,
    voiceId: string
  ): Promise<TTSVoice | null> {
    const provider = this.providers.get(providerName);
    if (!provider) return null;

    return (
      provider.supportedVoices.find((voice) => voice.id === voiceId) || null
    );
  }

  async synthesize(
    request: TTSRequest,
    providerName: string
  ): Promise<TTSResponse> {
    const service = this.services.get(providerName);
    if (!service) {
      throw new TTSError(
        `TTS provider ${providerName} not available`,
        "TTS_SERVICE_DOWN",
        providerName
      );
    }

    if (providerName === "indextts") {
      const referenceAudio = request.referenceAudio || request.voice?.id;
      if (!referenceAudio) {
        throw new TTSError(
          "IndexTTS synthesis requires reference audio",
          "TTS_SYNTHESIS_FAILED",
          "indextts"
        );
      }

      const synthesisResult = await indexTTSService.synthesizeAndWait(
        {
          text: request.text,
          referenceAudio,
          emoControlMethod:
            request.emoControlMethod || "Same as the voice reference",
          emotionReference: request.emotionReference,
          emotionVector: request.emotionVector,
          emotionWeight: request.emotionWeight,
          sample: request.sample,
          temperature: request.temperature,
          beamSearch: request.beamSearch,
          topK: request.topK,
          topP: request.topP,
        },
        {
          timeout: 300000,
          interval: 3000,
        }
      );

      if (!synthesisResult.audioUrl) {
        throw new TTSError(
          "IndexTTS synthesis completed without audio URL",
          "TTS_SYNTHESIS_FAILED",
          "indextts"
        );
      }

      return this.createRemoteAudioResponse(
        synthesisResult.audioUrl,
        {
          provider: "indextts",
          fallbackFormat: request.outputFormat,
          fallbackSampleRate: request.voice.sampleRate || 24000,
          duration: synthesisResult.duration || 0,
        },
        {
          taskId: synthesisResult.taskId,
          referenceAudio,
          ...synthesisResult.metadata,
        }
      );
    }

    if (providerName === "cosyvoice") {
      const selectedMode = this.resolveCosyVoiceMode(
        request.cosyMode || process.env.COSYVOICE_DEFAULT_MODE
      );
      const referenceAudio =
        request.referenceAudio || this.resolveReferenceAudioFromVoice(request.voice.id);

      const synthesisResult = await cosyVoiceService.synthesize({
        text: request.text,
        mode: selectedMode,
        referenceAudio,
        promptText: request.cosyPromptText,
        speakerId: request.cosySpeakerId,
        instructText: request.cosyInstructText,
      });

      return this.createRemoteAudioResponse(
        synthesisResult.audioUrl,
        {
          provider: "cosyvoice",
          fallbackFormat: request.outputFormat,
          fallbackSampleRate:
            synthesisResult.sampleRate || request.voice.sampleRate || 22050,
          duration: synthesisResult.duration || 0,
        },
        {
          mode: synthesisResult.mode || selectedMode,
          referenceAudio,
          ...synthesisResult.metadata,
        }
      );
    }

    if (providerName === "voxcpm") {
      const referenceAudio =
        request.referenceAudio || this.resolveReferenceAudioFromVoice(request.voice.id);
      const synthesisResult = await voxCPMService.synthesize({
        text: request.text,
        referenceAudio,
        promptText: request.voxcpmPromptText,
      });

      return this.createRemoteAudioResponse(
        synthesisResult.audioUrl,
        {
          provider: "voxcpm",
          fallbackFormat: request.outputFormat,
          fallbackSampleRate:
            synthesisResult.sampleRate || request.voice.sampleRate || 24000,
          duration: synthesisResult.duration || 0,
        },
        {
          referenceAudio,
          ...synthesisResult.metadata,
        }
      );
    }

    return service.synthesize(request);
  }

  async ready(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeProviders().catch((error) => {
        this.initializationPromise = null;
        console.error("Failed to initialize TTS providers", error);
        throw error;
      });
    }

    await this.initializationPromise;
  }

  private async createRemoteAudioResponse(
    audioUrl: string,
    options: {
      provider: string;
      fallbackFormat: TTSRequest["outputFormat"];
      fallbackSampleRate: number;
      duration?: number;
    },
    metadata: Record<string, any>
  ): Promise<TTSResponse> {
    const audioBuffer = await this.downloadAudioBuffer(audioUrl, options.provider);

    return {
      audioBuffer,
      duration: options.duration || 0,
      format: this.resolveOutputFormat(audioUrl, options.fallbackFormat),
      sampleRate: options.fallbackSampleRate,
      metadata: {
        provider: options.provider,
        audioUrl,
        ...metadata,
      },
    };
  }

  private async downloadAudioBuffer(
    audioUrl: string,
    provider: string
  ): Promise<ArrayBuffer> {
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
  }

  private resolveReferenceAudioFromVoice(voiceId: string | undefined): string | undefined {
    if (!voiceId || voiceId.startsWith("__")) {
      return undefined;
    }
    return voiceId;
  }

  private resolveOutputFormat(
    audioUrl: string | undefined,
    fallback: TTSRequest["outputFormat"]
  ): string {
    if (!audioUrl) return fallback;

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
  }

  private resolveCosyVoiceMode(input?: string): CosyVoiceMode {
    if (
      input === "zero_shot" ||
      input === "cross_lingual" ||
      input === "sft" ||
      input === "instruct2"
    ) {
      return input;
    }
    return "cross_lingual";
  }
}

// 全局 TTS 服务管理器实例
export const ttsServiceManager = new TTSServiceManager();
