import { compileSkill } from "../compiler/compile-skill";
import { resolveMastraSkillSource } from "../shared/resolve-mastra-skill-source";
import {
  runCharacterDiscoveryStageNative,
  type RunCharacterDiscoveryStageInput,
  type RunCharacterDiscoveryStageResult,
} from "../../runtime/stages/run-character-discovery-stage";

const defaultSkillId = "character-extraction";

export const runMastraCharacterDiscovery = async (
  input: RunCharacterDiscoveryStageInput
): Promise<RunCharacterDiscoveryStageResult> => {
  const skillSource = resolveMastraSkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
    defaultSkillId,
  });

  compileSkill(skillSource.workspaceRoot, skillSource.skillId);

  return runCharacterDiscoveryStageNative(input);
};
