// 一旦我被更新，请更新我的开头注释
// input: 环境变量 / 模型注册表配置
// output: 可选 LLM 模型快照
// pos: LLM 配置解析层

export interface LLMModelRegistryItem {
  id: string;
  label: string;
  provider: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface LLMModelRegistrySnapshot {
  defaultModelId: string;
  models: LLMModelRegistryItem[];
  source: "registry" | "legacy";
}

type LLMModelRegistryEnv = NodeJS.ProcessEnv;

interface RawRegistryItem {
  id?: unknown;
  label?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  baseURL?: unknown;
  model?: unknown;
}

const LEGACY_MODEL_ID = "legacy-default";

const asString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toRegistryItem = (item: RawRegistryItem): LLMModelRegistryItem => {
  const id = asString(item.id);
  const label = asString(item.label);
  const provider = asString(item.provider);
  const apiKey = asString(item.apiKey);
  const baseURL = asString(item.baseURL);
  const model = asString(item.model);

  if (!id) {
    throw new Error("LLM模型配置缺少id");
  }
  if (!label) {
    throw new Error(`LLM模型 ${id} 缺少label`);
  }
  if (!provider) {
    throw new Error(`LLM模型 ${id} 缺少provider`);
  }
  if (!model) {
    throw new Error(`LLM模型 ${id} 缺少model`);
  }

  return {
    id,
    label,
    provider,
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    model,
  };
};

const parseRegistryJson = (rawJson: string): LLMModelRegistryItem[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知JSON解析错误";
    throw new Error(`LLM_MODELS_JSON 配置无效: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM_MODELS_JSON 必须是数组");
  }

  return parsed.map((entry) => toRegistryItem(entry as RawRegistryItem));
};

const ensureUniqueIds = (models: LLMModelRegistryItem[]): void => {
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.id)) {
      throw new Error(`LLM模型配置存在重复id: ${model.id}`);
    }
    seen.add(model.id);
  }
};

const resolveRegistryDefault = (
  models: LLMModelRegistryItem[],
  defaultModelId: string | undefined
): string => {
  if (!defaultModelId) {
    throw new Error("LLM_DEFAULT_MODEL_ID 未设置");
  }

  if (!models.some((model) => model.id === defaultModelId)) {
    throw new Error(`默认LLM模型不存在: ${defaultModelId}`);
  }

  return defaultModelId;
};

const buildLegacySnapshot = (
  env: LLMModelRegistryEnv
): LLMModelRegistrySnapshot => {
  const legacyModel: LLMModelRegistryItem = {
    id: LEGACY_MODEL_ID,
    label: "Legacy Default",
    provider: asString(env.LLM_PROVIDER) || "custom",
    apiKey: asString(env.LLM_API_KEY) || asString(env.OPENAI_API_KEY),
    ...(asString(env.LLM_BASE_URL) || asString(env.OPENAI_BASE_URL)
      ? {
          baseURL: asString(env.LLM_BASE_URL) || asString(env.OPENAI_BASE_URL),
        }
      : {}),
    model: asString(env.LLM_MODEL) || "gpt-3.5-turbo",
  };

  return {
    defaultModelId: LEGACY_MODEL_ID,
    models: [legacyModel],
    source: "legacy",
  };
};

const getModelFromRegistry = (
  registry: LLMModelRegistrySnapshot,
  modelId: string
): LLMModelRegistryItem => {
  const model = registry.models.find((entry) => entry.id === modelId);
  if (!model) {
    throw new Error(`找不到LLM模型: ${modelId}`);
  }

  return model;
};

export function getLLMModelRegistrySnapshot(
  env: LLMModelRegistryEnv = process.env
): LLMModelRegistrySnapshot {
  const rawModelsJson = asString(env.LLM_MODELS_JSON);

  if (!rawModelsJson) {
    return buildLegacySnapshot(env);
  }

  const models = parseRegistryJson(rawModelsJson);
  ensureUniqueIds(models);

  return {
    defaultModelId: resolveRegistryDefault(
      models,
      asString(env.LLM_DEFAULT_MODEL_ID) || undefined
    ),
    models,
    source: "registry",
  };
}

export function getLLMModelById(
  modelId: string,
  env: LLMModelRegistryEnv = process.env
): LLMModelRegistryItem {
  return getModelFromRegistry(getLLMModelRegistrySnapshot(env), modelId);
}

export function getDefaultLLMModel(
  env: LLMModelRegistryEnv = process.env
): LLMModelRegistryItem {
  const registry = getLLMModelRegistrySnapshot(env);
  return getModelFromRegistry(registry, registry.defaultModelId);
}
