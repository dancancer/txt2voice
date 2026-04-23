import OpenAI from "openai";

import { TTSError } from "@/lib/error-handler";
import type {
  LLMExecutionJobResult,
  LLMExecutionRequestOptions,
} from "@/lib/task-queue";
import type { LLMProvider } from "@/lib/llm/provider";

export interface ExecuteProviderLLMCallInput {
  provider: LLMProvider;
  prompt: string;
  systemPrompt?: string;
  requestOptions?: LLMExecutionRequestOptions;
}

const DEFAULT_REQUEST_OPTIONS: Required<
  Pick<LLMExecutionRequestOptions, "temperature" | "maxTokens">
> = {
  temperature: 0.3,
  maxTokens: 8000,
};

const buildOpenAIConfig = (provider: LLMProvider) => {
  const openaiConfig: Record<string, unknown> = {
    apiKey: provider.apiKey,
  };

  if (provider.baseURL && provider.baseURL !== "https://api.openai.com/v1") {
    openaiConfig.baseURL = provider.baseURL.includes("deepseek.com")
      ? "https://api.deepseek.com/v1"
      : provider.baseURL;
  }

  return openaiConfig;
};

const normalizeUsage = (
  usage: unknown
): Record<string, unknown> | null => {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return null;
  }

  return JSON.parse(JSON.stringify(usage)) as Record<string, unknown>;
};

const toRetryableServiceError = (
  error: unknown,
  providerName: string
): never => {
  console.error("OpenAI SDK错误:", error);

  if (error instanceof OpenAI.RateLimitError) {
    throw new TTSError(
      "LLM API调用频率超限，请稍后重试",
      "TTS_SERVICE_DOWN",
      providerName,
      true
    );
  }

  if (error instanceof OpenAI.AuthenticationError) {
    throw new TTSError(
      "LLM API认证失败，请检查API密钥",
      "TTS_SERVICE_DOWN",
      providerName
    );
  }

  if (error instanceof OpenAI.APIError) {
    throw new TTSError(
      `LLM API调用失败: ${error.message}`,
      "TTS_SERVICE_DOWN",
      providerName,
      typeof (error as { status?: number }).status === "number" &&
        (error as { status?: number }).status! >= 500
    );
  }

  throw new TTSError(
    "LLM服务连接失败",
    "TTS_SERVICE_DOWN",
    providerName,
    true
  );
};

export async function executeProviderLLMCall(
  input: ExecuteProviderLLMCallInput
): Promise<LLMExecutionJobResult> {
  const { provider, prompt, systemPrompt, requestOptions = {} } = input;
  const client = new OpenAI(buildOpenAIConfig(provider));
  const startedAt = Date.now();
  const messages = [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    { role: "user" as const, content: prompt },
  ];

  try {
    const response = await client.chat.completions.create({
      model: provider.model,
      messages,
      temperature:
        typeof requestOptions.temperature === "number"
          ? requestOptions.temperature
          : DEFAULT_REQUEST_OPTIONS.temperature,
      max_tokens:
        typeof requestOptions.maxTokens === "number"
          ? requestOptions.maxTokens
          : DEFAULT_REQUEST_OPTIONS.maxTokens,
      ...(provider.name === "custom" && { stream: false }),
    });

    return {
      content: response.choices[0]?.message?.content || "",
      model: response.model || provider.model,
      provider: provider.name,
      latencyMs: Date.now() - startedAt,
      attempt: 1,
      usage: normalizeUsage(response.usage),
    };
  } catch (error) {
    return toRetryableServiceError(error, provider.name);
  }
}
