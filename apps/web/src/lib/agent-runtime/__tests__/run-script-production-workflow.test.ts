jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    book: {
      findUnique: jest.fn(),
    },
    manualReviewItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workflowRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    stageRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    agentRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    toolCall: {
      create: jest.fn(),
      update: jest.fn(),
    },
    runtimeArtifact: {
      create: jest.fn(),
    },
    traceEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/agent-runtime/runtime/stages/run-segment-scripting-stage", () => ({
  runSegmentScriptingStage: jest.fn(),
}));

jest.mock("@/lib/agent-runtime/runtime/stages/run-character-discovery-stage", () => ({
  runCharacterDiscoveryStage: jest.fn(),
}));

jest.mock("@/lib/agent-runtime/runtime/stages/run-segment-repair-stage", () => ({
  runSegmentRepairStage: jest.fn(),
}));

jest.mock("@/lib/agent-runtime/runtime/stages/run-quality-stage", () => ({
  runQualityStage: jest.fn(),
}));

jest.mock("@/lib/agent-runtime/runtime/stages/run-persist-stage", () => ({
  runPersistStage: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { runScriptProductionWorkflow } from "../runtime/run-script-production-workflow";
import { runCharacterDiscoveryStage } from "../runtime/stages/run-character-discovery-stage";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";
import { runSegmentRepairStage } from "../runtime/stages/run-segment-repair-stage";
import { runQualityStage } from "../runtime/stages/run-quality-stage";
import { runPersistStage } from "../runtime/stages/run-persist-stage";

const mockPrisma = prisma as any;
const mockRunCharacterDiscoveryStage =
  runCharacterDiscoveryStage as jest.MockedFunction<
    typeof runCharacterDiscoveryStage
  >;
const mockRunSegmentScriptingStage =
  runSegmentScriptingStage as jest.MockedFunction<typeof runSegmentScriptingStage>;
const mockRunSegmentRepairStage =
  runSegmentRepairStage as jest.MockedFunction<typeof runSegmentRepairStage>;
const mockRunQualityStage =
  runQualityStage as jest.MockedFunction<typeof runQualityStage>;
const mockRunPersistStage =
  runPersistStage as jest.MockedFunction<typeof runPersistStage>;

const createBookFixture = () => ({
  id: "book-1",
  textSegments: [
    {
      id: "seg-1",
      chapterId: "chapter-1",
      orderIndex: 0,
      content: "第一段原文。",
    },
    {
      id: "seg-2",
      chapterId: "chapter-1",
      orderIndex: 1,
      content: "第二段原文。",
    },
    {
      id: "seg-3",
      chapterId: "chapter-1",
      orderIndex: 2,
      content: "第三段原文。",
    },
  ],
  characterProfiles: [],
});

const createSkillMetadata = (
  partial?: Partial<{
    promptBundle: string[];
    promptFingerprint: string;
    modelPolicy: string;
    repairPolicy: string;
    successCriteria: string[];
    telemetryTags: string[];
  }>
) => ({
  promptBundle: ["prompts/system.md", "prompts/user.md"],
  promptFingerprint: "prompts/system.md|prompts/user.md",
  modelPolicy: "balanced",
  repairPolicy: "handoff-to-json-repair",
  successCriteria: ["returns-segment-script-draft"],
  telemetryTags: ["runtime", "segment-scripting"],
  ...partial,
});

const createDraftArtifact = (
  segmentId: string,
  sourceText: string,
  partial?: Partial<{
    text: string;
    speaker: string;
  }>
) => ({
  kind: "segment-script-draft" as const,
  skillId: "script-generation",
  skillMetadata: createSkillMetadata(),
  segmentScriptDraft: {
    segmentId,
    createdAt: "2026-03-24T00:00:00.000Z",
    lines: [
      {
        id: `${segmentId}-line-1`,
        sourceText,
        text: partial?.text ?? sourceText,
        speaker: partial?.speaker ?? "旁白",
        orderInSegment: 0,
      },
    ],
  },
});

const createCharacterMemoryDraftArtifact = () => ({
  kind: "character-memory-draft" as const,
  skillId: "character-extraction" as const,
  skillMetadata: createSkillMetadata({
    repairPolicy: "retry-on-json-parse",
    successCriteria: ["returns-memory-patch"],
    telemetryTags: ["runtime", "character-discovery"],
  }),
  characterMemoryDraft: {
    canonicalIdentities: [
      {
        id: "char-zhangsan",
        name: "张三",
      },
    ],
    aliasEvidence: [
      {
        alias: "三哥",
        canonicalId: "char-zhangsan",
        source: "segment-1",
      },
    ],
    assertedFacts: {
      "char-zhangsan": {
        role: "lead",
      },
    },
    inferredHints: {},
  },
});

const createEmptyCharacterMemoryDraftArtifact = () => ({
  kind: "character-memory-draft" as const,
  skillId: "character-extraction" as const,
  skillMetadata: createSkillMetadata({
    repairPolicy: "retry-on-json-parse",
    successCriteria: ["returns-memory-patch"],
    telemetryTags: ["runtime", "character-discovery"],
  }),
  characterMemoryDraft: {
    canonicalIdentities: [],
    aliasEvidence: [],
    assertedFacts: {},
    inferredHints: {},
  },
});

describe("runScriptProductionWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.book.findUnique.mockResolvedValue(createBookFixture());
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    mockPrisma.manualReviewItem.findFirst.mockResolvedValue(null);
    mockPrisma.manualReviewItem.create.mockResolvedValue({ id: "review-1" });
    mockPrisma.manualReviewItem.update.mockResolvedValue({});
    mockPrisma.manualReviewItem.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.workflowRun.create.mockResolvedValue({ id: "wf-runtime-1" });
    mockPrisma.workflowRun.update.mockResolvedValue({});
    mockPrisma.workflowRun.findUnique.mockResolvedValue(null);
    mockPrisma.stageRun.create.mockResolvedValue({});
    mockPrisma.stageRun.update.mockResolvedValue({});
    mockPrisma.agentRun.create.mockResolvedValue({});
    mockPrisma.agentRun.update.mockResolvedValue({});
    mockPrisma.toolCall.create.mockResolvedValue({});
    mockPrisma.toolCall.update.mockResolvedValue({});
    mockPrisma.runtimeArtifact.create.mockResolvedValue({});
    mockPrisma.traceEvent.create.mockResolvedValue({});
    mockRunCharacterDiscoveryStage.mockResolvedValue({
      stageRunId: "discovery-unused",
      status: "completed",
      artifact: createEmptyCharacterMemoryDraftArtifact(),
    } as any);
    mockRunSegmentRepairStage.mockResolvedValue({
      stageRunId: "repair-unused",
      status: "completed",
      decision: {
        segmentId: "unused",
        action: "manual_review",
        reason: "unused",
        retryable: false,
      },
    } as any);

  });

  it("runs full mode through explicit runtime stages instead of legacy generator", async () => {
    mockRunSegmentScriptingStage
      .mockResolvedValueOnce({
        stageRunId: "stage-seg-1",
        status: "completed",
        artifact: createDraftArtifact("seg-1", "第一段原文。"),
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "stage-seg-2",
        status: "completed",
        artifact: createDraftArtifact("seg-2", "第二段原文。"),
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "stage-seg-3",
        status: "completed",
        artifact: createDraftArtifact("seg-3", "第三段原文。"),
      } as any);

    mockRunQualityStage
      .mockResolvedValueOnce({
        stageRunId: "quality-seg-1",
        status: "completed",
        decision: "auto_pass",
        verdict: {
          segmentId: "seg-1",
          verdict: "pass",
          score: 0.98,
          reasons: ["ok"],
        },
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "quality-seg-2",
        status: "completed",
        decision: "manual_review_required",
        verdict: {
          segmentId: "seg-2",
          verdict: "manual_review",
          score: 0.61,
          reasons: ["low confidence"],
        },
        handoff: {
          segmentId: "seg-2",
          summary: "manual review required",
          reasons: ["low confidence"],
          evidence: {
            score: 0.61,
            confidence: 0.49,
            validation: {
              coverageRatio: 1,
              issues: [],
            },
          },
        },
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "quality-seg-3",
        status: "completed",
        decision: "auto_pass",
        verdict: {
          segmentId: "seg-3",
          verdict: "pass",
          score: 0.93,
          reasons: ["ok"],
        },
      } as any);

    mockRunPersistStage
      .mockResolvedValueOnce({
        stageRunId: "persist-seg-1",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 0,
          persistedSentenceCount: 1,
        },
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "persist-seg-3",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 0,
          persistedSentenceCount: 1,
        },
      } as any);

    const onProgress = jest.fn();
    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
      onProgress,
    });

    expect(mockRunSegmentScriptingStage).toHaveBeenCalledTimes(3);
    expect(mockRunSegmentScriptingStage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        segmentId: "seg-1",
        segmentText: "第一段原文。",
      })
    );
    expect(mockRunSegmentScriptingStage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        segmentId: "seg-3",
        segmentText: "第三段原文。",
      })
    );
    expect(mockRunPersistStage).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(result.summary).toMatchObject({
      totalSegments: 3,
      processedSegments: 2,
      failedSegments: 1,
      failedSegmentIds: ["seg-2"],
      failedSegmentDetails: [
        expect.objectContaining({
          segmentId: "seg-2",
          stage: "quality_judgement",
          errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
          issueCodes: ["QUALITY_MANUAL_REVIEW_REQUIRED"],
        }),
      ],
    });
    expect(result.segments).toEqual([
      {
        segmentId: "seg-1",
        lineCount: 1,
        characters: ["旁白"],
      },
      {
        segmentId: "seg-3",
        lineCount: 1,
        characters: ["旁白"],
      },
    ]);
  });

  it("syncs manual review items inside runtime when taskId is provided", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-seg-1",
      status: "completed",
      artifact: createDraftArtifact("seg-1", "第一段原文。"),
    } as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-seg-1",
      status: "completed",
      decision: "manual_review_required",
      verdict: {
        segmentId: "seg-1",
        verdict: "manual_review",
        score: 0.61,
        reasons: ["low confidence"],
      },
      handoff: {
        segmentId: "seg-1",
        summary: "manual review required",
        reasons: ["low confidence"],
        evidence: {
          score: 0.61,
          confidence: 0.49,
          validation: {
            coverageRatio: 1,
            issues: [],
          },
        },
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      taskId: "task-review-1",
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockPrisma.manualReviewItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        segmentId: "seg-1",
        issueType: "SCRIPT_VALIDATION",
      }),
    });
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "manual_review_escalated",
        }),
      })
    );
    expect(mockPrisma.toolCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toolName: "sync-manual-review-items",
        }),
      })
    );
    expect((result as any).runtimeMetadata?.summary).toEqual(
      expect.objectContaining({
        manualReviewSync: expect.objectContaining({
          issueType: "SCRIPT_VALIDATION",
          created: 1,
          pending: 1,
          resolved: 0,
        }),
      })
    );
  });

  it("reuses legacy partial segment selection semantics before running runtime stages", async () => {
    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-seg-2",
      status: "completed",
      artifact: createDraftArtifact("seg-2", "第二段原文。"),
    } as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-seg-2",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-2",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-seg-2",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "partial",
      startFromSegmentId: "seg-2",
      limitToSegments: 1,
    });

    expect(mockRunSegmentScriptingStage).toHaveBeenCalledTimes(1);
    expect(mockRunSegmentScriptingStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-2",
        segmentText: "第二段原文。",
      })
    );
    expect(result.summary).toMatchObject({
      totalSegments: 1,
      processedSegments: 1,
      failedSegments: 0,
      failedSegmentIds: [],
    });
    expect(result.segments).toEqual([
      {
        segmentId: "seg-2",
        lineCount: 1,
        characters: ["旁白"],
      },
    ]);
  });

  it("runs character discovery before segment scripting and persists the memory draft once", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunCharacterDiscoveryStage.mockResolvedValue({
      stageRunId: "discovery-stage-1",
      status: "completed",
      artifact: createCharacterMemoryDraftArtifact(),
    } as any);
    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-script-1",
      status: "completed",
      artifact: createDraftArtifact("seg-1", "第一段原文。", {
        speaker: "张三",
      }),
    } as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-1",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-1",
        verdict: "pass",
        score: 0.98,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockImplementation(async (input: any) => {
      if (input.artifacts[0]?.kind === "character-memory-draft") {
        return {
          stageRunId: "stage-persist-character-memory",
          status: "completed",
          artifact: {
            kind: "persisted-business-facts",
            persistedCharacterCount: 1,
            persistedSentenceCount: 0,
          },
        } as any;
      }

      return {
        stageRunId: "stage-persist-segment",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 0,
          persistedSentenceCount: 1,
        },
      } as any;
    });

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunCharacterDiscoveryStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentText: "第一段原文。",
      })
    );
    expect(mockRunPersistStage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({
            kind: "character-memory-draft",
          }),
        ],
      })
    );
    expect(mockRunPersistStage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({
            kind: "segment-script-draft",
          }),
        ],
      })
    );
    expect((result as any).runtimeMetadata?.summary).toEqual(
      expect.objectContaining({
        persistedCharacterCount: 1,
        persistedSentenceCount: 1,
      })
    );
  });

  it.each([
    {
      title: "full",
      input: {
        bookId: "book-1",
        options: {},
        mode: "full" as const,
      },
      expectedSegmentId: "seg-1",
    },
    {
      title: "partial",
      input: {
        bookId: "book-1",
        options: {},
        mode: "partial" as const,
        startFromSegmentId: "seg-2",
        limitToSegments: 1,
      },
      expectedSegmentId: "seg-2",
    },
    {
      title: "regenerate",
      input: {
        bookId: "book-1",
        options: {},
        mode: "regenerate" as const,
        segmentIds: ["seg-2"],
      },
      expectedSegmentId: "seg-2",
    },
  ])(
    "passes existing character memory into segment scripting for $title mode",
    async ({ input, expectedSegmentId }) => {
      mockPrisma.book.findUnique.mockResolvedValue({
        ...createBookFixture(),
        characterProfiles: [
          {
            id: "char-1",
            canonicalName: "宁采臣",
            aliases: [{ alias: "宁公子" }],
          },
          {
            id: "char-2",
            canonicalName: "燕赤霞",
            aliases: [{ alias: "燕大侠" }],
          },
        ],
      });
      mockRunSegmentScriptingStage.mockImplementation(
        async ({ segmentId, segmentText }: any) =>
          ({
            stageRunId: `stage-${segmentId}`,
            status: "completed",
            artifact: createDraftArtifact(segmentId, segmentText),
          }) as any
      );
      mockRunQualityStage.mockImplementation(
        async ({ segmentId }: any) =>
          ({
            stageRunId: `quality-${segmentId}`,
            status: "completed",
            decision: "auto_pass",
            verdict: {
              segmentId,
              verdict: "pass",
              score: 0.95,
              reasons: ["ok"],
            },
          }) as any
      );
      mockRunPersistStage.mockResolvedValue({
        stageRunId: "persist-stage",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 0,
          persistedSentenceCount: 1,
        },
      } as any);

      await runScriptProductionWorkflow(input);

      expect(mockRunSegmentScriptingStage).toHaveBeenCalledWith(
        expect.objectContaining({
          segmentId: expectedSegmentId,
          characterMemory: expect.objectContaining({
            canonicalIdentities: expect.arrayContaining([
              expect.objectContaining({ name: "宁采臣" }),
              expect.objectContaining({ name: "燕赤霞" }),
            ]),
            aliasEvidence: expect.arrayContaining([
              expect.objectContaining({ alias: "宁公子" }),
            ]),
          }),
        })
      );
    }
  );

  it("keeps regenerate mode segment order aligned with legacy book order", async () => {
    mockRunSegmentScriptingStage.mockImplementation(async ({ segmentId }) => ({
      stageRunId: `stage-${segmentId}`,
      status: "completed",
      artifact: createDraftArtifact(segmentId, `${segmentId}-source`),
    }) as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-pass",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "regenerate",
      segmentIds: ["seg-3", "seg-1"],
    });

    expect(mockRunSegmentScriptingStage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        segmentId: "seg-1",
      })
    );
    expect(mockRunSegmentScriptingStage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        segmentId: "seg-3",
      })
    );
  });

  it("forwards structured failedArtifact to format repair and persists repaired draft", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-script-fail",
      status: "repairing",
      error: "Invalid script generation payload: expected JSON object",
      failedArtifact: {
        kind: "segment-scripting-failure",
        rawResponse: "not-json",
        provider: "openai",
        model: "gpt-4.1-mini",
        message: "Invalid script generation payload: expected JSON object",
      },
    } as any);
    mockRunSegmentRepairStage.mockImplementation(async (input: any) => {
      expect(input.createStageRun).toEqual(expect.any(Function));
      expect(input.updateStageRun).toEqual(expect.any(Function));
      expect(input.appendTrace).toEqual(expect.any(Function));

      await input.createStageRun({
        id: "stage-repair-ok",
        workflowRunId: input.workflowRunId,
        stageId: "segment_repair",
        status: "processing",
      });
      await input.updateStageRun({
        id: "stage-repair-ok",
        workflowRunId: input.workflowRunId,
        stageId: "segment_repair",
        status: "completed",
      });

      return {
        stageRunId: "stage-repair-ok",
        status: "completed",
        decision: {
          segmentId: "seg-1",
          action: "retry",
          reason: "format_repair",
          retryable: true,
        },
        artifact: createDraftArtifact("seg-1", "第一段原文。"),
      } as any;
    });
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-1",
        verdict: "pass",
        score: 0.99,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunSegmentRepairStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-1",
        failureKind: "format_repair",
        failedArtifact: {
          kind: "segment-scripting-failure",
          rawResponse: "not-json",
          provider: "openai",
          model: "gpt-4.1-mini",
          message: "Invalid script generation payload: expected JSON object",
        },
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "repair_started",
          payload: expect.objectContaining({
            failureKind: "format_repair",
            segmentId: "seg-1",
          }),
        }),
      })
    );
    expect(mockRunPersistStage).toHaveBeenCalledTimes(1);
    expect((result as any).runtimeMetadata?.summary).toEqual(
      expect.objectContaining({
        formatRepairCount: 1,
      })
    );
  });

  it("preserves repair failure raw response and structured payload in failed segment details", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-script-fail",
      status: "repairing",
      error: "Invalid script generation payload: expected JSON object",
      failedArtifact: {
        kind: "segment-scripting-failure",
        rawResponse: "not-json",
        provider: "openai",
        model: "gpt-4.1-mini",
        message: "Invalid script generation payload: expected JSON object",
      },
    } as any);

    mockRunSegmentRepairStage.mockResolvedValue({
      stageRunId: "stage-repair-failed",
      status: "failed",
      error: "Invalid repair payload line: required fields are invalid",
      failedArtifact: {
        kind: "segment-repair-failure",
        rawResponse:
          '{"lines":[{"id":"line-1","sourceText":"第一段原文。","text":"","speaker":"旁白","orderInSegment":0}]}',
        structuredResult: {
          lines: [
            {
              id: "line-1",
              sourceText: "第一段原文。",
              text: "",
              speaker: "旁白",
              orderInSegment: 0,
            },
          ],
        },
        provider: "openai",
        model: "gpt-4.1-mini",
        message: "Invalid repair payload line: required fields are invalid",
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(result.summary.failedSegmentDetails).toEqual([
      expect.objectContaining({
        segmentId: "seg-1",
        stage: "segment_repair",
        errorCode: "SEGMENT_REPAIR_FAILED",
        message: "Invalid repair payload line: required fields are invalid",
        rawResponse:
          '{"lines":[{"id":"line-1","sourceText":"第一段原文。","text":"","speaker":"旁白","orderInSegment":0}]}',
        structuredResult: {
          lines: [
            {
              id: "line-1",
              sourceText: "第一段原文。",
              text: "",
              speaker: "旁白",
              orderInSegment: 0,
            },
          ],
        },
      }),
    ]);
  });

  it("preserves scripting raw response and structured draft when validation ends in manual review", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-script-validation-fail",
      status: "completed",
      artifact: {
        kind: "segment-script-draft",
        skillId: "script-generation",
        segmentScriptDraft: {
          segmentId: "seg-1",
          createdAt: "2026-03-24T00:00:00.000Z",
          rawResponse:
            '{"lines":[{"id":"seg-1-line-1","sourceText":"第一段","text":"第一段","speaker":"旁白","orderInSegment":0}]}',
          lines: [
            {
              id: "seg-1-line-1",
              sourceText: "第一段",
              text: "第一段",
              speaker: "旁白",
              orderInSegment: 0,
            },
          ],
        },
      },
    } as any);
    mockRunSegmentRepairStage.mockResolvedValue({
      stageRunId: "stage-repair-manual-review",
      status: "completed",
      decision: {
        segmentId: "seg-1",
        action: "manual_review",
        reason: "coverage_not_met",
        retryable: false,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(result.summary.failedSegmentDetails).toEqual([
      expect.objectContaining({
        segmentId: "seg-1",
        stage: "segment_repair",
        errorCode: "SEGMENT_MANUAL_REVIEW_REQUIRED",
        rawResponse:
          '{"lines":[{"id":"seg-1-line-1","sourceText":"第一段","text":"第一段","speaker":"旁白","orderInSegment":0}]}',
        structuredResult: {
          segmentId: "seg-1",
          createdAt: "2026-03-24T00:00:00.000Z",
          lines: [
            {
              id: "seg-1-line-1",
              sourceText: "第一段",
              text: "第一段",
              speaker: "旁白",
              orderInSegment: 0,
            },
          ],
        },
      }),
    ]);
    expect(mockRunQualityStage).not.toHaveBeenCalled();
    expect(mockRunPersistStage).not.toHaveBeenCalled();
  });

  it("refines oversized format repair input into slices and persists merged parent draft once", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "seg-overbudget",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: "第一句。第二句。",
        },
      ],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockImplementation(async ({ segmentId }: any) => {
      if (segmentId === "seg-overbudget::refined-1") {
        return {
          stageRunId: "stage-script-overbudget-1",
          status: "completed",
          artifact: createDraftArtifact("seg-overbudget::refined-1", "第一句。"),
        } as any;
      }

      if (segmentId === "seg-overbudget::refined-2") {
        return {
          stageRunId: "stage-script-overbudget-2",
          status: "completed",
          artifact: createDraftArtifact("seg-overbudget::refined-2", "第二句。"),
        } as any;
      }

      return {
        stageRunId: "stage-script-overbudget-parent",
        status: "repairing",
        error: "Input context over budget for segment scripting stage",
        failedArtifact: {
          kind: "segment-scripting-failure",
          rawResponse: null,
          provider: "openai",
          model: "gpt-4.1-mini",
          message: "Input context over budget for segment scripting stage",
        },
      } as any;
    });

    mockRunSegmentRepairStage.mockResolvedValue({
      stageRunId: "stage-repair-overbudget",
      status: "completed",
      decision: {
        segmentId: "seg-overbudget",
        action: "refine",
        reason: "input_refinement",
        retryable: true,
      },
    } as any);

    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-overbudget",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-overbudget",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);

    mockRunPersistStage.mockImplementation(async (input: any) => {
      expect(input.artifacts[0].segmentScriptDraft.segmentId).toBe("seg-overbudget");
      expect(input.artifacts[0].segmentScriptDraft.lines).toHaveLength(2);

      return {
        stageRunId: "persist-overbudget",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 0,
          persistedSentenceCount: 2,
        },
      } as any;
    });

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunSegmentRepairStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-overbudget",
        failureKind: "format_repair",
      })
    );
    expect(mockRunPersistStage).toHaveBeenCalledTimes(1);
    expect(result.summary.failedSegments).toBe(0);
    expect(result.summary.totalLines).toBe(2);
  });

  it("reruns segment scripting when semantic retry requests another attempt", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunSegmentScriptingStage
      .mockResolvedValueOnce({
        stageRunId: "stage-script-invalid",
        status: "completed",
        artifact: createDraftArtifact("seg-1", "错误片段"),
      } as any)
      .mockResolvedValueOnce({
        stageRunId: "stage-script-valid",
        status: "completed",
        artifact: createDraftArtifact("seg-1", "第一段原文。"),
      } as any);
    mockRunSegmentRepairStage.mockResolvedValue({
      stageRunId: "stage-repair-semantic",
      status: "completed",
      decision: {
        segmentId: "seg-1",
        action: "retry",
        reason: "semantic_retry",
        retryable: true,
      },
    } as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-1",
        verdict: "pass",
        score: 0.96,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunSegmentRepairStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-1",
        failureKind: "semantic_retry",
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "repair_started",
          payload: expect.objectContaining({
            failureKind: "semantic_retry",
            segmentId: "seg-1",
          }),
        }),
      })
    );
    expect(mockRunSegmentScriptingStage).toHaveBeenCalledTimes(2);
    expect(mockRunPersistStage).toHaveBeenCalledTimes(1);
    expect(result.summary.failedSegments).toBe(0);
  });

  it("refines segment input after semantic retry is exhausted and persists merged parent draft once", async () => {
    const refinedContent = '前文。\n\n后文。“你好。”';
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "seg-1",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: refinedContent,
        },
      ],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockImplementation(async ({ segmentId }: any) => {
      if (segmentId === "seg-1::refined-1") {
        return {
          stageRunId: "stage-script-refined-1",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-1", "前文。\n\n后文。"),
        } as any;
      }

      if (segmentId === "seg-1::refined-2") {
        return {
          stageRunId: "stage-script-refined-2",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-2", "“你好。”", {
            text: "你好。",
            speaker: "张三",
          }),
        } as any;
      }

      return {
        stageRunId: `stage-script-${segmentId}`,
        status: "completed",
        artifact: createDraftArtifact(segmentId, "错误片段"),
      } as any;
    });

    mockRunSegmentRepairStage.mockImplementation(async (input: any) => {
      if (input.failureKind === "semantic_retry") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "retry",
            reason: "semantic_retry",
            retryable: true,
          },
        } as any;
      }

      if (input.failureKind === "input_refinement") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "refine",
            reason: "input_refinement",
            retryable: true,
          },
        } as any;
      }

      throw new Error(`unexpected failureKind: ${input.failureKind}`);
    });

    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-pass",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 2,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunSegmentRepairStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-1",
        failureKind: "input_refinement",
      })
    );
    expect(mockRunPersistStage).toHaveBeenCalledTimes(1);
    expect(mockRunPersistStage).toHaveBeenCalledWith(
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({
            kind: "segment-script-draft",
            segmentScriptDraft: expect.objectContaining({
              segmentId: "seg-1",
              lines: [
                expect.objectContaining({
                  sourceText: "前文。\n\n后文。",
                  orderInSegment: 0,
                }),
                expect.objectContaining({
                  sourceText: "“你好。”",
                  orderInSegment: 1,
                }),
              ],
            }),
          }),
        ],
      })
    );
    expect(mockRunSegmentScriptingStage).toHaveBeenCalledTimes(4);
    expect(result.summary.failedSegments).toBe(0);
  });

  it("skips quality judgement for input-refined leaves and only judges the merged parent draft", async () => {
    const refinedContent = '前文。\n\n后文。“好。”';
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "seg-1",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: refinedContent,
        },
      ],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockImplementation(async ({ segmentId }: any) => {
      if (segmentId === "seg-1::refined-1") {
        return {
          stageRunId: "stage-script-refined-1",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-1", "前文。\n\n后文。"),
        } as any;
      }

      if (segmentId === "seg-1::refined-2") {
        return {
          stageRunId: "stage-script-refined-2",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-2", "“好。”", {
            text: "好。",
            speaker: "未知",
          }),
        } as any;
      }

      return {
        stageRunId: `stage-script-${segmentId}`,
        status: "completed",
        artifact: createDraftArtifact(segmentId, "错误片段"),
      } as any;
    });

    mockRunSegmentRepairStage.mockImplementation(async (input: any) => {
      if (input.failureKind === "semantic_retry") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "retry",
            reason: "semantic_retry",
            retryable: true,
          },
        } as any;
      }

      if (input.failureKind === "input_refinement") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "refine",
            reason: "input_refinement",
            retryable: true,
          },
        } as any;
      }

      throw new Error(`unexpected failureKind: ${input.failureKind}`);
    });

    const qualityJudgedSegments: string[] = [];
    mockRunQualityStage.mockImplementation(async (input: any) => {
      qualityJudgedSegments.push(input.segmentId);

      if (input.segmentId !== "seg-1") {
        return {
          stageRunId: `quality-${input.segmentId}`,
          status: "completed",
          decision: "manual_review_required",
          verdict: {
            segmentId: input.segmentId,
            verdict: "manual_review",
            score: 0.5,
            reasons: ["short leaf should not be judged independently"],
          },
          handoff: {
            segmentId: input.segmentId,
            summary: "short_leaf",
            reasons: ["short leaf should not be judged independently"],
            evidence: {
              score: 0.5,
              confidence: 0.8,
              validation: {
                coverageRatio: 1,
                issues: [],
              },
            },
          },
        } as any;
      }

      return {
        stageRunId: "quality-parent",
        status: "completed",
        decision: "auto_pass",
        verdict: {
          segmentId: "seg-1",
          verdict: "pass",
          score: 0.95,
          reasons: ["ok"],
        },
      } as any;
    });

    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 2,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(result.summary.failedSegments).toBe(0);
    expect(qualityJudgedSegments).toEqual(["seg-1"]);
  });

  it("normalizes merged parent draft after input refinement before quality judgement", async () => {
    const refinedContent =
      "“宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……";
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "seg-1",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: refinedContent,
        },
      ],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockImplementation(
      async ({ segmentId, segmentText }: any) => {
        if (segmentId.startsWith("seg-1::refined-")) {
          return {
            stageRunId: `stage-script-${segmentId}`,
            status: "completed",
            artifact: {
              kind: "segment-script-draft",
              skillId: "script-generation",
              segmentScriptDraft: {
                segmentId,
                createdAt: "2026-03-31T00:00:00.000Z",
                lines: [
                  {
                    id: `${segmentId}-line-1`,
                    sourceText: segmentText,
                    text: segmentText.startsWith("“")
                      ? segmentText.slice(1)
                      : segmentText,
                    speaker: segmentText.startsWith("“") ? "未知" : "旁白",
                    orderInSegment: 0,
                  },
                ],
              },
            },
          } as any;
        }

        return {
          stageRunId: `stage-script-${segmentId}`,
          status: "completed",
          artifact: createDraftArtifact(segmentId, "错误片段"),
        } as any;
      }
    );

    mockRunSegmentRepairStage.mockImplementation(async (input: any) => {
      if (input.failureKind === "semantic_retry") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "retry",
            reason: "semantic_retry",
            retryable: true,
          },
        } as any;
      }

      if (input.failureKind === "input_refinement") {
        return {
          stageRunId: `stage-repair-${input.failureKind}-${input.segmentId}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "refine",
            reason: "input_refinement",
            retryable: true,
          },
        } as any;
      }

      throw new Error(`unexpected failureKind: ${input.failureKind}`);
    });

    const qualityInputs: any[] = [];
    mockRunQualityStage.mockImplementation(async (input: any) => {
      qualityInputs.push(input);
      return {
        stageRunId: "quality-parent",
        status: "completed",
        decision: "auto_pass",
        verdict: {
          segmentId: input.segmentId,
          verdict: "pass",
          score: 0.95,
          reasons: ["ok"],
        },
      } as any;
    });

    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(qualityInputs).toHaveLength(1);
    expect(qualityInputs[0].segmentScriptDraft.lines).toEqual([
      expect.objectContaining({
        sourceText: refinedContent,
        text:
          "宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……",
        speaker: "未知",
        orderInSegment: 0,
      }),
    ]);
    expect(result.summary.failedSegments).toBe(0);
  });

  it("recursively refines nested slices before persisting the merged parent draft", async () => {
    const refinedContent = '前文。\n\n后文。“你好。”';
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "seg-1",
          chapterId: "chapter-1",
          orderIndex: 0,
          content: refinedContent,
        },
      ],
      characterProfiles: [],
    });

    mockRunSegmentScriptingStage.mockImplementation(async ({ segmentId }: any) => {
      if (segmentId === "seg-1::refined-1::refined-1") {
        return {
          stageRunId: "stage-script-refined-1-1",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-1::refined-1", "前文。"),
        } as any;
      }

      if (segmentId === "seg-1::refined-1::refined-2") {
        return {
          stageRunId: "stage-script-refined-1-2",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-1::refined-2", "后文。"),
        } as any;
      }

      if (segmentId === "seg-1::refined-2") {
        return {
          stageRunId: "stage-script-refined-2",
          status: "completed",
          artifact: createDraftArtifact("seg-1::refined-2", "“你好。”", {
            text: "你好。",
            speaker: "张三",
          }),
        } as any;
      }

      if (segmentId === "seg-1::refined-1") {
        return {
          stageRunId: "stage-script-refined-1",
          status: "repairing",
          error: "Input context over budget for segment scripting stage",
          failedArtifact: {
            kind: "segment-scripting-failure",
            rawResponse: null,
            provider: "openai",
            model: "gpt-4.1-mini",
            message: "Input context over budget for segment scripting stage",
          },
        } as any;
      }

      return {
        stageRunId: `stage-script-${segmentId}`,
        status: "completed",
        artifact: createDraftArtifact(segmentId, "错误片段"),
      } as any;
    });

    mockRunSegmentRepairStage.mockImplementation(async (input: any) => {
      if (input.failureKind === "semantic_retry") {
        return {
          stageRunId: `stage-repair-semantic-${input.segmentId}-${input.repairDepth ?? 0}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "retry",
            reason: "semantic_retry",
            retryable: true,
          },
        } as any;
      }

      if (input.failureKind === "input_refinement") {
        return {
          stageRunId: `stage-repair-input-${input.segmentId}-${input.repairDepth ?? 0}`,
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "refine",
            reason: "input_refinement",
            retryable: true,
          },
        } as any;
      }

      if (
        input.failureKind === "format_repair" &&
        input.segmentId === "seg-1::refined-1"
      ) {
        return {
          stageRunId: "stage-repair-format-refined-1",
          status: "completed",
          decision: {
            segmentId: input.segmentId,
            action: "refine",
            reason: "input_refinement",
            retryable: true,
          },
        } as any;
      }

      throw new Error(
        `unexpected repair request: ${input.failureKind}:${input.segmentId}`
      );
    });

    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-pass",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 3,
      },
    } as any);

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockRunSegmentRepairStage).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg-1::refined-1",
        failureKind: "format_repair",
      })
    );
    expect(mockRunPersistStage).toHaveBeenCalledTimes(1);
    expect(mockRunPersistStage).toHaveBeenCalledWith(
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({
            kind: "segment-script-draft",
            segmentScriptDraft: expect.objectContaining({
              segmentId: "seg-1",
              lines: [
                expect.objectContaining({
                  sourceText: "前文。",
                  orderInSegment: 0,
                }),
                expect.objectContaining({
                  sourceText: "后文。",
                  orderInSegment: 1,
                }),
                expect.objectContaining({
                  sourceText: "“你好。”",
                  orderInSegment: 2,
                }),
              ],
            }),
          }),
        ],
      })
    );
    expect(mockRunSegmentScriptingStage).toHaveBeenCalledTimes(6);
    expect(result.summary.failedSegments).toBe(0);
    expect(result.summary.totalLines).toBe(3);
  });

  it("emits execution events from bridge adapter calls", async () => {
    const adapter = {
      call: jest.fn().mockResolvedValue({
        content: "ok",
        provider: "mock-provider",
        model: "mock-model",
        latencyMs: 5,
        attempt: 1,
        usage: null,
        waitMs: 2,
        retriesUsed: 0,
        totalElapsedMs: 7,
      }),
    };
    const onExecutionEvent = jest.fn();
    mockRunSegmentScriptingStage.mockImplementation(async ({ adapter }: any) => {
      if (!adapter) {
        throw new Error("expected adapter to be injected");
      }

      await adapter.call({
        prompt: "hello",
      });
      return {
        stageRunId: "stage-script-1",
        status: "completed",
        artifact: createDraftArtifact("seg-1", "第一段原文。"),
      } as any;
    });
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "quality-pass",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-1",
        verdict: "pass",
        score: 0.95,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "persist-pass",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
      onExecutionEvent,
    }, {
      adapter,
    });

    expect(onExecutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "submitted",
      })
    );
    expect(onExecutionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        provider: "mock-provider",
        model: "mock-model",
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "llm_requested",
          payload: expect.objectContaining({
            provider: "unknown",
            model: "unknown",
          }),
        }),
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "structured_output_received",
          payload: expect.objectContaining({
            provider: "mock-provider",
            model: "mock-model",
            contentLength: 2,
          }),
        }),
      })
    );
  });

  it("persists runtime execution rows and returns runtimeMetadata", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunSegmentScriptingStage.mockImplementation(async (input: any) => {
      expect(input.createStageRun).toEqual(expect.any(Function));
      expect(input.updateStageRun).toEqual(expect.any(Function));
      expect(input.appendTrace).toEqual(expect.any(Function));

      await input.createStageRun({
        id: "stage-script-1",
        workflowRunId: input.workflowRunId,
        stageId: "segment_scripting",
        status: "processing",
      });
      await input.appendTrace({
        id: "trace-script-1",
        kind: "stage.started",
        createdAt: "2026-03-24T10:00:00.000Z",
        workflowRunId: input.workflowRunId,
        stageRunId: "stage-script-1",
        status: "started",
        payload: { stageId: "segment_scripting" },
      });
      await input.updateStageRun({
        id: "stage-script-1",
        workflowRunId: input.workflowRunId,
        stageId: "segment_scripting",
        status: "completed",
      });

      return {
        stageRunId: "stage-script-1",
        status: "completed",
        artifact: createDraftArtifact("seg-1", "第一段原文。"),
      } as any;
    });
    mockRunQualityStage.mockImplementation(async (input: any) => {
      expect(input.createStageRun).toEqual(expect.any(Function));
      expect(input.updateStageRun).toEqual(expect.any(Function));
      expect(input.appendTrace).toEqual(expect.any(Function));

      await input.createStageRun({
        id: "stage-quality-1",
        workflowRunId: input.workflowRunId,
        stageId: "quality_judgement",
        status: "processing",
      });
      await input.updateStageRun({
        id: "stage-quality-1",
        workflowRunId: input.workflowRunId,
        stageId: "quality_judgement",
        status: "completed",
      });

      return {
        stageRunId: "stage-quality-1",
        status: "completed",
        decision: "auto_pass",
        skillMetadata: createSkillMetadata({
          modelPolicy: "quality",
          repairPolicy: "escalate-low-confidence",
          successCriteria: ["returns-quality-verdict"],
          telemetryTags: ["runtime", "quality"],
        }),
        verdict: {
          segmentId: "seg-1",
          verdict: "pass",
          score: 0.99,
          reasons: ["ok"],
        },
      } as any;
    });
    mockRunPersistStage.mockImplementation(async (input: any) => {
      expect(input.createStageRun).toEqual(expect.any(Function));
      expect(input.updateStageRun).toEqual(expect.any(Function));
      expect(input.appendTrace).toEqual(expect.any(Function));

      await input.createStageRun({
        id: "stage-persist-1",
        workflowRunId: input.workflowRunId,
        stageId: "persist",
        status: "processing",
      });
      await input.updateStageRun({
        id: "stage-persist-1",
        workflowRunId: input.workflowRunId,
        stageId: "persist",
        status: "completed",
      });

      return {
        stageRunId: "stage-persist-1",
        status: "completed",
        artifact: {
          kind: "persisted-business-facts",
          persistedCharacterCount: 2,
          persistedSentenceCount: 1,
        },
      } as any;
    });

    const result = await runScriptProductionWorkflow({
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockPrisma.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: "script-production",
          bookId: "book-1",
          status: "processing",
          entryPayload: expect.objectContaining({
            mode: "full",
          }),
        }),
      })
    );
    expect(mockPrisma.stageRun.create).toHaveBeenCalled();
    expect(mockPrisma.stageRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stageId: "prepare",
        }),
      })
    );
    expect(mockPrisma.stageRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stageId: "complete",
        }),
      })
    );
    expect(mockPrisma.agentRun.create).toHaveBeenCalled();
    expect(mockPrisma.toolCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toolName: expect.stringMatching(
            /validate-structured-output|check-script-coverage|commit-script-sentences/
          ),
        }),
      })
    );
    expect(mockPrisma.runtimeArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactKind: expect.stringMatching(
            /character-memory-draft|validation-report|segment-script-draft|quality-verdict/
          ),
          artifactVersion: "v1",
        }),
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalled();
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: expect.stringMatching(/artifact_committed|context_built/),
        }),
      })
    );
    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "validation_succeeded",
          payload: expect.objectContaining({
            segmentId: "seg-1",
          }),
        }),
      })
    );
    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expect.any(String) },
        data: expect.objectContaining({
          status: "completed",
          summary: expect.objectContaining({
            mode: "full",
            totalSegments: 1,
            processedSegments: 1,
            failedSegments: 0,
            persistedSentenceCount: 1,
            persistedCharacterCount: 2,
            formatRepairCount: 0,
            semanticRetryCount: 0,
          }),
        }),
      })
    );
    expect((result as any).runtimeMetadata).toEqual(
      expect.objectContaining({
        workflowRunId: expect.any(String),
        workflowId: "script-production",
        status: "completed",
        mode: "full",
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        durationMs: expect.any(Number),
        stageRunCount: expect.any(Number),
        traceEventCount: expect.any(Number),
        summary: expect.objectContaining({
          totalSegments: 1,
          processedSegments: 1,
          failedSegments: 0,
          persistedCharacterCount: 2,
          stageSkillMetadata: expect.objectContaining({
            character_discovery: expect.objectContaining({
              modelPolicy: "balanced",
            }),
            segment_scripting: expect.objectContaining({
              modelPolicy: "balanced",
              telemetryTags: expect.arrayContaining([
                "runtime",
                "segment-scripting",
              ]),
            }),
            quality_judgement: expect.objectContaining({
              modelPolicy: "quality",
            }),
          }),
        }),
      })
    );

    const validationStageUpdate = mockPrisma.stageRun.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.summary?.stageId === "validation"
    )?.[0];

    expect(validationStageUpdate?.data?.summary).toEqual(
      expect.objectContaining({
        stageId: "validation",
        segmentId: "seg-1",
        coverageRatio: 1,
        issueCodes: [],
      })
    );
    const scriptingStageUpdate = mockPrisma.stageRun.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.summary?.stageId === "segment_scripting"
    )?.[0];

    expect(scriptingStageUpdate?.data?.summary).toEqual(
      expect.objectContaining({
        skillMetadata: expect.objectContaining({
          modelPolicy: "balanced",
          repairPolicy: "handoff-to-json-repair",
          telemetryTags: expect.arrayContaining([
            "runtime",
            "segment-scripting",
          ]),
        }),
      })
    );
    expect(mockPrisma.toolCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toolName: "check-script-coverage",
          status: "processing",
        }),
      })
    );
  });

  it("links workflow runs back to the processing task when taskId is provided", async () => {
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [createBookFixture().textSegments[0]],
      characterProfiles: [],
    });
    mockRunSegmentScriptingStage.mockResolvedValue({
      stageRunId: "stage-script-task-link",
      status: "completed",
      artifact: createDraftArtifact("seg-1", "第一段原文。"),
    } as any);
    mockRunQualityStage.mockResolvedValue({
      stageRunId: "stage-quality-task-link",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "seg-1",
        verdict: "pass",
        score: 0.99,
        reasons: ["ok"],
      },
    } as any);
    mockRunPersistStage.mockResolvedValue({
      stageRunId: "stage-persist-task-link",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    } as any);

    await runScriptProductionWorkflow({
      taskId: "task-123",
      bookId: "book-1",
      options: {},
      mode: "full",
    });

    expect(mockPrisma.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processingTaskId: "task-123",
        }),
      })
    );
  });
});
