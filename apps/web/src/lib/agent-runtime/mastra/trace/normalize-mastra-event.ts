import type { ExecutionEvent } from "../../protocol/events";

interface MastraRuntimeEvent {
  type: string;
  payload?: Record<string, unknown>;
}

interface NormalizeMastraEventParams {
  workflowRunId: string;
  stageRunId?: string;
  agentRunId?: string;
  createId: () => string;
  now?: () => Date;
}

const EVENT_KIND_MAP: Record<
  string,
  Pick<ExecutionEvent, "kind" | "status">
> = {
  "agent.start": {
    kind: "agent.started",
    status: "started",
  },
  "agent.complete": {
    kind: "agent.completed",
    status: "completed",
  },
  "agent.error": {
    kind: "agent.failed",
    status: "failed",
  },
  "tool.start": {
    kind: "tool_call.started",
    status: "started",
  },
  "tool.complete": {
    kind: "tool_call.completed",
    status: "completed",
  },
  "tool.error": {
    kind: "tool_call.failed",
    status: "failed",
  },
  "llm.request": {
    kind: "llm_requested",
    status: "started",
  },
  "llm.response": {
    kind: "structured_output_received",
    status: "completed",
  },
};

export const normalizeMastraEvent = (
  event: MastraRuntimeEvent,
  params: NormalizeMastraEventParams
): ExecutionEvent => {
  const normalized = EVENT_KIND_MAP[event.type] ?? {
    kind: event.type,
    status: "completed" as const,
  };

  return {
    id: params.createId(),
    kind: normalized.kind,
    createdAt: (params.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.workflowRunId,
    stageRunId: params.stageRunId,
    agentRunId: params.agentRunId,
    status: normalized.status,
    payload: event.payload,
  };
};
