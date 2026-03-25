import type { WorkflowDefinition } from "../protocol/definitions";
import {
  runStage,
  type RunStageResult,
  type RuntimeStageDefinition,
  type StageRunRecord,
} from "./run-stage";
import type { AgentRunRecord, ToolCallRecord } from "./run-agent";
import type { TraceDependencies } from "./write-trace";
import { writeTrace } from "./write-trace";

type WorkflowTerminalStatus =
  | "completed"
  | "failed"
  | "retrying"
  | "repairing"
  | "manual_review_required"
  | "blocked";

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: string;
  entryPayload?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  completedAt?: Date;
}

export interface WorkflowRuntimeAdapters extends TraceDependencies {
  createWorkflowRun: (record: WorkflowRunRecord) => Promise<void> | void;
  updateWorkflowRun?: (record: WorkflowRunRecord) => Promise<void> | void;
  createStageRun: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface WorkflowCoordinatorContext {
  workflowRunId: string;
  entryPayload?: Record<string, unknown>;
  adapters: WorkflowRuntimeAdapters;
}

export interface WorkflowCoordinatorResult<TResult = unknown> {
  status?: WorkflowTerminalStatus;
  summary?: Record<string, unknown>;
  stages?: RunStageResult[];
  result?: TResult;
}

export interface RunWorkflowInput {
  workflow: WorkflowDefinition;
  stages?: RuntimeStageDefinition[];
  coordinator?: (
    context: WorkflowCoordinatorContext
  ) => Promise<WorkflowCoordinatorResult>;
  entryPayload?: Record<string, unknown>;
  adapters: WorkflowRuntimeAdapters;
}

export interface RunWorkflowResult<TResult = unknown> {
  id: string;
  status: WorkflowTerminalStatus;
  stages: RunStageResult[];
  summary?: Record<string, unknown>;
  result?: TResult;
}

const assertStageIdsMatch = (
  workflowStages: string[],
  runtimeStages: RuntimeStageDefinition[]
) => {
  const runtimeStageIds = runtimeStages.map((stage) => stage.id);
  const match =
    workflowStages.length === runtimeStageIds.length &&
    workflowStages.every((stageId, index) => stageId === runtimeStageIds[index]);

  if (!match) {
    throw new Error(
      `Workflow stage mismatch: expected [${workflowStages.join(", ")}], received [${runtimeStageIds.join(", ")}]`
    );
  }
};

const getWorkflowStatus = (stages: RunStageResult[]): WorkflowTerminalStatus => {
  const pending = stages.find((item) => item.status !== "completed");

  if (!pending) {
    return "completed";
  }

  return pending.status;
};

export const runWorkflow = async (
  input: RunWorkflowInput
): Promise<RunWorkflowResult> => {
  if (!input.coordinator && !input.stages) {
    throw new Error("runWorkflow requires either stages or coordinator");
  }

  if (input.stages) {
    assertStageIdsMatch(input.workflow.stages, input.stages);
  }

  const workflowRun: WorkflowRunRecord = {
    id: input.adapters.createId(),
    workflowId: input.workflow.id,
    status: "processing",
    entryPayload: input.entryPayload,
  };

  await input.adapters.createWorkflowRun(workflowRun);

  await writeTrace({
    ...input.adapters,
    workflowRunId: workflowRun.id,
    kind: "workflow.started",
    status: "processing",
    payload: {
      workflowId: input.workflow.id,
    },
  });

  const stageResults: RunStageResult[] = [];

  let summary: Record<string, unknown> | undefined;
  let result: unknown;
  let status: WorkflowTerminalStatus;

  try {
    if (input.coordinator) {
      const coordinatorResult = await input.coordinator({
        workflowRunId: workflowRun.id,
        entryPayload: input.entryPayload,
        adapters: input.adapters,
      });
      summary = coordinatorResult.summary;
      stageResults.push(...(coordinatorResult.stages || []));
      result = coordinatorResult.result;
      status = coordinatorResult.status ?? "completed";
    } else {
      for (const stage of input.stages || []) {
        const stageResult = await runStage({
          ...input.adapters,
          workflowRunId: workflowRun.id,
          stage,
          entryPayload: input.entryPayload,
          createStageRun: input.adapters.createStageRun,
          updateStageRun: input.adapters.updateStageRun,
          createAgentRun: input.adapters.createAgentRun,
          updateAgentRun: input.adapters.updateAgentRun,
          createToolCall: input.adapters.createToolCall,
          updateToolCall: input.adapters.updateToolCall,
        });

        stageResults.push(stageResult);

        if (stageResult.status !== "completed") {
          break;
        }
      }

      status = getWorkflowStatus(stageResults);
    }
  } catch (error) {
    status = "failed";
    workflowRun.status = status;
    await input.adapters.updateWorkflowRun?.({
      ...workflowRun,
      summary,
    });

    await writeTrace({
      ...input.adapters,
      workflowRunId: workflowRun.id,
      kind: "workflow.failed",
      status,
      payload: {
        workflowId: input.workflow.id,
        stageCount: stageResults.length,
      },
    });
    throw error;
  }

  workflowRun.status = status;
  await input.adapters.updateWorkflowRun?.({
    ...workflowRun,
    summary,
  });

  await writeTrace({
    ...input.adapters,
    workflowRunId: workflowRun.id,
    kind: `workflow.${status}`,
    status,
    payload: {
      workflowId: input.workflow.id,
      stageCount: stageResults.length,
    },
  });

  return {
    id: workflowRun.id,
    status,
    stages: stageResults,
    summary,
    result,
  };
};
