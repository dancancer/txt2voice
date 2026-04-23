import type { LLMExecutionRequestOptions } from "@/lib/task-queue";

export type SupportedModelPolicy = "balanced" | "cheap-repair" | "quality";

export interface ResolvedLLMExecutionPolicy {
  policy: SupportedModelPolicy;
  modelId?: string;
  requestOptions: LLMExecutionRequestOptions;
}

const POLICY_MODEL_ENV_KEYS: Record<SupportedModelPolicy, string | null> = {
  balanced: "LLM_BALANCED_MODEL_ID",
  "cheap-repair": "LLM_CHEAP_REPAIR_MODEL_ID",
  quality: "LLM_QUALITY_MODEL_ID",
};

const POLICY_REQUEST_OPTIONS: Record<
  SupportedModelPolicy,
  LLMExecutionRequestOptions
> = {
  balanced: {
    temperature: 0.3,
    maxTokens: 8000,
  },
  "cheap-repair": {
    temperature: 0,
    maxTokens: 2000,
  },
  quality: {
    temperature: 0.1,
    maxTokens: 3000,
  },
};

const asPolicy = (value: string): SupportedModelPolicy => {
  if (value === "balanced" || value === "cheap-repair" || value === "quality") {
    return value;
  }

  throw new Error(`Unsupported modelPolicy: ${value}`);
};

const resolvePolicyModelId = (
  policy: SupportedModelPolicy,
  env: NodeJS.ProcessEnv
): string | undefined => {
  const envKey = POLICY_MODEL_ENV_KEYS[policy];
  const configured = envKey ? env[envKey]?.trim() : undefined;
  if (configured) {
    return configured;
  }

  return env.LLM_DEFAULT_MODEL_ID || undefined;
};

export const resolveLLMExecutionPolicy = (
  modelPolicy: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): ResolvedLLMExecutionPolicy => {
  if (!modelPolicy || modelPolicy.trim().length === 0) {
    throw new Error("modelPolicy is required for runtime stage execution");
  }

  const policy = asPolicy(modelPolicy.trim());

  return {
    policy,
    modelId: resolvePolicyModelId(policy, env),
    requestOptions: { ...POLICY_REQUEST_OPTIONS[policy] },
  };
};
