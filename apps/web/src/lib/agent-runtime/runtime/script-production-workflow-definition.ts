import path from "path";

import type { WorkflowDefinition } from "../protocol";
import { loadWorkflowDefinition } from "../registry";

export const SCRIPT_PRODUCTION_WORKFLOW_ID = "script-production";

export const SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES = {
  segment_scripting: ["validation"],
} as const;

export const resolveAgentRuntimeWorkspaceRoot = (workspaceRoot?: string) =>
  workspaceRoot || path.resolve(__dirname, "../../../../../..");

export const loadScriptProductionWorkflowDefinition = (
  workspaceRoot?: string
): WorkflowDefinition =>
  loadWorkflowDefinition(
    resolveAgentRuntimeWorkspaceRoot(workspaceRoot),
    SCRIPT_PRODUCTION_WORKFLOW_ID
  ).definition;
