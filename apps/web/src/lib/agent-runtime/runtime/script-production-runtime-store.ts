import prisma from "@/lib/prisma";
import type { ExecutionEvent } from "../protocol/events";
import type { WorkflowRunRecord } from "./run-workflow";
import type { StageRunRecord } from "./run-stage";
import type { AgentRunRecord } from "./run-agent";

type JsonMap = Record<string, unknown>;

const toJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? null)) as object | null;

const runtimePrisma = prisma as any;

const TOOL_NAME_ALIASES: Record<string, string> = {
  "persist-character-memory-draft": "save-character-memory",
  "persist-segment-script-draft": "save-script-draft",
};

const TRACE_KIND_ALIASES: Record<string, string> = {
  "validation.failed": "validation_failed",
  "validation.completed": "structured_output_received",
};

const isTerminalStatus = (status: string): boolean =>
  status === "completed" ||
  status === "failed" ||
  status === "retrying" ||
  status === "repairing";

const normalizeToolName = (toolName: string) =>
  TOOL_NAME_ALIASES[toolName] || toolName;

const normalizeTraceKind = (kind: string) => TRACE_KIND_ALIASES[kind] || kind;

export interface ScriptProductionRuntimeStore {
  createWorkflowRun: (
    record: WorkflowRunRecord & {
      bookId: string;
      processingTaskId?: string | null;
      runtimeConfig?: JsonMap;
      startedAt?: Date;
    }
  ) => Promise<void>;
  updateWorkflowRun: (
    record: Pick<WorkflowRunRecord, "id" | "status"> & {
      summary?: JsonMap;
      completedAt?: Date;
    }
  ) => Promise<void>;
  createStageRun: (record: StageRunRecord & { startedAt?: Date }) => Promise<void>;
  updateStageRun: (
    record: StageRunRecord & {
      summary?: JsonMap;
      completedAt?: Date;
    }
  ) => Promise<void>;
  createAgentRun: (record: AgentRunRecord & { startedAt?: Date }) => Promise<void>;
  updateAgentRun: (
    record: AgentRunRecord & {
      completedAt?: Date;
    }
  ) => Promise<void>;
  createToolCall: (record: {
    id: string;
    agentRunId: string;
    toolName: string;
    status: string;
    argumentsSummary?: JsonMap;
    createdAt?: Date;
  }) => Promise<void>;
  updateToolCall: (record: {
    id: string;
    agentRunId: string;
    toolName: string;
    status: string;
    resultSummary?: JsonMap;
    completedAt?: Date;
  }) => Promise<void>;
  appendTrace: (event: ExecutionEvent) => Promise<void>;
}

export const createScriptProductionRuntimeStore = (): ScriptProductionRuntimeStore => ({
  async createWorkflowRun(record) {
    await runtimePrisma.workflowRun.create({
      data: {
        id: record.id,
        workflowId: record.workflowId,
        bookId: record.bookId,
        processingTaskId: record.processingTaskId ?? null,
        status: record.status,
        entryPayload: toJson(record.entryPayload),
        runtimeConfig: toJson(record.runtimeConfig),
        startedAt: record.startedAt,
      },
    });
  },

  async updateWorkflowRun(record) {
    await runtimePrisma.workflowRun.update({
      where: { id: record.id },
      data: {
        status: record.status,
        summary: record.summary ? toJson(record.summary) : undefined,
        completedAt: record.completedAt,
      },
    });
  },

  async createStageRun(record) {
    await runtimePrisma.stageRun.create({
      data: {
        id: record.id,
        workflowRunId: record.workflowRunId,
        stageId: record.stageId,
        status: record.status,
        startedAt: record.startedAt,
      },
    });
  },

  async updateStageRun(record) {
    await runtimePrisma.stageRun.update({
      where: { id: record.id },
      data: {
        status: record.status,
        summary: record.summary ? toJson(record.summary) : undefined,
        completedAt:
          record.completedAt ??
          (isTerminalStatus(record.status) ? new Date() : undefined),
      },
    });
  },

  async createAgentRun(record) {
    await runtimePrisma.agentRun.create({
      data: {
        id: record.id,
        stageRunId: record.stageRunId,
        agentId: record.agentId,
        skillId: record.skillId ?? null,
        status: record.status,
        inputSummary: record.inputSummary ? toJson(record.inputSummary) : undefined,
        outputSummary: record.outputSummary ? toJson(record.outputSummary) : undefined,
        startedAt: record.startedAt,
      },
    });
  },

  async updateAgentRun(record) {
    await runtimePrisma.agentRun.update({
      where: { id: record.id },
      data: {
        skillId: record.skillId ?? undefined,
        status: record.status,
        inputSummary: record.inputSummary ? toJson(record.inputSummary) : undefined,
        outputSummary: record.outputSummary ? toJson(record.outputSummary) : undefined,
        completedAt:
          record.completedAt ??
          (isTerminalStatus(record.status) ? new Date() : undefined),
      },
    });
  },

  async createToolCall(record) {
    await runtimePrisma.toolCall.create({
      data: {
        id: record.id,
        agentRunId: record.agentRunId,
        toolName: normalizeToolName(record.toolName),
        status: record.status,
        argumentsSummary: record.argumentsSummary
          ? toJson(record.argumentsSummary)
          : undefined,
        createdAt: record.createdAt,
      },
    });
  },

  async updateToolCall(record) {
    await runtimePrisma.toolCall.update({
      where: { id: record.id },
      data: {
        toolName: normalizeToolName(record.toolName),
        status: record.status,
        resultSummary: record.resultSummary
          ? toJson(record.resultSummary)
          : undefined,
        completedAt:
          record.completedAt ??
          (isTerminalStatus(record.status) ? new Date() : undefined),
      },
    });
  },

  async appendTrace(event) {
    await runtimePrisma.traceEvent.create({
      data: {
        id: event.id,
        workflowRunId: event.workflowRunId,
        stageRunId: event.stageRunId ?? null,
        agentRunId: event.agentRunId ?? null,
        eventType: normalizeTraceKind(event.kind),
        payload: toJson(event.payload),
        createdAt: new Date(event.createdAt),
      },
    });
  },
});

export const loadWorkflowReplay = async (workflowRunId: string) =>
  runtimePrisma.workflowRun.findUnique({
    where: { id: workflowRunId },
    include: {
        stageRuns: {
          include: {
            agentRuns: {
              include: {
                toolCalls: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
                traceEvents: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
              orderBy: [{ startedAt: "asc" }, { id: "asc" }],
            },
            traceEvents: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ startedAt: "asc" }, { id: "asc" }],
        },
      traceEvents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
