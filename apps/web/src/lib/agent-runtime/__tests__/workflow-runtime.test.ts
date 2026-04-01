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

type InMemoryAgentRun = {
  id: string;
  stageRunId: string;
  agentId: string;
  status: string;
  skillId?: string;
  inputSummary?: JsonMap;
  outputSummary?: JsonMap;
};

type InMemoryToolCall = {
  id: string;
  agentRunId: string;
  toolName: string;
  status: string;
  argumentsSummary?: JsonMap;
  resultSummary?: JsonMap;
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
  it("supports coordinator mode while keeping a single workflow run", async () => {
    const workflowRuns: InMemoryWorkflowRun[] = [];
    const workflowUpdates: Array<Record<string, unknown>> = [];
    const events: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-coordinator",
      version: "1",
      kind: "workflow",
      stages: ["segment_scripting", "validation", "persist"],
    };

    const result = await runWorkflow({
      workflow,
      entryPayload: {
        bookId: "book-1",
      },
      coordinator: async ({ workflowRunId }) => ({
        status: "completed",
        summary: {
          processedSegments: 2,
        },
        stages: [
          {
            id: "stage-1",
            stageId: "segment_scripting",
            status: "completed",
            agent: {
              runId: "agent-1",
              agentId: "script-generation-agent",
              status: "completed",
              output: { ok: true },
            },
          },
        ],
        result: {
          workflowRunId,
        },
      }),
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async (record) => {
          workflowRuns.push(record);
        },
        updateWorkflowRun: async (record) => {
          workflowUpdates.push(record as unknown as Record<string, unknown>);
        },
        createStageRun: async () => undefined,
        appendTrace: async (event) => {
          events.push({ kind: event.kind, payload: event.payload });
        },
      },
    });

    expect(workflowRuns).toHaveLength(1);
    expect(result.id).toBe(workflowRuns[0]?.id);
    expect(result.status).toBe("completed");
    expect(result.summary).toEqual({
      processedSegments: 2,
    });
    expect(result.stages).toHaveLength(1);
    expect(result.result).toEqual({
      workflowRunId: workflowRuns[0]?.id,
    });
    expect(workflowUpdates[0]).toEqual(
      expect.objectContaining({
        id: workflowRuns[0]?.id,
        status: "completed",
        summary: {
          processedSegments: 2,
        },
      })
    );
    expect(events.map((event) => event.kind)).toEqual([
      "workflow.started",
      "workflow.completed",
    ]);
    expect(events[1]?.payload).toEqual(
      expect.objectContaining({
        stageCount: 1,
      })
    );
  });

  it("accepts manual_review_required as a coordinator terminal status", async () => {
    const workflowRuns: InMemoryWorkflowRun[] = [];
    const workflowUpdates: Array<Record<string, unknown>> = [];
    const events: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-manual-review",
      version: "1",
      kind: "workflow",
      stages: ["quality_judgement", "manual_review_handoff"],
    };

    const result = await runWorkflow({
      workflow,
      coordinator: async () => ({
        status: "manual_review_required",
        summary: {
          pendingReviews: 2,
        },
      }),
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async (record) => {
          workflowRuns.push(record);
        },
        updateWorkflowRun: async (record) => {
          workflowUpdates.push(record as unknown as Record<string, unknown>);
        },
        createStageRun: async () => undefined,
        appendTrace: async (event) => {
          events.push({ kind: event.kind, payload: event.payload });
        },
      },
    });

    expect(result.status).toBe("manual_review_required");
    expect(workflowRuns).toHaveLength(1);
    expect(workflowUpdates[0]).toEqual(
      expect.objectContaining({
        id: workflowRuns[0]?.id,
        status: "manual_review_required",
        summary: {
          pendingReviews: 2,
        },
      })
    );
    expect(events.map((event) => event.kind)).toEqual([
      "workflow.started",
      "workflow.manual_review_required",
    ]);
  });

  it("accepts blocked as a coordinator terminal status", async () => {
    const workflowRuns: InMemoryWorkflowRun[] = [];
    const workflowUpdates: Array<Record<string, unknown>> = [];
    const events: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-blocked",
      version: "1",
      kind: "workflow",
      stages: ["prepare"],
    };

    const result = await runWorkflow({
      workflow,
      coordinator: async () => ({
        status: "blocked",
        summary: {
          reason: "budget_exceeded",
        },
      }),
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async (record) => {
          workflowRuns.push(record);
        },
        updateWorkflowRun: async (record) => {
          workflowUpdates.push(record as unknown as Record<string, unknown>);
        },
        createStageRun: async () => undefined,
        appendTrace: async (event) => {
          events.push({ kind: event.kind, payload: event.payload });
        },
      },
    });

    expect(result.status).toBe("blocked");
    expect(workflowRuns).toHaveLength(1);
    expect(workflowUpdates[0]).toEqual(
      expect.objectContaining({
        id: workflowRuns[0]?.id,
        status: "blocked",
        summary: {
          reason: "budget_exceeded",
        },
      })
    );
    expect(events.map((event) => event.kind)).toEqual([
      "workflow.started",
      "workflow.blocked",
    ]);
  });

  it("creates and updates tool calls through generic runtime helper", async () => {
    const toolCalls: InMemoryToolCall[] = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-tool-call",
      version: "1",
      kind: "workflow",
      stages: ["generate"],
    };

    await runWorkflow({
      workflow,
      stages: [
        {
          id: "generate",
          agent: {
            id: "generate-agent",
            execute: async (input: any) => {
              await input.runToolCall({
                toolName: "validate-structured-output",
                argumentsSummary: { segmentId: "seg-1" },
                execute: async () => ({ valid: true }),
                getResultSummary: (result: { valid: boolean }) => result,
              });

              return {
                status: "completed",
                output: { ok: true },
              };
            },
          },
        },
      ],
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async () => undefined,
        createStageRun: async () => undefined,
        createAgentRun: async () => undefined,
        updateAgentRun: async () => undefined,
        createToolCall: async (record) => {
          toolCalls.push(record as InMemoryToolCall);
        },
        updateToolCall: async (record) => {
          const target = toolCalls.find((item) => item.id === record.id);
          if (target) {
            Object.assign(target, record);
          }
        },
        appendTrace: async () => undefined,
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toEqual(
      expect.objectContaining({
        toolName: "validate-structured-output",
        status: "completed",
        argumentsSummary: {
          segmentId: "seg-1",
        },
        resultSummary: {
          valid: true,
        },
      })
    );
  });

  it("creates and updates agent runs with input and output summaries", async () => {
    const agentRuns: InMemoryAgentRun[] = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-agent-run",
      version: "1",
      kind: "workflow",
      stages: ["generate"],
    };

    await runWorkflow({
      workflow,
      entryPayload: {
        bookId: "book-1",
        segmentId: "seg-1",
      },
      stages: [
        {
          id: "generate",
          agent: {
            id: "generate-agent",
            skillId: "script-generation",
            getInputSummary: ({ entryPayload }) => ({
              segmentId: entryPayload?.segmentId,
            }),
            getOutputSummary: ({ output }) => ({
              lineCount: output?.lineCount,
            }),
            execute: async () => ({
              status: "completed",
              output: {
                skillId: "script-generation",
                lineCount: 2,
              },
            }),
          },
        },
      ],
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async () => undefined,
        createStageRun: async () => undefined,
        createAgentRun: async (record) => {
          agentRuns.push(record as InMemoryAgentRun);
        },
        updateAgentRun: async (record) => {
          const target = agentRuns.find((item) => item.id === record.id);
          if (target) {
            Object.assign(target, record);
          }
        },
        appendTrace: async () => undefined,
      },
    });

    expect(agentRuns).toHaveLength(1);
    expect(agentRuns[0]).toEqual(
      expect.objectContaining({
        agentId: "generate-agent",
        skillId: "script-generation",
        status: "completed",
        inputSummary: {
          segmentId: "seg-1",
        },
        outputSummary: {
          lineCount: 2,
        },
      })
    );
  });

  it("emits skill_selected when agent output resolves a skill id", async () => {
    const events: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
    let nextId = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-skill-selected",
      version: "1",
      kind: "workflow",
      stages: ["generate"],
    };

    await runWorkflow({
      workflow,
      stages: [
        {
          id: "generate",
          agent: {
            id: "generate-agent",
            execute: async () => ({
              status: "completed",
              output: {
                skillId: "script-generation",
              },
            }),
          },
        },
      ],
      adapters: {
        createId: () => `id-${nextId++}`,
        createWorkflowRun: async () => undefined,
        createStageRun: async () => undefined,
        createAgentRun: async () => undefined,
        updateAgentRun: async () => undefined,
        appendTrace: async (event) => {
          events.push({ kind: event.kind, payload: event.payload });
        },
      },
    });

    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["skill_selected", "agent.completed"])
    );
    expect(events.find((event) => event.kind === "skill_selected")).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          agentId: "generate-agent",
          skillId: "script-generation",
        }),
      })
    );
  });

  it("creates workflow run, stage runs, and trace events per stage", async () => {
    const workflowRuns: InMemoryWorkflowRun[] = [];
    const stageRuns: InMemoryStageRun[] = [];
    const agentRuns: InMemoryAgentRun[] = [];
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
        createAgentRun: async (record) => {
          agentRuns.push(record as InMemoryAgentRun);
        },
        updateAgentRun: async (record) => {
          const target = agentRuns.find((item) => item.id === record.id);
          if (target) {
            Object.assign(target, record);
          }
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
    expect(agentRuns.map((item) => item.agentId)).toEqual([
      "prepare-agent",
      "generate-agent",
    ]);
    expect(agentRuns.map((item) => item.status)).toEqual([
      "completed",
      "completed",
    ]);
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

  it("does not route trace sink failure through resolveFailure after agent execution", async () => {
    let nextId = 0;
    let resolveFailureCallCount = 0;
    const workflow: WorkflowDefinition = {
      id: "wf-trace-failure",
      version: "1",
      kind: "workflow",
      stages: ["generate"],
    };

    await expect(
      runWorkflow({
        workflow,
        stages: [
          {
            id: "generate",
            agent: {
              id: "generate-agent",
              execute: async () => ({
                status: "completed",
                output: { lines: 10 },
              }),
              resolveFailure: () => {
                resolveFailureCallCount += 1;

                return "retrying";
              },
            },
          },
        ],
        adapters: {
          createId: () => `id-${nextId++}`,
          createWorkflowRun: async () => undefined,
          createStageRun: async () => undefined,
          appendTrace: async (event) => {
            if (event.kind === "agent.completed") {
              throw new Error("trace sink unavailable");
            }
          },
        },
      })
    ).rejects.toThrow("trace sink unavailable");

    expect(resolveFailureCallCount).toBe(0);
  });
});
