import { createRequire } from "module";

import {
  getConfiguredLLMProvider,
  type LLMProvider,
} from "@/lib/llm/provider";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";

type RuntimeEnv = Record<string, string | undefined>;
type MastraRuntimeInstance = InstanceType<typeof import("@mastra/core").Mastra>;
type JsonMap = Record<string, unknown>;
type MastraRuntimeAgentMap = Record<string, unknown>;
type MastraRuntimeWorkflowMap = Record<string, unknown>;
const requireModule = createRequire(import.meta.url);

export type MastraRuntimeProvider = string;

export class MastraRuntimeBootstrapError extends Error {
  code: "INVALID_LLM_PROVIDER_CONFIG";

  details: {
    reason: string;
  };

  constructor(reason: string) {
    super(`Invalid LLM provider config for Mastra runtime bootstrap: ${reason}`);
    this.name = "MastraRuntimeBootstrapError";
    this.code = "INVALID_LLM_PROVIDER_CONFIG";
    this.details = {
      reason,
    };
  }
}

export interface CreateMastraRuntimeParams {
  env?: RuntimeEnv;
  agents?: MastraRuntimeAgentMap;
  workflows?: MastraRuntimeWorkflowMap;
  server?: JsonMap;
}

export interface MastraRuntimeBootstrapResult {
  mastra: MastraRuntimeInstance;
  modelProvider: LLMProvider;
  provider: MastraRuntimeProvider;
}

const resolveRuntimeProvider = (env: RuntimeEnv): LLMProvider => {
  try {
    return getConfiguredLLMProvider(undefined, env as NodeJS.ProcessEnv);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_reason";
    throw new MastraRuntimeBootstrapError(reason);
  }
};

export const createMastraRuntime = (
  params: CreateMastraRuntimeParams = {}
): MastraRuntimeBootstrapResult => {
  const env = params.env || process.env;
  const modelProvider = resolveRuntimeProvider(env);
  ensureMastraWebGlobals();
  const { Mastra } = requireModule("@mastra/core") as typeof import("@mastra/core");

  return {
    mastra: new Mastra({
      agents: (params.agents || {}) as any,
      workflows: (params.workflows || {}) as any,
      ...(params.server ? { server: params.server } : {}),
    }),
    modelProvider,
    provider: modelProvider.name,
  };
};
