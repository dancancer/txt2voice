// 一旦我被更新，请更新我的开头注释
// input: provider 名称/endpoint/可选依赖
// output: 真实 synth 探针结果
// pos: 共享业务库
import { getAudioRuntimePolicy } from "./audio-runtime-policy";
import { CosyVoiceService, type CosyVoiceMode } from "./cosyvoice-service";
import { IndexTTSService } from "./indextts-service";
import { VoxCPMService } from "./voxcpm-service";

export type TtsRuntimeProbeProvider = "indextts" | "cosyvoice" | "voxcpm";

export interface TtsRuntimeProbeResult {
  provider: TtsRuntimeProbeProvider;
  healthy: boolean;
  message: string;
  latencyMs: number;
  checkedAt: string;
}

interface IndexTtsProbeService {
  getReferenceAudios: () => Promise<Array<{ filename: string }>>;
  synthesizeAndWait: (
    request: {
      text: string;
      referenceAudio: string;
      emoControlMethod:
        | "Same as the voice reference"
        | "Use separate emotion reference"
        | "Use emotion vectors";
    },
    options?: { timeout?: number; interval?: number }
  ) => Promise<unknown>;
}

interface CosyVoiceProbeService {
  getReferenceAudios: () => Promise<Array<{ filename: string }>>;
  synthesize: (request: {
    text: string;
    referenceAudio: string;
    mode?: CosyVoiceMode;
  }) => Promise<unknown>;
}

interface VoxProbeService {
  synthesize: (request: { text: string }) => Promise<unknown>;
}

interface TtsRuntimeProbeDependencies {
  indextts?: IndexTtsProbeService;
  cosyvoice?: CosyVoiceProbeService;
  voxcpm?: VoxProbeService;
}

interface ProbeOptions {
  provider: TtsRuntimeProbeProvider;
  endpoint?: string;
  timeoutMs?: number;
  deps?: TtsRuntimeProbeDependencies;
}

const buildProbeResult = ({
  provider,
  healthy,
  message,
  startedAt,
}: {
  provider: TtsRuntimeProbeProvider;
  healthy: boolean;
  message: string;
  startedAt: number;
}): TtsRuntimeProbeResult => ({
  provider,
  healthy,
  message,
  latencyMs: Math.max(0, Date.now() - startedAt),
  checkedAt: new Date().toISOString(),
});

const createIndexTtsProbeService = (
  endpoint?: string,
  timeoutMs?: number
): IndexTtsProbeService =>
  new IndexTTSService({
    ...(endpoint ? { baseUrl: endpoint } : {}),
    ...(timeoutMs ? { timeout: timeoutMs } : {}),
  });

const createCosyVoiceProbeService = (
  endpoint?: string,
  timeoutMs?: number
): CosyVoiceProbeService =>
  new CosyVoiceService({
    ...(endpoint ? { baseUrl: endpoint } : {}),
    ...(timeoutMs ? { timeout: timeoutMs } : {}),
  });

const createVoxProbeService = (
  endpoint?: string,
  timeoutMs?: number
): VoxProbeService =>
  new VoxCPMService({
    ...(endpoint ? { baseUrl: endpoint } : {}),
    ...(timeoutMs ? { timeout: timeoutMs } : {}),
  });

export const probeTtsProviderRuntime = async ({
  provider,
  endpoint,
  timeoutMs = 15000,
  deps = {},
}: ProbeOptions): Promise<TtsRuntimeProbeResult> => {
  const startedAt = Date.now();
  const policy = getAudioRuntimePolicy(provider);

  try {
    if (provider === "indextts") {
      const service = deps.indextts || createIndexTtsProbeService(endpoint, timeoutMs);
      const referenceAudios = await service.getReferenceAudios();
      const referenceAudio = referenceAudios[0]?.filename;

      if (!referenceAudio) {
        return buildProbeResult({
          provider,
          healthy: false,
          message: "缺少可用参考音频",
          startedAt,
        });
      }

      await service.synthesizeAndWait(
        {
          text: policy.synthProbe.text,
          referenceAudio,
          emoControlMethod: "Same as the voice reference",
        },
        {
          timeout: timeoutMs,
          interval: 500,
        }
      );
    } else if (provider === "cosyvoice") {
      const service = deps.cosyvoice || createCosyVoiceProbeService(endpoint, timeoutMs);
      const referenceAudios = await service.getReferenceAudios();
      const referenceAudio = referenceAudios[0]?.filename;

      if (!referenceAudio) {
        return buildProbeResult({
          provider,
          healthy: false,
          message: "缺少可用参考音频",
          startedAt,
        });
      }

      await service.synthesize({
        text: policy.synthProbe.text,
        referenceAudio,
        mode: policy.synthProbe.preferredMode as CosyVoiceMode | undefined,
      });
    } else {
      const service = deps.voxcpm || createVoxProbeService(endpoint, timeoutMs);
      await service.synthesize({
        text: policy.synthProbe.text,
      });
    }

    return buildProbeResult({
      provider,
      healthy: true,
      message: "真实合成可用",
      startedAt,
    });
  } catch (error) {
    return buildProbeResult({
      provider,
      healthy: false,
      message: error instanceof Error ? error.message : "真实合成探针失败",
      startedAt,
    });
  }
};
