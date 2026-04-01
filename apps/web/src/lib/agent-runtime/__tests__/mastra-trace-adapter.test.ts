jest.mock("@mastra/core/tools", () => ({
  createTool: jest.fn().mockImplementation((config) => ({
    id: config.id,
    description: config.description,
    execute: config.execute,
  })),
}));

import { createMastraTools } from "../mastra/runtime/create-mastra-tools";
import { normalizeMastraEvent } from "../mastra/trace";
import type { RuntimeToolContract } from "../tools/contracts";

const contracts: RuntimeToolContract[] = [
  {
    name: "load-book-context",
    kind: "io",
    sideEffect: false,
    inputSchemaRef: "tool.load-book-context.input.v1",
    outputSchemaRef: "tool.load-book-context.output.v1",
  },
  {
    name: "save-script-draft",
    kind: "io",
    sideEffect: true,
    inputSchemaRef: "tool.save-script-draft.input.v1",
    outputSchemaRef: "tool.save-script-draft.output.v1",
  },
];

describe("mastra trace adapter", () => {
  it("maps allowed Mastra tool calls back into ToolCallRecord-compatible writes", async () => {
    const createToolCall = jest.fn();
    const updateToolCall = jest.fn();

    const tools = createMastraTools({
      agentRunId: "agent-run-1",
      toolAllowlist: ["load-book-context"],
      contracts,
      createId: (() => {
        let index = 0;
        return () => `tool-call-${(index += 1)}`;
      })(),
      createToolCall,
      updateToolCall,
      executors: {
        "load-book-context": async (input) => ({
          bookId: (input as { bookId: string }).bookId,
          excerpt: "sample",
        }),
        "save-script-draft": async () => ({
          saved: true,
        }),
      },
    });

    expect(Object.keys(tools)).toEqual(["load-book-context"]);

    const result = await tools["load-book-context"]!.execute!(
      {
        bookId: "book-1",
      } as any,
      {} as any
    );

    expect(result).toEqual({
      bookId: "book-1",
      excerpt: "sample",
    });
    expect(createToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tool-call-1",
        agentRunId: "agent-run-1",
        toolName: "load-book-context",
        status: "processing",
        argumentsSummary: {
          bookId: "book-1",
        },
      })
    );
    expect(updateToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tool-call-1",
        agentRunId: "agent-run-1",
        toolName: "load-book-context",
        status: "completed",
        resultSummary: {
          bookId: "book-1",
          excerpt: "sample",
        },
      })
    );
  });

  it("normalizes Mastra runtime events into ExecutionEvent taxonomy", () => {
    const event = normalizeMastraEvent(
      {
        type: "llm.response",
        payload: {
          model: "gpt-4.1-mini",
        },
      },
      {
        workflowRunId: "wf-1",
        stageRunId: "stage-1",
        agentRunId: "agent-1",
        createId: () => "trace-1",
        now: () => new Date("2026-04-01T00:00:00.000Z"),
      }
    );

    expect(event).toEqual({
      id: "trace-1",
      kind: "structured_output_received",
      createdAt: "2026-04-01T00:00:00.000Z",
      workflowRunId: "wf-1",
      stageRunId: "stage-1",
      agentRunId: "agent-1",
      status: "completed",
      payload: {
        model: "gpt-4.1-mini",
      },
    });
  });

  it("does not expose tools outside the declared allowlist", () => {
    const tools = createMastraTools({
      agentRunId: "agent-run-2",
      toolAllowlist: ["load-book-context"],
      contracts,
      executors: {
        "load-book-context": async () => ({ ok: true }),
        "save-script-draft": async () => ({ ok: true }),
      },
    });

    expect(tools["save-script-draft"]).toBeUndefined();
  });
});
