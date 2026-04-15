import { createRequire } from "module";
import { z } from "zod";

import { loadWorkflowDefinition } from "../../registry";
import type { WorkflowDefinition } from "../../protocol";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";
import {
  SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES,
  SCRIPT_PRODUCTION_WORKFLOW_ID,
} from "../../runtime/script-production-workflow-definition";

type MastraWorkflowInstance = ReturnType<
  typeof import("@mastra/core/workflows").createWorkflow
>;
const requireModule = createRequire(import.meta.url);

const createStudioWorkflowStateSchema = () =>
  z.object({
    workflowId: z.string().optional(),
    workflowLabel: z.string().optional(),
    stageOrder: z.array(z.string()).default([]),
    currentStage: z.string().optional(),
    stageIndex: z.number().int().nonnegative().default(0),
    stageDescription: z.string().optional(),
    runtimeSubstages: z.record(z.string(), z.array(z.string())).default({}),
  });

const humanizeStageId = (stageId: string) =>
  stageId
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const extractWorkflowLabel = (instructions: string, workflowId: string) => {
  const titleLine = instructions
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"));

  return titleLine ? titleLine.replace(/^#+\s*/, "") : workflowId;
};

const createStudioMirrorStep = (params: {
  createStep: typeof import("@mastra/core/workflows").createStep;
  workflowId: string;
  workflowLabel: string;
  stageId: string;
  stageIndex: number;
  stageOrder: string[];
  runtimeSubstages?: Record<string, string[]>;
}) => {
  const {
    createStep,
    workflowId,
    workflowLabel,
    stageId,
    stageIndex,
    stageOrder,
    runtimeSubstages,
  } = params;
  const schema = createStudioWorkflowStateSchema();

  return createStep({
    id: stageId,
    description: `Studio mirror step for ${humanizeStageId(stageId)}`,
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => ({
      ...inputData,
      workflowId,
      workflowLabel,
      stageOrder,
      currentStage: stageId,
      stageIndex,
      stageDescription: humanizeStageId(stageId),
      runtimeSubstages: runtimeSubstages ?? {},
    }),
  });
};

const buildStudioWorkflow = (params: {
  createWorkflow: typeof import("@mastra/core/workflows").createWorkflow;
  createStep: typeof import("@mastra/core/workflows").createStep;
  workflowId: string;
  workflowLabel: string;
  stageOrder: string[];
  runtimeSubstages?: Record<string, string[]>;
}): MastraWorkflowInstance => {
  const {
    createWorkflow,
    createStep,
    workflowId,
    workflowLabel,
    stageOrder,
    runtimeSubstages,
  } = params;
  const schema = createStudioWorkflowStateSchema();

  let workflow = createWorkflow({
    id: workflowId,
    description: workflowLabel,
    inputSchema: schema,
    outputSchema: schema,
  });

  for (const [stageIndex, stageId] of stageOrder.entries()) {
    workflow = workflow.then(
      createStudioMirrorStep({
        createStep,
        workflowId,
        workflowLabel,
        stageId,
        stageIndex,
        stageOrder,
        runtimeSubstages,
      })
    );
  }

  return workflow.commit();
};

export interface CompiledMastraWorkflow {
  definition: WorkflowDefinition;
  instructions: string;
  stageOrder: string[];
  runtimeSubstages?: Record<string, string[]>;
  workflow: MastraWorkflowInstance;
}

export const compileWorkflow = (
  rootDir: string,
  workflowId: string
): CompiledMastraWorkflow => {
  const loadedWorkflow = loadWorkflowDefinition(rootDir, workflowId);
  ensureMastraWebGlobals();
  const { createWorkflow, createStep } =
    requireModule("@mastra/core/workflows") as typeof import("@mastra/core/workflows");
  const stageOrder = [...loadedWorkflow.definition.stages];
  const runtimeSubstages =
    workflowId === SCRIPT_PRODUCTION_WORKFLOW_ID
      ? Object.fromEntries(
          Object.entries(SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES).map(
            ([stageId, substages]) => [stageId, [...substages]]
          )
        )
      : undefined;
  const workflowLabel = extractWorkflowLabel(
    loadedWorkflow.instructions,
    loadedWorkflow.definition.id
  );

  return {
    definition: loadedWorkflow.definition,
    instructions: loadedWorkflow.instructions,
    stageOrder,
    runtimeSubstages,
    workflow: buildStudioWorkflow({
      createWorkflow,
      createStep,
      workflowId: loadedWorkflow.definition.id,
      workflowLabel,
      stageOrder,
      runtimeSubstages,
    }),
  };
};
