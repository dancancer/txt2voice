import { runCharacterDiscoveryPass } from "../runtime/script-production/run-character-discovery-pass";

describe("character discovery pass", () => {
  it("在角色发现失败时返回人工审查失败详情，而不是静默跳过", async () => {
    const result = await runCharacterDiscoveryPass({
      workflowRunId: "wf-1",
      bookId: "book-1",
      segments: [
        {
          id: "seg-1",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: "宁采臣抬头。",
        },
      ],
      adapter: {} as any,
      runtimeStore: {
        updateStageRun: jest.fn(),
        createRuntimeArtifact: jest.fn(),
      } as any,
      characterProfiles: [],
      characterMap: new Map(),
      createId: (() => {
        let next = 0;
        return () => `runtime-${next++}`;
      })(),
      createStageRun: jest.fn(async () => undefined),
      updateStageRun: jest.fn(async () => undefined),
      createAgentRun: jest.fn(async () => undefined),
      updateAgentRun: jest.fn(async () => undefined),
      createToolCall: jest.fn(async () => undefined),
      updateToolCall: jest.fn(async () => undefined),
      appendTrace: jest.fn(async () => undefined),
      runCharacterDiscoveryStage: jest.fn().mockResolvedValue({
        stageRunId: "stage-discovery-1",
        status: "failed",
        error: "llm_unavailable",
      }),
      runPersistStage: jest.fn(),
    });

    expect(result).toEqual({
      persistedCharacterCount: 0,
      failure: expect.objectContaining({
        stage: "character_discovery",
        errorCode: "CHARACTER_DISCOVERY_FAILED",
        message: "llm_unavailable",
        retryable: false,
      }),
    });
  });
});
