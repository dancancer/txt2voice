import type { WorkflowDefinition } from "../protocol/definitions";
import { runWorkflow } from "../runtime/run-workflow";

type JsonMap = Record<string, unknown>;

type InMemoryWorkflowRun = {
  id: string;
  workflowId: string;
  status: string;
  entryPayload?: JsonMap;
};

type InMemoryStageRun = {
  id: string;
  workflowRunId: string;
  stageId: string;
  status: string;
};

const updateStageStatus = (
  stageRuns: InMemoryStageRun[],
  stageRunId: string,
  status: string
) => {
  const target = stageRuns.find((item) => item.id === stageRunId);

  if (target) {
    target.status = status;
  }
};

describe("workflow runtime skeleton", () => {
  it("creates workflow run, stage runs, and trace events per stage", async () => {
    const workflowRuns: InMemoryWorkflowRun[] = [];
    const stageRuns: InMemoryStageRun[] = [];
    const events: Array<{ kind: string; stageRunId?: string }> = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-script",
      version: "1",
      kind: "workflow",
      stages: ["prepare", "generate"],
    };

    await runWorkflow({
      workflow,
      stages: [
        {
          id: "prepare",
          agent: {
            id: "prepare-agent",
            execute: async () => ({
              status: "completed",
              output: { ok: true },
            }),
          },
        },
        {
          id: "generate",
          agent: {
            id: "generate-agent",
            execute: async () => ({
              status: "completed",
              output: { count: 3 },
            }),
          },
        },
      ],
      entryPayload: {
        bookId: "book-1",
      },
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async (record) => {
          workflowRuns.push(record);
        },
        createStageRun: async (record) => {
          stageRuns.push(record);
        },
        updateStageRun: async (record) => {
          updateStageStatus(stageRuns, record.id, record.status);
        },
        appendTrace: async (event) => {
          events.push({
            kind: event.kind,
            stageRunId: event.stageRunId,
          });
        },
      },
    });

    expect(workflowRuns).toHaveLength(1);
    expect(stageRuns.map((item) => item.stageId)).toEqual(["prepare", "generate"]);
    expect(stageRuns.map((item) => item.status)).toEqual(["completed", "completed"]);
    const stageTraceKinds = events
      .filter((event) => event.stageRunId)
      .map((event) => event.kind);

    expect(stageTraceKinds).toEqual([
      "stage.started",
      "agent.started",
      "agent.completed",
      "stage.completed",
      "stage.started",
      "agent.started",
      "agent.completed",
      "stage.completed",
    ]);
  });

  it("moves failed agent into retrying instead of swallowing the failure", async () => {
    const stageRuns: InMemoryStageRun[] = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-retry",
      version: "1",
      kind: "workflow",
      stages: ["generate"],
    };

    const result = await runWorkflow({
      workflow,
      stages: [
        {
          id: "generate",
          agent: {
            id: "generate-agent",
            execute: async () => {
              throw new Error("llm timeout");
            },
            resolveFailure: () => "retrying",
          },
        },
      ],
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async () => undefined,
        createStageRun: async (record) => {
          stageRuns.push(record);
        },
        updateStageRun: async (record) => {
          updateStageStatus(stageRuns, record.id, record.status);
        },
        appendTrace: async () => undefined,
      },
    });

    expect(result.stages[0]?.agent.status).toBe("retrying");
    expect(stageRuns[0]?.status).toBe("retrying");
  });

  it("supports repairing transition for failed agent", async () => {
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-repair",
      version: "1",
      kind: "workflow",
      stages: ["repair"],
    };

    const result = await runWorkflow({
      workflow,
      stages: [
        {
          id: "repair",
          agent: {
            id: "repair-agent",
            execute: async () => ({
              status: "failed",
              retryDirective: "repairing",
              error: "schema mismatch",
            }),
          },
        },
      ],
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async () => undefined,
        createStageRun: async () => undefined,
        appendTrace: async () => undefined,
      },
    });

    expect(result.stages[0]?.agent.status).toBe("repairing");
  });

  it.each(["retrying", "repairing"] as const)(
    "stops executing next stages after blocking status: %s",
    async (blockingStatus) => {
      const executedStages: string[] = [];
      let nextId = 0;
      const workflow: WorkflowDefinition = {
        id: `wf-stop-${blockingStatus}`,
        version: "1",
        kind: "workflow",
        stages: ["stage-a", "stage-b"],
      };

      const result = await runWorkflow({
        workflow,
        stages: [
          {
            id: "stage-a",
            agent: {
              id: "agent-a",
              execute: async () => {
                executedStages.push("stage-a");

                return {
                  status: "failed",
                  retryDirective: blockingStatus,
                };
              },
            },
          },
          {
            id: "stage-b",
            agent: {
              id: "agent-b",
              execute: async () => {
                executedStages.push("stage-b");

                return {
                  status: "completed",
                  output: { shouldNotRun: true },
                };
              },
            },
          },
        ],
        adapters: {
          createId: () => `id-${nextId++}`,
          createWorkflowRun: async () => undefined,
          createStageRun: async () => undefined,
          appendTrace: async () => undefined,
        },
      });

      expect(executedStages).toEqual(["stage-a"]);
      expect(result.stages).toHaveLength(1);
      expect(result.status).toBe(blockingStatus);
    }
  );

  it("fails fast when workflow definition stages mismatch runtime stages", async () => {
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-mismatch",
      version: "1",
      kind: "workflow",
      stages: ["prepare", "generate"],
    };

    await expect(
      runWorkflow({
        workflow,
        stages: [
          {
            id: "prepare",
            agent: {
              id: "prepare-agent",
              execute: async () => ({
                status: "completed",
              }),
            },
          },
          {
            id: "publish",
            agent: {
              id: "publish-agent",
              execute: async () => ({
                status: "completed",
              }),
            },
          },
        ],
        adapters: {
          createId: () => `id-${nextId++}`,
          createWorkflowRun: async () => undefined,
          createStageRun: async () => undefined,
          appendTrace: async () => undefined,
        },
      })
    ).rejects.toThrow(
      "Workflow stage mismatch: expected [prepare, generate], received [prepare, publish]"
    );
  });
});
