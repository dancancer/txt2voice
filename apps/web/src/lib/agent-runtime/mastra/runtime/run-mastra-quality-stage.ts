import { compileSkill } from "../compiler/compile-skill";
import { resolveMastraSkillSource } from "../shared/resolve-mastra-skill-source";
import {
  runQualityStageNative,
  type RunQualityStageInput,
  type RunQualityStageResult,
} from "../../runtime/stages/run-quality-stage";

const defaultSkillId = "quality-judgement";

export const runMastraQualityStage = async (
  input: RunQualityStageInput
): Promise<RunQualityStageResult> => {
  const skillSource = resolveMastraSkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
    defaultSkillId,
  });

  compileSkill(skillSource.workspaceRoot, skillSource.skillId);

  return runQualityStageNative(input);
};
