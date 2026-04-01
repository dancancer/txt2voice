import fs from "fs";
import path from "path";

export interface MastraSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const resolveWorkspaceRoot = (workspaceRoot?: string): string => {
  if (workspaceRoot) {
    return workspaceRoot;
  }

  let current = process.cwd();

  for (let index = 0; index < 8; index += 1) {
    if (
      fs.existsSync(path.join(current, "skills")) &&
      fs.existsSync(path.join(current, "apps"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return process.cwd();
};

export const resolveMastraSkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
  defaultSkillId: string;
}): MastraSkillSource => {
  if (params.skillDir) {
    const resolvedSkillDir = path.resolve(params.skillDir);
    const skillsDir = path.dirname(resolvedSkillDir);

    if (path.basename(skillsDir) !== "skills") {
      throw new Error(
        `skillDir must target <workspace>/skills/<skill-id>: ${params.skillDir}`
      );
    }

    return {
      workspaceRoot: path.dirname(skillsDir),
      skillId: path.basename(resolvedSkillDir),
      skillDir: resolvedSkillDir,
    };
  }

  const workspaceRoot = resolveWorkspaceRoot(params.workspaceRoot);

  return {
    workspaceRoot,
    skillId: params.defaultSkillId,
    skillDir: path.join(workspaceRoot, "skills", params.defaultSkillId),
  };
};
