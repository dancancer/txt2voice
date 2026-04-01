import {
  isMastraShadowModeEnabled,
  resolveStageExecutor,
} from "../runtime/executor-policy";

describe("executor policy", () => {
  it("defaults to native when executor env is unset", () => {
    expect(resolveStageExecutor({ stageId: "character_discovery", env: {} })).toBe(
      "native"
    );
  });

  it("returns mastra only when executor env is mastra and stage is allowlisted", () => {
    const env = {
      AGENT_RUNTIME_EXECUTOR: "mastra",
      AGENT_RUNTIME_MASTRA_STAGES:
        "character_discovery, segment_scripting , quality_judgement",
    };

    expect(resolveStageExecutor({ stageId: "character_discovery", env })).toBe(
      "mastra"
    );
    expect(resolveStageExecutor({ stageId: "persist", env })).toBe("native");
  });

  it("keeps primary executor native when only shadow mode is enabled", () => {
    const env = {
      AGENT_RUNTIME_MASTRA_SHADOW_MODE: "true",
      AGENT_RUNTIME_MASTRA_STAGES: "character_discovery",
    };

    expect(resolveStageExecutor({ stageId: "character_discovery", env })).toBe(
      "native"
    );
    expect(isMastraShadowModeEnabled(env)).toBe(true);
  });
});
