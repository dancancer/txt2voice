import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import { buildAgentContext, type SegmentScriptDraft } from "../../context";
import { loadSkillDefinition } from "../../registry";
import { createScriptGenerationAgent } from "../agents/script-generation-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";

interface SegmentScriptingRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export interface RunSegmentScriptingStageInput
  extends SegmentScriptingRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentText: string;
  fullBookText?: string;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
}

export interface SegmentScriptingArtifact {
  kind: "segment-script-draft";
  skillId: "script-generation";
  segmentScriptDraft: SegmentScriptDraft;
}

interface RunSegmentScriptingStageCompletedResult {
  stageRunId: string;
  status: "completed";
  artifact: SegmentScriptingArtifact;
}

interface RunSegmentScriptingStageNonCompletedResult {
  stageRunId: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunSegmentScriptingStageResult =
  | RunSegmentScriptingStageCompletedResult
  | RunSegmentScriptingStageNonCompletedResult;

interface ScriptGenerationSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const defaultScriptGenerationSkillId = "script-generation";

const resolveWorkspaceRoot = (workspaceRoot?: string): string => {
  if (workspaceRoot) {
    return workspaceRoot;
  }

  let current = process.cwd();

  for (let index = 0; index < 8; index += 1) {
    const hasSkills = fs.existsSync(path.join(current, "skills"));
    const hasApps = fs.existsSync(path.join(current, "apps"));
    if (hasSkills && hasApps) {
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

const readRequiredFile = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
};

const loadScriptGenerationPrompts = (skillDir: string) => ({
  systemPrompt: readRequiredFile(path.join(skillDir, "prompts/system.md")),
  userPrompt: readRequiredFile(path.join(skillDir, "prompts/user.md")),
});

const resolveScriptGenerationSkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
}): ScriptGenerationSkillSource => {
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
    skillId: defaultScriptGenerationSkillId,
    skillDir: path.join(workspaceRoot, "skills", defaultScriptGenerationSkillId),
  };
};

const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../adapters/llm-adapter");
  return createDefaultLLMAdapter();
};

const assertSkillCompatibleWithAgent = (
  skillId: string,
  compatibleAgents: string[],
  agentId: string
) => {
  if (compatibleAgents.includes(agentId)) {
    return;
  }

  throw new Error(`Skill ${skillId} is not compatible with ${agentId}`);
};

export const runSegmentScriptingStage = async (
  input: RunSegmentScriptingStageInput
): Promise<RunSegmentScriptingStageResult> => {
  const runtimeAgentId = "script-generation-agent";

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "segment_scripting",
      agent: {
        id: runtimeAgentId,
        execute: async () => {
          const skillSource = resolveScriptGenerationSkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillDefinition(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          assertSkillCompatibleWithAgent(
            skill.definition.id,
            skill.definition.compatibleAgents,
            runtimeAgentId
          );
          const prompts = loadScriptGenerationPrompts(skillSource.skillDir);
          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            fullBookText: input.fullBookText,
            budget: {
              maxContextChars: 4000,
              reservedOutputChars: 1200,
            },
          });
          const adapter = await resolveAdapter(input.adapter);
          const agent = createScriptGenerationAgent({
            adapter,
            now: input.now,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentText:
              typeof context.inputContext.segmentText === "string"
                ? context.inputContext.segmentText
                : "",
            characterMemorySummary: context.referenceMemory.characterMemorySummary,
            prompts,
          });

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              segmentScriptDraft: result.segmentScriptDraft,
              provider: result.provider,
              model: result.model,
            },
          };
        },
      },
    },
    createId: input.createId ?? createRuntimeId,
    appendTrace: input.appendTrace ?? (async () => undefined),
    now: input.now,
    createStageRun: input.createStageRun ?? (async () => undefined),
    updateStageRun: input.updateStageRun,
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      status: stageResult.status,
      error: stageResult.agent.error,
    };
  }

  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultScriptGenerationSkillId;
  const segmentScriptDraft = stageResult.agent
    .output?.segmentScriptDraft as SegmentScriptDraft;

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact: {
      kind: "segment-script-draft",
      skillId: skillId as "script-generation",
      segmentScriptDraft,
    },
  };
};
