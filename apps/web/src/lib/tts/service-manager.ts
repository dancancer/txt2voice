// 一旦我被更新，请更新我的开头注释
// input: provider 名称/TTS 请求
// output: TTS manager 与全局实例
// pos: TTS 领域服务
import { TTSError } from "@/lib/error-handler";
import { cosyVoiceService } from "@/lib/cosyvoice-service";
import type { CosyVoiceMode } from "@/lib/cosyvoice-service";
import { indexTTSService } from "@/lib/indextts-service";
import { voxCPMService } from "@/lib/voxcpm-service";
import { AzureTTSService } from "@/lib/tts/providers/azure";
import { OpenAITTSService } from "@/lib/tts/providers/openai";
import { createRemoteAudioResponse } from "@/lib/tts/remote-audio";
import type {
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSVoice,
} from "@/lib/tts/types";

export class TTSServiceManager {
  private providers: Map<string, TTSProvider> = new Map();
  private services: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;

  private async initializeProviders() {
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

    try {
      const referenceAudios = await indexTTSService.getReferenceAudios();
      const indexTTSVoices = referenceAudios.map((audio) => ({
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
        description: `参考音频(${audio.audioType}): ${audio.originalName || audio.filename}`,
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

  async getVoice(providerName: string, voiceId: string): Promise<TTSVoice | null> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return null;
    }
    return provider.supportedVoices.find((voice) => voice.id === voiceId) || null;
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

      return createRemoteAudioResponse(
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

      return createRemoteAudioResponse(
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

      return createRemoteAudioResponse(
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

  private resolveReferenceAudioFromVoice(voiceId: string | undefined): string | undefined {
    if (!voiceId || voiceId.startsWith("__")) {
      return undefined;
    }
    return voiceId;
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

export const ttsServiceManager = new TTSServiceManager();
