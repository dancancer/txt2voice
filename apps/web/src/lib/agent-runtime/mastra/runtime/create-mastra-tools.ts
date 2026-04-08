import { createTool } from "@mastra/core/tools";

import type { ToolCallRecord } from "../../runtime/run-agent";
import type { RuntimeToolContract } from "../../tools/contracts";
import { filterToolsByAllowlist } from "../../tools/contracts";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";

type ToolExecutor = (input: unknown) => Promise<unknown> | unknown;
type MastraTool = ReturnType<typeof import("@mastra/core/tools").createTool>;

type CreateToolCall = (
  record: ToolCallRecord & { createdAt?: Date }
) => Promise<void> | void;

type UpdateToolCall = (
  record: ToolCallRecord & { completedAt?: Date }
) => Promise<void> | void;

export interface CreateMastraToolsParams {
  agentRunId: string;
  toolAllowlist: string[];
  contracts: RuntimeToolContract[];
  executors: Record<string, ToolExecutor>;
  createId?: () => string;
  now?: () => Date;
  createToolCall?: CreateToolCall;
  updateToolCall?: UpdateToolCall;
}

type MastraToolMap = Record<string, MastraTool>;

const createMastraToolId = () =>
  `mastra-tool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const summarizeRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

const createToolWrapper = async (params: {
  agentRunId: string;
  toolName: string;
  executor: ToolExecutor;
  payload: unknown;
  createId: () => string;
  now: () => Date;
  createToolCall?: CreateToolCall;
  updateToolCall?: UpdateToolCall;
}): Promise<unknown> => {
  const toolCallId = params.createId();
  const createdAt = params.now();

  await params.createToolCall?.({
    id: toolCallId,
    agentRunId: params.agentRunId,
    toolName: params.toolName,
    status: "processing",
    argumentsSummary: summarizeRecord(params.payload),
    createdAt,
  });

  try {
    const result = await params.executor(params.payload);
    await params.updateToolCall?.({
      id: toolCallId,
      agentRunId: params.agentRunId,
      toolName: params.toolName,
      status: "completed",
      resultSummary: summarizeRecord(result),
      completedAt: params.now(),
    });
    return result;
  } catch (error) {
    await params.updateToolCall?.({
      id: toolCallId,
      agentRunId: params.agentRunId,
      toolName: params.toolName,
      status: "failed",
      resultSummary: {
        error: error instanceof Error ? error.message : "tool_call_failed",
      },
      completedAt: params.now(),
    });
    throw error;
  }
};

export const createMastraTools = (
  params: CreateMastraToolsParams
): MastraToolMap => {
  const createId = params.createId ?? createMastraToolId;
  const now = params.now ?? (() => new Date());
  const allowedContracts = filterToolsByAllowlist(
    params.contracts,
    params.toolAllowlist
  );

  if (allowedContracts.length === 0) {
    return {};
  }

  ensureMastraWebGlobals();

  return Object.fromEntries(
    allowedContracts.map((contract) => {
      const executor = params.executors[contract.name];
      if (!executor) {
        throw new Error(`Missing Mastra executor for tool ${contract.name}`);
      }

      const tool = createTool({
        id: contract.name,
        description: `${contract.kind}:${contract.name}`,
        inputSchema: {},
        outputSchema: {},
        execute: async (input: unknown) =>
          createToolWrapper({
            agentRunId: params.agentRunId,
            toolName: contract.name,
            executor,
            payload: input,
            createId,
            now,
            createToolCall: params.createToolCall,
            updateToolCall: params.updateToolCall,
          }),
      });

      return [contract.name, tool];
    })
  );
};
