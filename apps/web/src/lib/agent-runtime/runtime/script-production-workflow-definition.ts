import type { WorkflowDefinition } from "../protocol";
import { loadWorkflowDefinition } from "../registry";
import { resolveAgentRuntimeWorkspaceRoot } from "./resolve-agent-runtime-workspace-root";

export const SCRIPT_PRODUCTION_WORKFLOW_ID = "script-production";

export const SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES = {
  segment_scripting: ["validation"],
} as const;

export const loadScriptProductionWorkflowDefinition = (
  workspaceRoot?: string
): WorkflowDefinition =>
  loadWorkflowDefinition(
    resolveAgentRuntimeWorkspaceRoot(workspaceRoot),
    SCRIPT_PRODUCTION_WORKFLOW_ID
  ).definition;
