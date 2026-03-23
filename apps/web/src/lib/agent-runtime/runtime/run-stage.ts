import { runAgent, type RunAgentResult, type RuntimeAgentDefinition } from "./run-agent";
import type { TraceDependencies } from "./write-trace";
import { writeTrace } from "./write-trace";

export interface StageRunRecord {
  id: string;
  workflowRunId: string;
  stageId: string;
  status: string;
}

export interface RuntimeStageDefinition {
  id: string;
  agent: RuntimeAgentDefinition;
}

export interface RunStageInput extends TraceDependencies {
  workflowRunId: string;
  stage: RuntimeStageDefinition;
  entryPayload?: Record<string, unknown>;
  createStageRun: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export interface RunStageResult {
  id: string;
  stageId: string;
  status: RunAgentResult["status"];
  agent: RunAgentResult;
}

export const runStage = async (input: RunStageInput): Promise<RunStageResult> => {
  const stageRun: StageRunRecord = {
    id: input.createId(),
    workflowRunId: input.workflowRunId,
    stageId: input.stage.id,
    status: "processing",
  };

  await input.createStageRun(stageRun);

  await writeTrace({
    ...input,
    workflowRunId: input.workflowRunId,
    stageRunId: stageRun.id,
    kind: "stage.started",
    status: "processing",
    payload: {
      stageId: input.stage.id,
    },
  });

  const agentResult = await runAgent({
    ...input,
    workflowRunId: input.workflowRunId,
    stageRunId: stageRun.id,
    stageId: input.stage.id,
    entryPayload: input.entryPayload,
    agent: input.stage.agent,
  });

  stageRun.status = agentResult.status;
  await input.updateStageRun?.(stageRun);

  await writeTrace({
    ...input,
    workflowRunId: input.workflowRunId,
    stageRunId: stageRun.id,
    kind: `stage.${agentResult.status}`,
    status: agentResult.status,
    payload: {
      stageId: input.stage.id,
      agentStatus: agentResult.status,
    },
  });

  return {
    id: stageRun.id,
    stageId: input.stage.id,
    status: agentResult.status,
    agent: agentResult,
  };
};
