jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    runtimeArtifact: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    toolCall: {
      create: jest.fn(),
      update: jest.fn(),
    },
    traceEvent: {
      create: jest.fn(),
    },
    workflowRun: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";

const mockPrisma = prisma as any;

describe("script production runtime store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads workflow replay with ordered stage runs and trace events", async () => {
    const workflowRun = {
      id: "wf-1",
      workflowId: "script-production",
      status: "completed",
      stageRuns: [
        {
          id: "stage-1",
          runtimeArtifacts: [],
          agentRuns: [
            {
              id: "agent-1",
              toolCalls: [],
              runtimeArtifacts: [],
              traceEvents: [],
            },
          ],
          traceEvents: [],
        },
      ],
      runtimeArtifacts: [],
      traceEvents: [],
    };
    mockPrisma.workflowRun.findUnique.mockResolvedValue(workflowRun);

    const { loadWorkflowReplay } = await import(
      "../runtime/script-production-runtime-store"
    );

    const result = await loadWorkflowReplay("wf-1");

    expect(mockPrisma.workflowRun.findUnique).toHaveBeenCalledWith({
      where: { id: "wf-1" },
      include: {
        stageRuns: {
          include: {
            agentRuns: {
              include: {
                toolCalls: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
                runtimeArtifacts: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
                traceEvents: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
              orderBy: [{ startedAt: "asc" }, { id: "asc" }],
            },
            traceEvents: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
            runtimeArtifacts: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ startedAt: "asc" }, { id: "asc" }],
        },
        runtimeArtifacts: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        traceEvents: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    expect(result).toBe(workflowRun);
  });

  it("normalizes persisted tool names to canonical runtime contracts", async () => {
    mockPrisma.toolCall.create.mockResolvedValue({});
    const { createScriptProductionRuntimeStore } = await import(
      "../runtime/script-production-runtime-store"
    );

    const store = createScriptProductionRuntimeStore();
    await store.createToolCall({
      id: "tool-1",
      agentRunId: "agent-1",
      toolName: "persist-segment-script-draft",
      status: "processing",
    });

    expect(mockPrisma.toolCall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "tool-1",
        agentRunId: "agent-1",
        toolName: "save-script-draft",
        status: "processing",
      }),
    });
  });

  it("normalizes trace event kinds before persisting replay events", async () => {
    mockPrisma.traceEvent.create.mockResolvedValue({});
    const { createScriptProductionRuntimeStore } = await import(
      "../runtime/script-production-runtime-store"
    );

    const store = createScriptProductionRuntimeStore();
    await store.appendTrace({
      id: "trace-1",
      kind: "validation.failed",
      createdAt: "2026-03-25T12:00:00.000Z",
      workflowRunId: "wf-1",
      status: "failed",
      payload: {
        segmentId: "seg-1",
      },
    });

    expect(mockPrisma.traceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "trace-1",
        workflowRunId: "wf-1",
        eventType: "validation_failed",
        payload: expect.objectContaining({
          segmentId: "seg-1",
        }),
      }),
    });
  });

  it("persists runtime artifacts with envelope metadata", async () => {
    mockPrisma.runtimeArtifact.create.mockResolvedValue({});
    const { createScriptProductionRuntimeStore } = await import(
      "../runtime/script-production-runtime-store"
    );

    const store = createScriptProductionRuntimeStore();
    await store.createRuntimeArtifact({
      id: "artifact-1",
      workflowRunId: "wf-1",
      stageRunId: "stage-1",
      agentRunId: "agent-1",
      segmentId: "seg-1",
      artifactKind: "validation-report",
      artifactVersion: "v1",
      payload: {
        valid: false,
        issueCodes: ["LOW_COVERAGE"],
      },
    });

    expect(mockPrisma.runtimeArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "artifact-1",
        workflowRunId: "wf-1",
        stageRunId: "stage-1",
        agentRunId: "agent-1",
        segmentId: "seg-1",
        artifactKind: "validation-report",
        artifactVersion: "v1",
        payload: expect.objectContaining({
          valid: false,
          issueCodes: ["LOW_COVERAGE"],
        }),
      }),
    });
  });

  it("loads runtime artifacts with workflow and segment filters", async () => {
    const rows = [
      {
        id: "artifact-1",
        artifactKind: "validation-report",
      },
    ];
    mockPrisma.runtimeArtifact.findMany.mockResolvedValue(rows);
    const { loadRuntimeArtifacts } = await import(
      "../runtime/script-production-runtime-store"
    );

    const result = await loadRuntimeArtifacts({
      workflowRunId: "wf-1",
      segmentId: "seg-1",
      artifactKind: "validation-report",
    });

    expect(mockPrisma.runtimeArtifact.findMany).toHaveBeenCalledWith({
      where: {
        workflowRunId: "wf-1",
        segmentId: "seg-1",
        artifactKind: "validation-report",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(result).toBe(rows);
  });
});
