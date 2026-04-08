import { createRequire } from "module";

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
  const { createWorkflow } =
    requireModule("@mastra/core/workflows") as typeof import("@mastra/core/workflows");

  return {
    definition: loadedWorkflow.definition,
    instructions: loadedWorkflow.instructions,
    stageOrder: [...loadedWorkflow.definition.stages],
    runtimeSubstages:
      workflowId === SCRIPT_PRODUCTION_WORKFLOW_ID
        ? Object.fromEntries(
            Object.entries(SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES).map(
              ([stageId, substages]) => [stageId, [...substages]]
            )
          )
        : undefined,
    workflow: createWorkflow({
      id: loadedWorkflow.definition.id,
      inputSchema: {},
      outputSchema: {},
    }),
  };
};
