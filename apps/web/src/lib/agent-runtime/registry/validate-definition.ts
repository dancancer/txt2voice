import {
  type AgentDefinition,
  type SkillDefinition,
  type WorkflowDefinition,
  isAgentDefinition,
  isSkillDefinition,
  isWorkflowDefinition,
} from "../protocol";

export type DefinitionRegistryErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHORING_ERROR";

interface DefinitionRegistryErrorDetails {
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
  missingFields?: string[];
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
  const missingFields = findMissingFields(record, REQUIRED_SKILL_FIELDS);

  if (missingFields.length > 0 || !isSkillDefinition(record)) {
    throw new DefinitionRegistryError(
      "VALIDATION_ERROR",
      `Invalid skill definition ${definitionId}`,
      {
        definitionType: "skill",
        definitionId,
        missingFields,
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

  if (missingFields.length > 0 || !isWorkflowDefinition(record)) {
    throw new DefinitionRegistryError(
      "VALIDATION_ERROR",
      `Invalid workflow definition ${definitionId}`,
      {
        definitionType: "workflow",
        definitionId,
        missingFields,
      }
    );
  }

  return record;
};
