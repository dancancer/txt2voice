// 一旦我被更新，请更新我的开头注释
// input: provider 名称/TTS 请求
// output: VoxCPM2 TTS provider manager 与全局实例
// pos: TTS 领域服务
import { TTSError } from "@/lib/error-handler";
import { VoxCPMTTSService } from "@/lib/tts/providers/voxcpm";
import type {
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSVoice,
} from "@/lib/tts/types";

const VOXCPM_PROVIDER = "voxcpm";

interface ManagedTTSService {
  getAvailableVoices(): Promise<TTSVoice[]>;
  synthesize(request: TTSRequest): Promise<TTSResponse>;
}

interface ProviderRegistration {
  key: string;
  service: ManagedTTSService;
  provider: Omit<TTSProvider, "isAvailable" | "supportedLanguages" | "supportedVoices">;
}

export class TTSServiceManager {
  private providers: Map<string, TTSProvider> = new Map();
  private services: Map<string, ManagedTTSService> = new Map();
  private initializationPromise: Promise<void> | null = null;

  private async registerProvider(registration: ProviderRegistration): Promise<void> {
    const { key, service, provider } = registration;

    try {
      const voices = await service.getAvailableVoices();
      this.providers.set(key, {
        ...provider,
        isAvailable: true,
        supportedLanguages: [...new Set(voices.map((voice) => voice.language))],
        supportedVoices: voices,
      });
      this.services.set(key, service);
    } catch (error) {
      console.warn(`TTS provider ${key} unavailable`, error);
      this.providers.set(key, {
        ...provider,
        isAvailable: false,
        supportedLanguages: [],
        supportedVoices: [],
      });
    }
  }

  private async initializeProviders() {
    this.providers.clear();
    this.services.clear();

    await this.registerProvider({
      key: VOXCPM_PROVIDER,
      service: new VoxCPMTTSService(),
      provider: {
        name: "VoxCPM2",
        type: "voxcpm",
        endpoint: process.env.VOXCPM_API_URL || "http://192.168.88.9:18083",
        model: "OpenBMB/VoxCPM2",
        maxCharacters: 4000,
        rateLimits: {
          requestsPerMinute: 6,
          charactersPerMinute: 12000,
        },
      },
    });
  }

  getAvailableProviders(): TTSProvider[] {
    return Array.from(this.providers.values()).filter((provider) => provider.isAvailable);
  }

  getProvider(providerName: string): TTSProvider | undefined {
    return this.providers.get(providerName);
  }

  getService(providerName: string): ManagedTTSService | undefined {
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
