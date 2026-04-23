import { TTSError } from "@/lib/error-handler";
import {
  getDefaultLLMModel,
  getLLMModelById,
} from "@/lib/llm-model-registry";

export interface LLMProvider {
  name: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

const LOCAL_API_KEY_PLACEHOLDER = "local-placeholder-key";

const toProviderSnapshot = (
  model: ReturnType<typeof getDefaultLLMModel>
): LLMProvider => ({
  name: model.provider,
  apiKey: model.apiKey,
  ...(model.baseURL ? { baseURL: model.baseURL } : {}),
  model: model.model,
});

const isLocalBaseURL = (baseURL?: string): boolean => {
  if (!baseURL) {
    return false;
  }

  try {
    const hostname = new URL(baseURL).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
};

const normalizeConfiguredProvider = (provider: LLMProvider): LLMProvider => {
  if (provider.apiKey) {
    return provider;
  }

  if (isLocalBaseURL(provider.baseURL)) {
    return {
      ...provider,
      apiKey: LOCAL_API_KEY_PLACEHOLDER,
    };
  }

  throw new TTSError(
    "LLM服务未配置，请设置API密钥",
    "TTS_SERVICE_DOWN",
    provider.name
  );
};

export function getLLMProviderSnapshot(
  modelId?: string,
  env: NodeJS.ProcessEnv = process.env
): LLMProvider {
  const model = modelId
    ? getLLMModelById(modelId, env)
    : getDefaultLLMModel(env);

  return toProviderSnapshot(model);
}

export function getConfiguredLLMProvider(
  modelId?: string,
  env: NodeJS.ProcessEnv = process.env
): LLMProvider {
  return normalizeConfiguredProvider(getLLMProviderSnapshot(modelId, env));
}

export async function resolveConfiguredLLMProvider(
  modelId?: string
): Promise<LLMProvider> {
  const { resolveConfiguredLLMProvider: resolveConfiguredLLMProviderFromStore } =
    await import("@/lib/llm-model-config-service");
  const provider = await resolveConfiguredLLMProviderFromStore(modelId);
  return normalizeConfiguredProvider(provider);
}
