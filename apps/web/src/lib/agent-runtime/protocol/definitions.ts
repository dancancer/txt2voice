const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => hasText(entry));

export interface AgentDefinition {
  id: string;
  version: string;
  role: string;
  compatibleWorkflowStages: string[];
  allowedSkills: string[];
  allowedTools: string[];
}

export interface SkillDefinition {
  id: string;
  version: string;
  kind: string;
  compatibleAgents: string[];
  inputSchemaRef: string;
  outputSchemaRef: string;
  contextRequirements: string[];
  toolAllowlist: string[];
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  kind: "workflow";
  stages: string[];
}

export interface ToolContract {
  name: string;
  kind: string;
  sideEffect: boolean;
}

export const isAgentDefinition = (value: unknown): value is AgentDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.id) &&
    hasText(value.version) &&
    hasText(value.role) &&
    isTextList(value.compatibleWorkflowStages) &&
    isTextList(value.allowedSkills) &&
    isTextList(value.allowedTools)
  );
};

export const isSkillDefinition = (value: unknown): value is SkillDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.id) &&
    hasText(value.version) &&
    hasText(value.kind) &&
    isTextList(value.compatibleAgents) &&
    hasText(value.inputSchemaRef) &&
    hasText(value.outputSchemaRef) &&
    isTextList(value.contextRequirements) &&
    isTextList(value.toolAllowlist)
  );
};

export const isWorkflowDefinition = (
  value: unknown
): value is WorkflowDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.id) &&
    hasText(value.version) &&
    value.kind === "workflow" &&
    isTextList(value.stages)
  );
};

export const isToolContract = (value: unknown): value is ToolContract => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.name) &&
    hasText(value.kind) &&
    typeof value.sideEffect === "boolean"
  );
};
