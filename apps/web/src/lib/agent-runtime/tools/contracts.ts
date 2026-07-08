import type { ToolContract as ProtocolToolContract } from "../protocol";
import { resolveAllowedTools } from "../protocol";

export type RuntimeToolKind = "io" | "validation" | "task";

export interface RuntimeToolContract extends ProtocolToolContract {
  kind: RuntimeToolKind;
  inputSchemaRef?: string;
  outputSchemaRef?: string;
}

export const isToolAllowed = (
  allowlist: string[],
  toolName: string
): boolean => {
  return allowlist.includes(toolName);
};

export const filterToolsByAllowlist = (
  contracts: RuntimeToolContract[],
  allowlist: string[]
): RuntimeToolContract[] => {
  return contracts.filter((contract) => isToolAllowed(allowlist, contract.name));
};

export const resolveAllowedToolNames = (params: {
  agentAllowedTools: string[];
  skillToolAllowlist: string[];
  registeredTools: RuntimeToolContract[];
}) =>
  resolveAllowedTools(
    {
      id: "runtime-agent",
      version: "1",
      role: "runtime",
      compatibleWorkflowStages: [],
      allowedSkills: [],
      allowedTools: params.agentAllowedTools,
    },
    {
      id: "runtime-skill",
      version: "1",
      kind: "runtime",
      compatibleAgents: [],
      inputSchemaRef: "runtime",
      outputSchemaRef: "runtime",
      contextRequirements: [],
      toolAllowlist: params.skillToolAllowlist,
    },
    params.registeredTools.map((tool) => tool.name)
  );

export const filterToolContractsByPolicy = (params: {
  contracts: RuntimeToolContract[];
  agentAllowedTools: string[];
  skillToolAllowlist: string[];
}) => {
  const allowedToolNames = new Set(
    resolveAllowedToolNames({
      agentAllowedTools: params.agentAllowedTools,
      skillToolAllowlist: params.skillToolAllowlist,
      registeredTools: params.contracts,
    })
  );

  return params.contracts.filter((contract) => allowedToolNames.has(contract.name));
};
