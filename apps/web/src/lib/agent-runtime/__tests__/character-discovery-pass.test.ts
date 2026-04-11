import {
  buildCharacterDiscoverySampleText,
  runCharacterDiscoveryPass,
} from "../runtime/script-production/run-character-discovery-pass";

describe("character discovery pass", () => {
  it("keeps middle-of-segment evidence in discovery samples for long segments", () => {
    const sample = buildCharacterDiscoverySampleText([
      {
        id: "seg-1",
        chapterId: "chapter-1",
        orderIndex: 0,
        content: `开头${"甲".repeat(220)}宁采臣与燕赤霞在中段相遇${"乙".repeat(220)}结尾`,
      },
    ]);

    expect(sample).toContain("宁采臣与燕赤霞在中段相遇");
  });

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

  it("在角色发现返回 completed 但草稿为空时按 no-op 成功返回", async () => {
    const runtimeStore = {
      updateStageRun: jest.fn(),
      createRuntimeArtifact: jest.fn(),
    };
    const result = await runCharacterDiscoveryPass({
      workflowRunId: "wf-empty-draft",
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
      runtimeStore: runtimeStore as any,
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
        stageRunId: "stage-discovery-empty",
        status: "completed",
        artifact: {
          kind: "character-memory-draft",
          skillId: "character-extraction",
          characterMemoryDraft: {
            canonicalIdentities: [],
            aliasEvidence: [],
            assertedFacts: {},
            inferredHints: {},
          },
        },
      }),
      runPersistStage: jest.fn(),
    });

    expect(result).toEqual({
      persistedCharacterCount: 0,
    });
    expect(runtimeStore.updateStageRun).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: "character_discovery",
        status: "completed",
        summary: expect.objectContaining({
          artifactKind: "character-memory-draft",
        }),
      })
    );
    expect(runtimeStore.createRuntimeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactKind: "character-memory-draft",
      })
    );
  });

});
