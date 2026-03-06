import { Prisma } from "@/lib/prisma";
import { jsonObject } from "@/lib/processing-task-utils";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

export const readAutoPipelineCompensationTaskId = (
  metadata: Prisma.JsonValue | null | undefined
): string | null => {
  const root = jsonObject(metadata);
  const autoPipeline = asRecord(root.autoPipeline);
  const compensation = asRecord(autoPipeline?.compensation);
  return typeof compensation?.taskId === "string" ? compensation.taskId : null;
};

export const buildAutoPipelineBookMetadata = ({
  metadata,
  lastTrigger,
  compensation,
}: {
  metadata: Prisma.JsonValue | null | undefined;
  lastTrigger?: Record<string, unknown> | null;
  compensation?: Record<string, unknown> | null;
}): Prisma.InputJsonValue => {
  const root = jsonObject(metadata);
  const autoPipeline = asRecord(root.autoPipeline) || {};

  return toInputJsonValue({
    ...root,
    autoPipeline: {
      ...autoPipeline,
      ...(lastTrigger !== undefined ? { lastTrigger } : {}),
      ...(compensation !== undefined ? { compensation } : {}),
    },
  });
};
