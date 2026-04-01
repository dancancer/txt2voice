import type { SkillDefinition } from "../../protocol";
import { loadPromptBundle } from "./load-prompt-bundle";

export interface CompiledMastraSkill {
  definition: SkillDefinition;
  instructions: string;
  systemPrompt: string;
  userPrompt: string;
  mastraInstructions: string;
}

export const compileSkill = (
  rootDir: string,
  skillId: string
): CompiledMastraSkill => {
  const bundle = loadPromptBundle(rootDir, skillId);

  return {
    definition: bundle.definition,
    instructions: bundle.instructions,
    systemPrompt: bundle.systemPrompt,
    userPrompt: bundle.userPrompt,
    mastraInstructions: [bundle.instructions, bundle.systemPrompt]
      .filter((entry) => entry.trim().length > 0)
      .join("\n\n"),
  };
};
