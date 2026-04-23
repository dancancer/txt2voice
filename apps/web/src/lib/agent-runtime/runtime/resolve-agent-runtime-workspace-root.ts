import fs from "fs";
import path from "path";

const WORKSPACE_MARKERS = ["agents", "skills", "workflows"] as const;
const MAX_ANCESTOR_DEPTH = 12;

const hasWorkspaceMarkers = (dir: string) =>
  WORKSPACE_MARKERS.every((entry) => fs.existsSync(path.join(dir, entry)));

const findWorkspaceRootFrom = (startDir: string): string | null => {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    if (hasWorkspaceMarkers(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
};

export const resolveAgentRuntimeWorkspaceRoot = (
  workspaceRoot?: string
): string => {
  const fallbackFromModuleDir = path.resolve(__dirname, "../../../../../..");
  const candidates = [
    workspaceRoot,
    process.cwd(),
    fallbackFromModuleDir,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    const resolved = findWorkspaceRootFrom(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return path.resolve(workspaceRoot || process.cwd() || fallbackFromModuleDir);
};
