import type { TraceDependencies } from "./write-trace";
import { writeTrace } from "./write-trace";

export type AgentRetryDirective = "retrying" | "repairing";
export type AgentFailureStatus = "failed" | AgentRetryDirective;
export type AgentRunStatus = "completed" | AgentFailureStatus;

type AgentExecutorSuccess = {
  status: "completed";
  output?: Record<string, unknown>;
};

type AgentExecutorFailure = {
  status: "failed";
  error?: string;
  retryDirective?: AgentRetryDirective;
  output?: Record<string, unknown>;
};

export type AgentExecutorResult = AgentExecutorSuccess | AgentExecutorFailure;

export interface AgentRunRecord {
  id: string;
  stageRunId: string;
  agentId: string;
  skillId?: string;
  status: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
}

export interface ToolCallRecord {
  id: string;
  agentRunId: string;
  toolName: string;
  status: string;
  argumentsSummary?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
}

export interface ToolCallInvocation<T> {
  toolName: string;
  argumentsSummary?: Record<string, unknown>;
  getResultSummary?: (result: T) => Record<string, unknown> | undefined;
  execute: () => Promise<T> | T;
}

export interface AgentExecutorInput {
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
  entryPayload?: Record<string, unknown>;
  runToolCall?: <T>(invocation: ToolCallInvocation<T>) => Promise<T>;
}

export type AgentExecutor = (
  input: AgentExecutorInput
) => Promise<AgentExecutorResult>;

export type FailureResolver = (context: {
  error: unknown;
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
}) => AgentFailureStatus;

export interface RuntimeAgentDefinition {
  id: string;
  skillId?: string;
  inputSummary?: Record<string, unknown>;
  getInputSummary?: (
    input: AgentExecutorInput
  ) => Record<string, unknown> | undefined;
  getOutputSummary?: (input: {
    status: AgentRunStatus;
    output?: Record<string, unknown>;
    error?: string;
  }) => Record<string, unknown> | undefined;
  execute: AgentExecutor;
  resolveFailure?: FailureResolver;
}

export interface RunAgentInput extends TraceDependencies {
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
  entryPayload?: Record<string, unknown>;
  agent: RuntimeAgentDefinition;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface RunAgentResult {
  runId?: string;
  agentId: string;
  status: AgentRunStatus;
  output?: Record<string, unknown>;
  error?: string;
}

const resolveFailureStatus = (
  result: AgentExecutorFailure
): AgentFailureStatus => result.retryDirective ?? "failed";

const asErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "Unknown agent execution error";
};

const asFailureOutput = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const output = (value as { output?: unknown }).output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }

  return output as Record<string, unknown>;
};

const resolveSkillId = (output?: Record<string, unknown>): string | undefined => {
  const skillId = output?.skillId;
  return typeof skillId === "string" && skillId.trim().length > 0
    ? skillId
    : undefined;
};

const buildToolCallRecorder = (params: {
  agentRunId?: string;
  input: RunAgentInput;
}) => {
  const agentRunId = params.agentRunId;

  if (!agentRunId || !params.input.createToolCall || !params.input.updateToolCall) {
    return undefined;
  }

  const resolvedAgentRunId = agentRunId;

  return async <T>(invocation: ToolCallInvocation<T>): Promise<T> => {
    const toolCallId = params.input.createId();
    const startedAt = (params.input.now ?? (() => new Date()))();

    await params.input.createToolCall?.({
      id: toolCallId,
      agentRunId: resolvedAgentRunId,
      toolName: invocation.toolName,
      status: "processing",
      argumentsSummary: invocation.argumentsSummary,
      createdAt: startedAt,
    });

    try {
      const result = await invocation.execute();
      await params.input.updateToolCall?.({
        id: toolCallId,
        agentRunId: resolvedAgentRunId,
        toolName: invocation.toolName,
        status: "completed",
        resultSummary: invocation.getResultSummary?.(result),
        completedAt: (params.input.now ?? (() => new Date()))(),
      });
      return result;
    } catch (error) {
      await params.input.updateToolCall?.({
        id: toolCallId,
        agentRunId: resolvedAgentRunId,
        toolName: invocation.toolName,
        status: "failed",
        resultSummary: {
          error:
            error instanceof Error ? error.message : "tool_call_failed",
        },
        completedAt: (params.input.now ?? (() => new Date()))(),
      });
      throw error;
    }
  };
};

export const runAgent = async (input: RunAgentInput): Promise<RunAgentResult> => {
  const agentRunId = input.createAgentRun ? input.createId() : undefined;
  const executorInput: AgentExecutorInput = {
    workflowRunId: input.workflowRunId,
    stageRunId: input.stageRunId,
    stageId: input.stageId,
    entryPayload: input.entryPayload,
    runToolCall: buildToolCallRecorder({
      agentRunId,
      input,
    }),
  };

  if (agentRunId) {
    await input.createAgentRun?.({
      id: agentRunId,
      stageRunId: input.stageRunId,
      agentId: input.agent.id,
      skillId: input.agent.skillId,
      status: "processing",
      inputSummary:
        input.agent.getInputSummary?.(executorInput) ?? input.agent.inputSummary,
    });
  }

  await writeTrace({
    ...input,
    kind: "agent.started",
    workflowRunId: input.workflowRunId,
    stageRunId: input.stageRunId,
    agentRunId,
    status: "processing",
    payload: {
      agentId: input.agent.id,
      stageId: input.stageId,
    },
  });

  let execution: AgentExecutorResult;

  try {
    execution = await input.agent.execute(executorInput);
  } catch (error) {
    const status =
      input.agent.resolveFailure?.({
        error,
        workflowRunId: input.workflowRunId,
        stageRunId: input.stageRunId,
        stageId: input.stageId,
      }) ?? "failed";
    const message = asErrorMessage(error);
    const output = asFailureOutput(error);

    await writeTrace({
      ...input,
      kind: `agent.${status}`,
      workflowRunId: input.workflowRunId,
      stageRunId: input.stageRunId,
      agentRunId,
      status,
      payload: {
        agentId: input.agent.id,
        error: message,
        output,
      },
    });

    if (agentRunId) {
      await input.updateAgentRun?.({
        id: agentRunId,
        stageRunId: input.stageRunId,
        agentId: input.agent.id,
        skillId: input.agent.skillId || resolveSkillId(output),
        status,
        inputSummary:
          input.agent.getInputSummary?.(executorInput) ?? input.agent.inputSummary,
        outputSummary:
          input.agent.getOutputSummary?.({
            status,
            output,
            error: message,
          }) ||
          output || { error: message },
        completedAt: (input.now ?? (() => new Date()))(),
      });
    }

    return {
      runId: agentRunId,
      agentId: input.agent.id,
      status,
      error: message,
      output,
    };
  }

  const status =
    execution.status === "completed" ? "completed" : resolveFailureStatus(execution);
  const result: RunAgentResult = {
    runId: agentRunId,
    agentId: input.agent.id,
    status,
    output: execution.output,
    error: execution.status === "failed" ? execution.error : undefined,
  };

  await writeTrace({
    ...input,
    kind: `agent.${result.status}`,
    workflowRunId: input.workflowRunId,
    stageRunId: input.stageRunId,
    agentRunId,
    status: result.status,
    payload: {
      agentId: result.agentId,
      error: result.error,
    },
  });

  if (agentRunId) {
    await input.updateAgentRun?.({
      id: agentRunId,
      stageRunId: input.stageRunId,
      agentId: input.agent.id,
      skillId: input.agent.skillId || resolveSkillId(result.output),
      status: result.status,
      inputSummary:
        input.agent.getInputSummary?.(executorInput) ?? input.agent.inputSummary,
      outputSummary:
        input.agent.getOutputSummary?.({
          status: result.status,
          output: result.output,
          error: result.error,
        }) || result.output,
      completedAt: (input.now ?? (() => new Date()))(),
    });
  }

  return result;
};
