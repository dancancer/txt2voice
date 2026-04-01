import { loadWorkflowDefinition } from "../../registry";
import type { WorkflowDefinition } from "../../protocol";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";

type MastraWorkflowInstance = ReturnType<
  typeof import("@mastra/core/workflows").createWorkflow
>;

export interface CompiledMastraWorkflow {
  definition: WorkflowDefinition;
  instructions: string;
  stageOrder: string[];
  workflow: MastraWorkflowInstance;
}

export const compileWorkflow = (
  rootDir: string,
  workflowId: string
): CompiledMastraWorkflow => {
  const loadedWorkflow = loadWorkflowDefinition(rootDir, workflowId);
  ensureMastraWebGlobals();
  const { createWorkflow } =
    require("@mastra/core/workflows") as typeof import("@mastra/core/workflows");

  return {
    definition: loadedWorkflow.definition,
    instructions: loadedWorkflow.instructions,
    stageOrder: [...loadedWorkflow.definition.stages],
    workflow: createWorkflow({
      id: loadedWorkflow.definition.id,
      inputSchema: {},
      outputSchema: {},
    }),
  };
};
