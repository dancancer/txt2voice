import { compileSkill } from "../compiler/compile-skill";
import { resolveMastraSkillSource } from "../shared/resolve-mastra-skill-source";
import {
  runSegmentScriptingStageNative,
  type RunSegmentScriptingStageInput,
  type RunSegmentScriptingStageResult,
} from "../../runtime/stages/run-segment-scripting-stage";

const defaultSkillId = "script-generation";

export const runMastraSegmentScripting = async (
  input: RunSegmentScriptingStageInput
): Promise<RunSegmentScriptingStageResult> => {
  const skillSource = resolveMastraSkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
    defaultSkillId,
  });

  compileSkill(skillSource.workspaceRoot, skillSource.skillId);

  return runSegmentScriptingStageNative(input);
};
