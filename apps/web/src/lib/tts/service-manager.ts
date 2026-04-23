// 一旦我被更新，请更新我的开头注释
// input: provider 名称/TTS 请求
// output: TTS manager 与全局实例
// pos: TTS 领域服务
import { TTSError } from "@/lib/error-handler";
import { Qwen3VoiceTTSService } from "@/lib/tts/providers/qwen3voice";
import type {
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSVoice,
} from "@/lib/tts/types";

const QWEN3VOICE_PROVIDER = "qwen3voice";

export class TTSServiceManager {
  private providers: Map<string, TTSProvider> = new Map();
  private services: Map<string, Qwen3VoiceTTSService> = new Map();
  private initializationPromise: Promise<void> | null = null;

  private async initializeProviders() {
    const qwen3VoiceService = new Qwen3VoiceTTSService();
    const voices = await qwen3VoiceService.getAvailableVoices();

    this.providers.clear();
    this.services.clear();

    this.providers.set(QWEN3VOICE_PROVIDER, {
      name: "Qwen3 Voice",
      type: "qwen3voice",
      endpoint: process.env.QWEN3VOICE_API_URL || "http://192.168.88.9:18080",
      model: "Qwen3-TTS-12Hz-1.7B",
      isAvailable: true,
      supportedLanguages: [...new Set(voices.map((voice) => voice.language))],
      supportedVoices: voices,
      maxCharacters: 3000,
      rateLimits: {
        requestsPerMinute: 10,
        charactersPerMinute: 30000,
      },
    });
    this.services.set(QWEN3VOICE_PROVIDER, qwen3VoiceService);
  }

  getAvailableProviders(): TTSProvider[] {
    return Array.from(this.providers.values()).filter((provider) => provider.isAvailable);
  }

  getProvider(providerName: string): TTSProvider | undefined {
    return this.providers.get(providerName);
  }

  getService(providerName: string): Qwen3VoiceTTSService | undefined {
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
}

export const ttsServiceManager = new TTSServiceManager();
