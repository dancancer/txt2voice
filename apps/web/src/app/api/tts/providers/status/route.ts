import { NextRequest, NextResponse } from "next/server";
import { CosyVoiceService } from "@/lib/cosyvoice-service";
import { withErrorHandler } from "@/lib/error-handler";
import { IndexTTSService } from "@/lib/indextts-service";
import { probeTtsProviderRuntime } from "@/lib/tts-runtime-probe";
import { VoxCPMService } from "@/lib/voxcpm-service";

type ProviderKey = "indextts" | "cosyvoice" | "voxcpm";

type ProviderStatus = {
  provider: ProviderKey;
  name: string;
  endpoint: string;
  healthy: boolean;
  message: string;
  configuredFromEnv: boolean;
  supportsSpeakerManagement: boolean;
  defaultMode?: string;
  probeHealthy?: boolean;
  probeMessage?: string;
  probeLatencyMs?: number;
  probeCheckedAt?: string;
};

const PROVIDER_CONFIG: Record<
  ProviderKey,
  {
    name: string;
    endpointEnv?: string;
    fallbackEndpoint: string;
    supportsSpeakerManagement: boolean;
  }
> = {
  indextts: {
    name: "IndexTTS",
    endpointEnv: process.env.INDEXTTS_API_URL,
    fallbackEndpoint: "http://192.168.88.9:8001",
    supportsSpeakerManagement: true,
  },
  cosyvoice: {
    name: "CosyVoice",
    endpointEnv: process.env.COSYVOICE_API_URL,
    fallbackEndpoint: "http://192.168.88.9:8011",
    supportsSpeakerManagement: false,
  },
  voxcpm: {
    name: "VoxCPM",
    endpointEnv: process.env.VOXCPM_API_URL,
    fallbackEndpoint: "http://192.168.88.9:8012",
    supportsSpeakerManagement: false,
  },
};

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const RUNTIME_PROBE_TIMEOUT_MS = 15000;

const readErrorMessage = (error: unknown): string => {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";
  if (raw.length <= 120) {
    return raw;
  }
  return `${raw.slice(0, 117)}...`;
};

const checkProviderHealth = async (
  provider: ProviderKey,
  endpoint: string
): Promise<{ healthy: boolean; message: string }> => {
  try {
    if (provider === "indextts") {
      const service = new IndexTTSService({
        baseUrl: endpoint,
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      await service.healthCheck();
    } else if (provider === "cosyvoice") {
      const service = new CosyVoiceService({
        baseUrl: endpoint,
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      await service.healthCheck();
    } else {
      const service = new VoxCPMService({
        baseUrl: endpoint,
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      await service.healthCheck();
    }

    return {
      healthy: true,
      message: "服务可用",
    };
  } catch (error) {
    return {
      healthy: false,
      message: readErrorMessage(error),
    };
  }
};

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const probeRequested = searchParams.get("probe") === "true";

  const statuses = await Promise.all(
    (Object.keys(PROVIDER_CONFIG) as ProviderKey[]).map(async (provider) => {
      const config = PROVIDER_CONFIG[provider];
      const endpoint = config.endpointEnv || config.fallbackEndpoint;
      const configuredFromEnv = Boolean(config.endpointEnv);
      const health = await checkProviderHealth(provider, endpoint);

      const status: ProviderStatus = {
        provider,
        name: config.name,
        endpoint,
        healthy: health.healthy,
        message: health.message,
        configuredFromEnv,
        supportsSpeakerManagement: config.supportsSpeakerManagement,
      };

      if (provider === "cosyvoice") {
        status.defaultMode = process.env.COSYVOICE_DEFAULT_MODE || "cross_lingual";
      }

      if (probeRequested) {
        const probe = await probeTtsProviderRuntime({
          provider,
          endpoint,
          timeoutMs: RUNTIME_PROBE_TIMEOUT_MS,
        });
        status.probeHealthy = probe.healthy;
        status.probeMessage = probe.message;
        status.probeLatencyMs = probe.latencyMs;
        status.probeCheckedAt = probe.checkedAt;
      }

      return status;
    })
  );

  return NextResponse.json({
    success: true,
    data: {
      providers: statuses,
    },
  });
});
