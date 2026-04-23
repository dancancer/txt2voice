jest.mock("@/lib/agent-runtime/mastra/compiler/compile-agent", () => ({
  compileAgent: jest.fn((rootDir: string, agentId: string) => ({
    definition: {
      id: `${agentId}-agent`,
    },
    agent: {
      id: `${agentId}-agent`,
      rootDir,
    },
  })),
}));

jest.mock("@/lib/agent-runtime/mastra/compiler/compile-workflow", () => ({
  compileWorkflow: jest.fn(() => ({
    definition: {
      id: "script-production",
    },
    workflow: {
      id: "script-production",
    },
  })),
}));

jest.mock("@/lib/agent-runtime/mastra/runtime", () => ({
  createMastraRuntime: jest.fn((config) => ({
    mastra: {
      config,
    },
    modelProvider: "test-model-provider",
    provider: "test-runtime-provider",
  })),
}));

describe("mastra entry", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("registers the coordinator agent in the exported mastra runtime", async () => {
    const entry = await import("@/mastra/index");

    expect(entry.compiledAgents).toHaveProperty("coordinatorAgent");
    expect(entry.compiledAgents.coordinatorAgent.definition.id).toBe(
      "coordinator-agent"
    );
    expect(
      (
        entry.mastra as unknown as {
          config: { agents: Record<string, unknown> };
        }
      ).config.agents
    ).toEqual(
      expect.objectContaining({
        "character-discovery-agent": expect.any(Object),
        "script-generation-agent": expect.any(Object),
        "repair-agent": expect.any(Object),
        "quality-judge-agent": expect.any(Object),
        "coordinator-agent": expect.any(Object),
      })
    );
  });
});
