import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
type ProviderKey = "voxcpm";

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
  voxcpm: {
    name: "VoxCPM2",
    endpointEnv: process.env.VOXCPM_API_URL,
    fallbackEndpoint: "http://192.168.88.9:18083",
    supportsSpeakerManagement: false,
  },
};

const HEALTH_CHECK_TIMEOUT_MS = 5000;

const createTimeoutSignal = (
  timeout: number
): { signal: AbortSignal; clear: () => void } => {
  if (typeof AbortSignal.timeout === "function") {
    return {
      signal: AbortSignal.timeout(timeout),
      clear: () => undefined,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
};

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
  const timeoutSignal = createTimeoutSignal(HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/health`, {
      signal: timeoutSignal.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
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
  } finally {
    timeoutSignal.clear();
  }
};

export const GET = withErrorHandler(async (request: NextRequest) => {
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
