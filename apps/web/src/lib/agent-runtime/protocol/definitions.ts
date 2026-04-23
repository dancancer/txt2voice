const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => hasText(entry));

const isNonEmptyTextList = (value: unknown): value is string[] =>
  isTextList(value) && value.length > 0;

const isOptionalText = (value: unknown): boolean =>
  value === undefined || hasText(value);

const isOptionalTextList = (value: unknown): boolean =>
  value === undefined || isTextList(value);

export const FRAMEWORK_OWNED_RUNTIME_SUBSTAGES = ["validation"] as const;

export type FrameworkOwnedRuntimeSubstageId =
  (typeof FRAMEWORK_OWNED_RUNTIME_SUBSTAGES)[number];

export const RUNTIME_SKILL_KINDS = [
  "analysis",
  "generation",
  "repair",
  "quality",
] as const;

export type RuntimeSkillKind = (typeof RUNTIME_SKILL_KINDS)[number];

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
  promptBundle?: string[];
  modelPolicy?: string;
  repairPolicy?: string;
  successCriteria?: string[];
  telemetryTags?: string[];
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

export interface RuntimeSubstageDefinition {
  id: FrameworkOwnedRuntimeSubstageId;
  owner: "framework";
  parentStage: string;
}

export const isFrameworkOwnedRuntimeSubstageId = (
  value: unknown
): value is FrameworkOwnedRuntimeSubstageId =>
  hasText(value) &&
  FRAMEWORK_OWNED_RUNTIME_SUBSTAGES.includes(
    value as FrameworkOwnedRuntimeSubstageId
  );

export const requiresPromptBundle = (kind: unknown): kind is RuntimeSkillKind =>
  hasText(kind) && RUNTIME_SKILL_KINDS.includes(kind as RuntimeSkillKind);

const hasReservedWorkflowStage = (value: unknown): boolean =>
  isFrameworkOwnedRuntimeSubstageId(value);

const isWorkflowStageList = (value: unknown): value is string[] =>
  isTextList(value) && !value.some((stageId) => hasReservedWorkflowStage(stageId));

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

  const promptBundleValid = requiresPromptBundle(value.kind)
    ? isNonEmptyTextList(value.promptBundle)
    : isOptionalTextList(value.promptBundle);

  return (
    hasText(value.id) &&
    hasText(value.version) &&
    hasText(value.kind) &&
    isTextList(value.compatibleAgents) &&
    hasText(value.inputSchemaRef) &&
    hasText(value.outputSchemaRef) &&
    isTextList(value.contextRequirements) &&
    isTextList(value.toolAllowlist) &&
    promptBundleValid &&
    isOptionalText(value.modelPolicy) &&
    isOptionalText(value.repairPolicy) &&
    isOptionalTextList(value.successCriteria) &&
    isOptionalTextList(value.telemetryTags)
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
    isWorkflowStageList(value.stages)
  );
};

export const isRuntimeSubstageDefinition = (
  value: unknown
): value is RuntimeSubstageDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFrameworkOwnedRuntimeSubstageId(value.id) &&
    value.owner === "framework" &&
    hasText(value.parentStage)
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

export const resolveAllowedTools = (
  agent: AgentDefinition,
  skill: SkillDefinition,
  runtimeRegisteredTools: string[]
): string[] => {
  const skillTools = new Set(skill.toolAllowlist);
  const runtimeTools = new Set(runtimeRegisteredTools);

  return agent.allowedTools.filter(
    (toolName) => skillTools.has(toolName) && runtimeTools.has(toolName)
  );
};
