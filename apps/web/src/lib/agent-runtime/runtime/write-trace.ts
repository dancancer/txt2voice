import type { ExecutionEvent, ExecutionEventStatus } from "../protocol/events";

export type TraceRuntimeStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retrying"
  | "repairing"
  | "skipped";

export interface TraceDependencies {
  appendTrace: (event: ExecutionEvent) => Promise<void> | void;
  createId: () => string;
  now?: () => Date;
}

export interface WriteTraceInput extends TraceDependencies {
  kind: string;
  workflowRunId: string;
  status: TraceRuntimeStatus;
  stageRunId?: string;
  agentRunId?: string;
  payload?: Record<string, unknown>;
}

const mapStatusToEventStatus = (
  status: TraceRuntimeStatus
): ExecutionEventStatus => {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "skipped") {
    return "skipped";
  }

  return "started";
};

export const writeTrace = async (
  input: WriteTraceInput
): Promise<ExecutionEvent> => {
  const event: ExecutionEvent = {
    id: input.createId(),
    kind: input.kind,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    workflowRunId: input.workflowRunId,
    stageRunId: input.stageRunId,
    agentRunId: input.agentRunId,
    status: mapStatusToEventStatus(input.status),
    payload: input.payload,
  };

  await input.appendTrace(event);

  return event;
};
