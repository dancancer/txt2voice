// 一旦我被更新，请更新我的开头注释
// input: Prisma/环境变量/表单载荷
// output: LLM 模型配置 CRUD 与运行时解析
// pos: 配置中心服务
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  getDefaultLLMModel,
  getLLMModelById,
  getLLMModelRegistrySnapshot,
  type LLMModelRegistrySnapshot,
} from "@/lib/llm-model-registry";

export interface LLMResolvedProvider {
  name: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface LLMSettingsModelView {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  model: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LLMSelectableModelView {
  id: string;
  label: string;
  provider: string;
  baseURL?: string;
  model: string;
}

export const llmModelConfigSchema = z.object({
  name: z.string().trim().min(1, "模型名称不能为空"),
  provider: z.string().trim().min(1).default("custom"),
  baseURL: z.string().trim().url("Base URL 格式不正确"),
  model: z.string().trim().min(1, "模型标识不能为空"),
  apiKey: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const llmModelConfigUpdateSchema = llmModelConfigSchema.partial();

export type LLMModelConfigInput = z.infer<typeof llmModelConfigSchema>;
export type LLMModelConfigUpdateInput = z.infer<
  typeof llmModelConfigUpdateSchema
>;

const ORDER_BY = [{ isDefault: "desc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }];

const normalizeApiKey = (apiKey?: string | null): string | null => {
  if (typeof apiKey !== "string") {
    return null;
  }

  const trimmed = apiKey.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isPrivateHostname = (hostname: string): boolean => {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) {
    return true;
  }

  const match = hostname.match(/^172\.(\d+)\./);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
};

const isLocalBaseURL = (baseURL?: string | null): boolean => {
  if (typeof baseURL !== "string" || baseURL.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(baseURL);
    return isPrivateHostname(parsed.hostname.trim().toLowerCase());
  } catch {
    return false;
  }
};

const assertApiKeyPolicy = (params: {
  baseURL?: string | null;
  apiKey?: string | null;
}) => {
  if (normalizeApiKey(params.apiKey)) {
    return;
  }

  if (isLocalBaseURL(params.baseURL)) {
    return;
  }

  throw new ValidationError("当前模型缺少 API Key，且不是本地免鉴权模型");
};

const toSettingsView = (
  model: Awaited<ReturnType<typeof prisma.llmModelConfig.findMany>>[number]
): LLMSettingsModelView => ({
  id: model.id,
  name: model.name,
  provider: model.provider,
  baseURL: model.baseURL,
  model: model.model,
  isDefault: model.isDefault,
  isActive: model.isActive,
  sortOrder: model.sortOrder,
  hasApiKey: Boolean(model.apiKey),
  createdAt: model.createdAt.toISOString(),
  updatedAt: model.updatedAt.toISOString(),
});

const toSelectableView = (
  model: Awaited<ReturnType<typeof prisma.llmModelConfig.findMany>>[number]
): LLMSelectableModelView => ({
  id: model.id,
  label: model.name,
  provider: model.provider,
  baseURL: model.baseURL,
  model: model.model,
});

const toEnvSelectableView = (
  model: ReturnType<typeof getDefaultLLMModel> & { id: string; label: string }
): LLMSelectableModelView => ({
  id: model.id,
  label: model.label,
  provider: model.provider,
  baseURL: model.baseURL,
  model: model.model,
});

const toEnvResolvedProvider = (
  model: ReturnType<typeof getDefaultLLMModel>
): LLMResolvedProvider => ({
  name: model.provider,
  apiKey: model.apiKey,
  ...(model.baseURL ? { baseURL: model.baseURL } : {}),
  model: model.model,
});

const readOptionalRegistry = (): LLMModelRegistrySnapshot | null => {
  try {
    return getLLMModelRegistrySnapshot();
  } catch (error) {
    if (error instanceof Error && error.message === "LLM_MODELS_JSON 未设置") {
      return null;
    }

    throw error;
  }
};

const pickDefaultModel = async () => {
  const models = await prisma.llmModelConfig.findMany({
    where: { isActive: true },
    orderBy: ORDER_BY,
  });

  if (models.length === 0) {
    return null;
  }

  return models.find((model) => model.isDefault) || models[0];
};

export async function listPersistedLLMModelConfigs(): Promise<
  LLMSettingsModelView[]
> {
  const models = await prisma.llmModelConfig.findMany({
    orderBy: ORDER_BY,
  });

  return models.map(toSettingsView);
}

export async function listSelectableLLMModels(): Promise<{
  defaultModelId: string;
  models: LLMSelectableModelView[];
  source: "database" | "registry" | "none";
}> {
  const models = await prisma.llmModelConfig.findMany({
    where: { isActive: true },
    orderBy: ORDER_BY,
  });

  if (models.length > 0) {
    const defaultModel = models.find((model) => model.isDefault) || models[0];

    return {
      defaultModelId: defaultModel.id,
      models: models.map(toSelectableView),
      source: "database",
    };
  }

  const registry = readOptionalRegistry();
  if (!registry) {
    return {
      defaultModelId: "",
      models: [],
      source: "none",
    };
  }

  return {
    defaultModelId: registry.defaultModelId,
    models: registry.models.map((model) =>
      toEnvSelectableView({
        ...model,
        label: model.label,
      })
    ),
    source: "registry",
  };
}

export async function resolveConfiguredLLMProvider(
  modelId?: string
): Promise<LLMResolvedProvider> {
  const models = await prisma.llmModelConfig.findMany({
    where: { isActive: true },
    orderBy: ORDER_BY,
  });

  if (models.length > 0) {
    const selectedModel = modelId
      ? models.find((model) => model.id === modelId)
      : models.find((model) => model.isDefault) || models[0];

    if (!selectedModel) {
      throw new Error(`找不到已配置的 LLM 模型: ${modelId}`);
    }

    assertApiKeyPolicy({
      baseURL: selectedModel.baseURL,
      apiKey: selectedModel.apiKey,
    });

    return {
      name: selectedModel.provider,
      apiKey: selectedModel.apiKey || "",
      baseURL: selectedModel.baseURL,
      model: selectedModel.model,
    };
  }

  const fallbackModel = modelId
    ? getLLMModelById(modelId)
    : getDefaultLLMModel();
  assertApiKeyPolicy({
    baseURL: fallbackModel.baseURL,
    apiKey: fallbackModel.apiKey,
  });
  return toEnvResolvedProvider(fallbackModel);
}

export async function createLLMModelConfig(
  payload: LLMModelConfigInput
): Promise<LLMSettingsModelView> {
  return prisma.$transaction(async (tx) => {
    const normalizedApiKey = normalizeApiKey(payload.apiKey);
    assertApiKeyPolicy({
      baseURL: payload.baseURL,
      apiKey: normalizedApiKey,
    });

    const existingDefault = await tx.llmModelConfig.findFirst({
      where: { isDefault: true },
    });
    const shouldBeDefault = payload.isDefault || !existingDefault;

    if (shouldBeDefault) {
      await tx.llmModelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.llmModelConfig.create({
      data: {
        name: payload.name,
        provider: payload.provider,
        baseURL: payload.baseURL,
        model: payload.model,
        apiKey: normalizedApiKey,
        isDefault: shouldBeDefault,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
      },
    });

    return toSettingsView(created);
  });
}

export async function updateLLMModelConfig(
  id: string,
  payload: LLMModelConfigUpdateInput
): Promise<LLMSettingsModelView> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.llmModelConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("LLM 模型配置不存在");
    }

    const nextBaseURL = payload.baseURL ?? existing.baseURL;
    const nextApiKey =
      payload.apiKey !== undefined
        ? normalizeApiKey(payload.apiKey)
        : existing.apiKey;

    assertApiKeyPolicy({
      baseURL: nextBaseURL,
      apiKey: nextApiKey,
    });

    const nextIsActive = payload.isActive ?? existing.isActive;
    const makeDefault = payload.isDefault === true;
    const clearDefault = existing.isDefault && nextIsActive === false;

    if (makeDefault) {
      await tx.llmModelConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.llmModelConfig.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.provider !== undefined ? { provider: payload.provider } : {}),
        ...(payload.baseURL !== undefined ? { baseURL: payload.baseURL } : {}),
        ...(payload.model !== undefined ? { model: payload.model } : {}),
        ...(payload.apiKey !== undefined ? { apiKey: nextApiKey } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
        ...(makeDefault ? { isDefault: true } : {}),
        ...(clearDefault ? { isDefault: false } : {}),
      },
    });

    if (clearDefault) {
      const fallback = await tx.llmModelConfig.findFirst({
        where: { id: { not: id }, isActive: true },
        orderBy: ORDER_BY,
      });

      if (fallback) {
        await tx.llmModelConfig.update({
          where: { id: fallback.id },
          data: { isDefault: true },
        });
      }
    }

    return toSettingsView(updated);
  });
}

export async function deleteLLMModelConfig(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.llmModelConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("LLM 模型配置不存在");
    }

    await tx.llmModelConfig.delete({
      where: { id },
    });

    if (!existing.isDefault) {
      return;
    }

    const fallback = await tx.llmModelConfig.findFirst({
      where: { isActive: true },
      orderBy: ORDER_BY,
    });

    if (fallback) {
      await tx.llmModelConfig.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      });
    }
  });
}

export async function ensureDefaultLLMModelConfig(
  id: string
): Promise<LLMSettingsModelView> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.llmModelConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("LLM 模型配置不存在");
    }

    await tx.llmModelConfig.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });

    const updated = await tx.llmModelConfig.update({
      where: { id },
      data: { isDefault: true, isActive: true },
    });

    return toSettingsView(updated);
  });
}
