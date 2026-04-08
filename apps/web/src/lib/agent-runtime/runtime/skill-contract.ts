import type { SkillDefinition } from "../protocol";

const matchesExpectedSet = (
  actual: string[],
  expected: string[]
): boolean => {
  if (actual.length !== expected.length) {
    return false;
  }

  const expectedSet = new Set(expected);
  return actual.every((item) => expectedSet.has(item));
};

export const validateSkillContract = (params: {
  skill: SkillDefinition;
  agentId: string;
  expectedContextRequirements: string[];
  expectedOutputSchemaRef?: string;
}) => {
  const { skill, agentId, expectedContextRequirements, expectedOutputSchemaRef } =
    params;

  if (!skill.compatibleAgents.includes(agentId)) {
    throw new Error(`Skill ${skill.id} is not compatible with ${agentId}`);
  }

  if (!matchesExpectedSet(skill.contextRequirements, expectedContextRequirements)) {
    throw new Error(
      `Skill ${skill.id} has unsupported contextRequirements: expected [${expectedContextRequirements
        .map((item) => `"${item}"`)
        .join(", ")}]`
    );
  }

  if (
    expectedOutputSchemaRef &&
    skill.outputSchemaRef !== expectedOutputSchemaRef
  ) {
    throw new Error(
      `Skill ${skill.id} has unsupported outputSchemaRef: expected "${expectedOutputSchemaRef}"`
    );
  }
};
