import fs from "fs";
import path from "path";

import { loadSkillDefinition } from "../../registry";
import type { SkillDefinition } from "../../protocol";

export interface PromptBundle {
  definition: SkillDefinition;
  instructions: string;
  systemPrompt: string;
  userPrompt: string;
}

const readPromptFile = (filePath: string): string =>
  fs.readFileSync(filePath, "utf8");

const findPromptPath = (
  rootDir: string,
  skillId: string,
  promptBundle: string[] | undefined,
  suffix: "system.md" | "user.md"
): string | null => {
  const relativePath = (promptBundle || []).find((entry) => entry.endsWith(suffix));
  if (!relativePath) {
    return null;
  }

  return path.join(rootDir, "skills", skillId, relativePath);
};

export const loadPromptBundle = (
  rootDir: string,
  skillId: string
): PromptBundle => {
  const skill = loadSkillDefinition(rootDir, skillId);
  const systemPromptPath = findPromptPath(
    rootDir,
    skillId,
    skill.definition.promptBundle,
    "system.md"
  );
  const userPromptPath = findPromptPath(
    rootDir,
    skillId,
    skill.definition.promptBundle,
    "user.md"
  );

  return {
    definition: skill.definition,
    instructions: skill.instructions,
    systemPrompt: systemPromptPath ? readPromptFile(systemPromptPath) : "",
    userPrompt: userPromptPath ? readPromptFile(userPromptPath) : "",
  };
};
