import type { WorkflowDefinition } from "../protocol/definitions";
import {
  runStage,
  type RunStageResult,
  type RuntimeStageDefinition,
  type StageRunRecord,
} from "./run-stage";
import type { TraceDependencies } from "./write-trace";
import { writeTrace } from "./write-trace";

type WorkflowTerminalStatus = "completed" | "failed" | "retrying" | "repairing";

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: string;
  entryPayload?: Record<string, unknown>;
}

export interface WorkflowRuntimeAdapters extends TraceDependencies {
  createWorkflowRun: (record: WorkflowRunRecord) => Promise<void> | void;
  updateWorkflowRun?: (record: WorkflowRunRecord) => Promise<void> | void;
  createStageRun: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export interface RunWorkflowInput {
  workflow: WorkflowDefinition;
  stages: RuntimeStageDefinition[];
  entryPayload?: Record<string, unknown>;
  adapters: WorkflowRuntimeAdapters;
}

export interface RunWorkflowResult {
  id: string;
  status: WorkflowTerminalStatus;
  stages: RunStageResult[];
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
  assertStageIdsMatch(input.workflow.stages, input.stages);

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

  for (const stage of input.stages) {
    const stageResult = await runStage({
      ...input.adapters,
      workflowRunId: workflowRun.id,
      stage,
      entryPayload: input.entryPayload,
      createStageRun: input.adapters.createStageRun,
      updateStageRun: input.adapters.updateStageRun,
    });

    stageResults.push(stageResult);

    if (stageResult.status !== "completed") {
      break;
    }
  }

  const status = getWorkflowStatus(stageResults);
  workflowRun.status = status;
  await input.adapters.updateWorkflowRun?.(workflowRun);

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
  };
};
