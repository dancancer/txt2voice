export type RuntimeToolKind = "io" | "validation" | "task";

export interface RuntimeToolContract {
  name: string;
  kind: RuntimeToolKind;
  sideEffect: boolean;
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
