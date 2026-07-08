import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";

type RuntimeEnv = Record<string, string | undefined>;
type MastraRuntimeInstance = InstanceType<typeof import("@mastra/core").Mastra>;

export type MastraRuntimeProvider = "openai";

export class MastraRuntimeBootstrapError extends Error {
  code: "MISSING_OPENAI_API_KEY";

  details: {
    provider: MastraRuntimeProvider;
    envVar: "OPENAI_API_KEY";
  };

  constructor() {
    super("Missing OPENAI_API_KEY for Mastra runtime bootstrap");
    this.name = "MastraRuntimeBootstrapError";
    this.code = "MISSING_OPENAI_API_KEY";
    this.details = {
      provider: "openai",
      envVar: "OPENAI_API_KEY",
    };
  }
}

export interface CreateMastraRuntimeParams {
  env?: RuntimeEnv;
  agents?: Record<string, any>;
  workflows?: Record<string, any>;
  server?: Record<string, any> | null;
}

export interface MastraRuntimeBootstrapResult {
  mastra: MastraRuntimeInstance;
  modelProvider: ReturnType<typeof import("@ai-sdk/openai").createOpenAI>;
  provider: MastraRuntimeProvider;
}

const resolveOpenAIApiKey = (env: RuntimeEnv): string => {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new MastraRuntimeBootstrapError();
  }

  return apiKey;
};

export const createMastraRuntime = (
  params: CreateMastraRuntimeParams = {}
): MastraRuntimeBootstrapResult => {
  const env = params.env || process.env;
  const apiKey = resolveOpenAIApiKey(env);
  ensureMastraWebGlobals();
  const { Mastra } = require("@mastra/core") as typeof import("@mastra/core");
  const { createOpenAI } =
    require("@ai-sdk/openai") as typeof import("@ai-sdk/openai");

  return {
    mastra: new Mastra({
      agents: params.agents ?? {},
      workflows: params.workflows ?? {},
      ...(params.server ? { server: params.server } : {}),
    }),
    modelProvider: createOpenAI({
      apiKey,
    }),
    provider: "openai",
  };
};
