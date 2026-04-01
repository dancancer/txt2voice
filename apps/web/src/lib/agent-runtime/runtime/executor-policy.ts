export type StageExecutor = "native" | "mastra";

type RuntimeEnv = Record<string, string | undefined>;

const parseStageAllowlist = (value: string | undefined): Set<string> =>
  new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );

const parseBooleanFlag = (value: string | undefined): boolean =>
  value === "1" || value === "true";

const getExecutorMode = (env: RuntimeEnv): StageExecutor =>
  env.AGENT_RUNTIME_EXECUTOR === "mastra" ? "mastra" : "native";

export const resolveStageExecutor = (params: {
  stageId: string;
  env?: RuntimeEnv;
}): StageExecutor => {
  const env = params.env || process.env;
  if (getExecutorMode(env) !== "mastra") {
    return "native";
  }

  return parseStageAllowlist(env.AGENT_RUNTIME_MASTRA_STAGES).has(params.stageId)
    ? "mastra"
    : "native";
};

export const isMastraShadowModeEnabled = (env: RuntimeEnv = process.env) =>
  parseBooleanFlag(env.AGENT_RUNTIME_MASTRA_SHADOW_MODE);
