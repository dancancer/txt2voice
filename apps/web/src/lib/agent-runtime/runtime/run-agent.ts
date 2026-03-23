import type { TraceDependencies } from "./write-trace";
import { writeTrace } from "./write-trace";

export type AgentRetryDirective = "retrying" | "repairing";
export type AgentRunStatus = "completed" | "failed" | AgentRetryDirective;

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

export interface AgentExecutorInput {
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
  entryPayload?: Record<string, unknown>;
}

export type AgentExecutor = (
  input: AgentExecutorInput
) => Promise<AgentExecutorResult>;

export type FailureResolver = (context: {
  error: unknown;
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
}) => AgentRunStatus;

export interface RuntimeAgentDefinition {
  id: string;
  execute: AgentExecutor;
  resolveFailure?: FailureResolver;
}

export interface RunAgentInput extends TraceDependencies {
  workflowRunId: string;
  stageRunId: string;
  stageId: string;
  entryPayload?: Record<string, unknown>;
  agent: RuntimeAgentDefinition;
}

export interface RunAgentResult {
  agentId: string;
  status: AgentRunStatus;
  output?: Record<string, unknown>;
  error?: string;
}

const resolveFailureStatus = (
  result: AgentExecutorFailure
): AgentRunStatus => result.retryDirective ?? "failed";

const asErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "Unknown agent execution error";
};

export const runAgent = async (input: RunAgentInput): Promise<RunAgentResult> => {
  await writeTrace({
    ...input,
    kind: "agent.started",
    workflowRunId: input.workflowRunId,
    stageRunId: input.stageRunId,
    status: "processing",
    payload: {
      agentId: input.agent.id,
      stageId: input.stageId,
    },
  });

  try {
    const execution = await input.agent.execute({
      workflowRunId: input.workflowRunId,
      stageRunId: input.stageRunId,
      stageId: input.stageId,
      entryPayload: input.entryPayload,
    });
    const status =
      execution.status === "completed"
        ? "completed"
        : resolveFailureStatus(execution);
    const result: RunAgentResult = {
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
      status: result.status,
      payload: {
        agentId: result.agentId,
        error: result.error,
      },
    });

    return result;
  } catch (error) {
    const status =
      input.agent.resolveFailure?.({
        error,
        workflowRunId: input.workflowRunId,
        stageRunId: input.stageRunId,
        stageId: input.stageId,
      }) ?? "failed";
    const message = asErrorMessage(error);

    await writeTrace({
      ...input,
      kind: `agent.${status}`,
      workflowRunId: input.workflowRunId,
      stageRunId: input.stageRunId,
      status,
      payload: {
        agentId: input.agent.id,
        error: message,
      },
    });

    return {
      agentId: input.agent.id,
      status,
      error: message,
    };
  }
};
