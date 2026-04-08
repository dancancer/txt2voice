import {
  type AgentDefinition,
  type SkillDefinition,
  type WorkflowDefinition,
  FRAMEWORK_OWNED_RUNTIME_SUBSTAGES,
  isAgentDefinition,
  isSkillDefinition,
  isWorkflowDefinition,
  requiresPromptBundle,
} from "../protocol";

export type DefinitionRegistryErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHORING_ERROR";

interface DefinitionRegistryErrorDetails {
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
  missingFields?: string[];
  invalidFields?: string[];
  invalidStageIds?: string[];
  missingFile?: string;
}

const REQUIRED_AGENT_FIELDS = [
  "id",
  "version",
  "role",
  "compatibleWorkflowStages",
  "allowedSkills",
  "allowedTools",
] as const;

const REQUIRED_SKILL_FIELDS = [
  "id",
  "version",
  "kind",
  "compatibleAgents",
  "inputSchemaRef",
  "outputSchemaRef",
  "contextRequirements",
  "toolAllowlist",
] as const;

const REQUIRED_WORKFLOW_FIELDS = [
  "id",
  "version",
  "kind",
  "stages",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const hasValue = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

const findMissingFields = (
  value: Record<string, unknown>,
  requiredFields: readonly string[]
) => requiredFields.filter((fieldName) => !hasValue(value[fieldName]));

const findInvalidWorkflowStageIds = (value: Record<string, unknown>): string[] => {
  if (!Array.isArray(value.stages)) {
    return [];
  }

  return value.stages.filter(
    (stageId): stageId is string =>
      typeof stageId === "string" &&
      FRAMEWORK_OWNED_RUNTIME_SUBSTAGES.includes(
        stageId as (typeof FRAMEWORK_OWNED_RUNTIME_SUBSTAGES)[number]
      )
  );
};

const findSkillFieldIssues = (value: Record<string, unknown>) => {
  const missingFields = [...findMissingFields(value, REQUIRED_SKILL_FIELDS)];
  const invalidFields: string[] = [];

  if (requiresPromptBundle(value.kind)) {
    if (!hasValue(value.promptBundle)) {
      missingFields.push("promptBundle");
    } else if (
      !Array.isArray(value.promptBundle) ||
      value.promptBundle.length === 0 ||
      value.promptBundle.some(
        (entry) => typeof entry !== "string" || entry.trim().length === 0
      )
    ) {
      invalidFields.push("promptBundle");
    }
  }

  return {
    missingFields,
    invalidFields,
  };
};

export class DefinitionRegistryError extends Error {
  code: DefinitionRegistryErrorCode;

  details: DefinitionRegistryErrorDetails;

  constructor(
    code: DefinitionRegistryErrorCode,
    message: string,
    details: DefinitionRegistryErrorDetails
  ) {
    super(message);
    this.name = "DefinitionRegistryError";
    this.code = code;
    this.details = details;
  }
}

export const assertDefinitionMarkdown = (params: {
  exists: boolean;
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
  filename: string;
}) => {
  const { exists, definitionType, definitionId, filename } = params;

  if (exists) {
    return;
  }

  throw new DefinitionRegistryError(
    "AUTHORING_ERROR",
    `Missing ${filename} for ${definitionType} definition ${definitionId}`,
    {
      definitionType,
      definitionId,
      missingFile: filename,
    }
  );
};

export const validateAgentDefinition = (
  value: unknown,
  definitionId: string
): AgentDefinition => {
  const record = isRecord(value) ? value : {};
  const missingFields = findMissingFields(record, REQUIRED_AGENT_FIELDS);

  if (missingFields.length > 0 || !isAgentDefinition(record)) {
    throw new DefinitionRegistryError(
      "VALIDATION_ERROR",
      `Invalid agent definition ${definitionId}`,
      {
        definitionType: "agent",
        definitionId,
        missingFields,
      }
    );
  }

  return record;
};

export const validateSkillDefinition = (
  value: unknown,
  definitionId: string
): SkillDefinition => {
  const record = isRecord(value) ? value : {};
  const { missingFields, invalidFields } = findSkillFieldIssues(record);

  if (missingFields.length > 0 || invalidFields.length > 0 || !isSkillDefinition(record)) {
    throw new DefinitionRegistryError(
      "VALIDATION_ERROR",
      `Invalid skill definition ${definitionId}`,
      {
        definitionType: "skill",
        definitionId,
        missingFields,
        invalidFields,
      }
    );
  }

  return record;
};

export const validateWorkflowDefinition = (
  value: unknown,
  definitionId: string
): WorkflowDefinition => {
  const record = isRecord(value) ? value : {};
  const missingFields = findMissingFields(record, REQUIRED_WORKFLOW_FIELDS);
  const invalidStageIds = findInvalidWorkflowStageIds(record);

  if (missingFields.length > 0 || invalidStageIds.length > 0 || !isWorkflowDefinition(record)) {
    throw new DefinitionRegistryError(
      "VALIDATION_ERROR",
      `Invalid workflow definition ${definitionId}`,
      {
        definitionType: "workflow",
        definitionId,
        missingFields,
        invalidStageIds,
      }
    );
  }

  return record;
};
