import type { ToolContract as ProtocolToolContract } from "../protocol";

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
