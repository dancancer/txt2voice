import fs from "fs";
import path from "path";

import type { SkillDefinition } from "../protocol";
import {
  DefinitionRegistryError,
  loadSkillDefinition,
} from "../registry";

export interface SkillRuntimeBundle {
  definition: SkillDefinition;
  instructions: string;
  systemPrompt: string;
  userPrompt: string;
}

export const composeRuntimeSystemPrompt = (params: {
  agentInstructions?: string;
  skillInstructions?: string;
  systemPrompt: string;
}) =>
  [
    params.agentInstructions?.trim() || "",
    params.skillInstructions?.trim() || "",
    params.systemPrompt.trim(),
  ]
    .filter((entry) => entry.length > 0)
    .join("\n\n");

const requirePromptBundleEntries = (
  definition: SkillDefinition
): [string, string] => {
  const bundle = definition.promptBundle ?? [];
  const [systemPromptPath, userPromptPath] = bundle;

  if (
    typeof systemPromptPath === "string" &&
    systemPromptPath.trim().length > 0 &&
    typeof userPromptPath === "string" &&
    userPromptPath.trim().length > 0
  ) {
    return [systemPromptPath, userPromptPath];
  }

  throw new DefinitionRegistryError(
    "VALIDATION_ERROR",
    `Skill ${definition.id} must declare runtime promptBundle entries for system and user prompts`,
    {
      definitionType: "skill",
      definitionId: definition.id,
      invalidFields: ["promptBundle"],
    }
  );
};

const readRequiredFile = (params: {
  rootDir: string;
  skillId: string;
  relativePath: string;
}) => {
  const absolutePath = path.join(
    params.rootDir,
    "skills",
    params.skillId,
    params.relativePath
  );

  if (!fs.existsSync(absolutePath)) {
    throw new DefinitionRegistryError(
      "AUTHORING_ERROR",
      `Missing required file: ${absolutePath}`,
      {
        definitionType: "skill",
        definitionId: params.skillId,
        missingFile: params.relativePath,
      }
    );
  }

  return fs.readFileSync(absolutePath, "utf8");
};

export const loadSkillRuntimeBundle = (
  rootDir: string,
  skillId: string
): SkillRuntimeBundle => {
  const skill = loadSkillDefinition(rootDir, skillId);
  const [systemPromptPath, userPromptPath] = requirePromptBundleEntries(
    skill.definition
  );

  return {
    definition: skill.definition,
    instructions: skill.instructions,
    systemPrompt: readRequiredFile({
      rootDir,
      skillId,
      relativePath: systemPromptPath,
    }),
    userPrompt: readRequiredFile({
      rootDir,
      skillId,
      relativePath: userPromptPath,
    }),
  };
};
