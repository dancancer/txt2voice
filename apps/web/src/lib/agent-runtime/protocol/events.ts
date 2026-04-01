const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasOptionalText = (value: unknown): value is string | undefined =>
  value === undefined || hasText(value);

const isOptionalRecord = (
  value: unknown
): value is Record<string, unknown> | undefined =>
  value === undefined || isRecord(value);

export type ExecutionEventStatus =
  | "started"
  | "completed"
  | "failed"
  | "skipped";

export interface ExecutionEvent {
  id: string;
  kind: string;
  createdAt: string;
  workflowRunId: string;
  status: ExecutionEventStatus;
  stageRunId?: string;
  agentRunId?: string;
  payload?: Record<string, unknown>;
}

export const isExecutionEvent = (value: unknown): value is ExecutionEvent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.id) &&
    hasText(value.kind) &&
    hasText(value.createdAt) &&
    hasText(value.workflowRunId) &&
    hasOptionalText(value.stageRunId) &&
    hasOptionalText(value.agentRunId) &&
    isOptionalRecord(value.payload) &&
    (value.status === "started" ||
      value.status === "completed" ||
      value.status === "failed" ||
      value.status === "skipped")
  );
};
