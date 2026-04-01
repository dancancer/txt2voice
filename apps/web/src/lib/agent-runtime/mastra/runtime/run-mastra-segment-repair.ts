import { compileSkill } from "../compiler/compile-skill";
import { resolveMastraSkillSource } from "../shared/resolve-mastra-skill-source";
import {
  runSegmentRepairStageNative,
  type RunSegmentRepairStageInput,
  type RunSegmentRepairStageResult,
} from "../../runtime/stages/run-segment-repair-stage";

const defaultSkillId = "json-repair";

export const runMastraSegmentRepair = async (
  input: RunSegmentRepairStageInput
): Promise<RunSegmentRepairStageResult> => {
  const skillSource = resolveMastraSkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
    defaultSkillId,
  });

  compileSkill(skillSource.workspaceRoot, skillSource.skillId);

  return runSegmentRepairStageNative(input);
};
