jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
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
          agentRuns: [
            {
              id: "agent-1",
              toolCalls: [],
              traceEvents: [],
            },
          ],
          traceEvents: [],
        },
      ],
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
                traceEvents: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
              orderBy: [{ startedAt: "asc" }, { id: "asc" }],
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
      },
    });
    expect(result).toBe(workflowRun);
  });
});
