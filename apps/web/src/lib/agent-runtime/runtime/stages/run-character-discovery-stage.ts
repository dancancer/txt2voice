import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import { buildAgentContext, type CharacterMemory, type MemoryPatch } from "../../context";
import { loadSkillDefinition } from "../../registry";
import { createCharacterDiscoveryAgent } from "../agents/character-discovery-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";

interface CharacterDiscoveryRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export interface RunCharacterDiscoveryStageInput
  extends CharacterDiscoveryRuntimeDeps {
  workflowRunId: string;
  segmentText: string;
  fullBookText?: string;
  characterMemory?: CharacterMemory;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
}

export interface CharacterDiscoveryArtifact {
  kind: "character-memory-draft";
  skillId: "character-extraction";
  characterMemoryDraft: MemoryPatch;
}

interface RunCharacterDiscoveryStageCompletedResult {
  stageRunId: string;
  status: "completed";
  artifact: CharacterDiscoveryArtifact;
}

interface RunCharacterDiscoveryStageNonCompletedResult {
  stageRunId: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunCharacterDiscoveryStageResult =
  | RunCharacterDiscoveryStageCompletedResult
  | RunCharacterDiscoveryStageNonCompletedResult;

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const defaultCharacterExtractionSkillId = "character-extraction";

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

const loadCharacterExtractionPrompts = (skillDir: string) => ({
  systemPrompt: readRequiredFile(path.join(skillDir, "prompts/system.md")),
  userPrompt: readRequiredFile(path.join(skillDir, "prompts/user.md")),
});

interface CharacterExtractionSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const resolveCharacterExtractionSkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
}): CharacterExtractionSkillSource => {
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
    skillId: defaultCharacterExtractionSkillId,
    skillDir: path.join(
      workspaceRoot,
      "skills",
      defaultCharacterExtractionSkillId
    ),
  };
};

const emptyDraft: MemoryPatch = {
  canonicalIdentities: [],
  aliasEvidence: [],
  assertedFacts: {},
  inferredHints: {},
};

const toMemoryPatch = (value: unknown): MemoryPatch => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyDraft;
  }

  const draft = value as MemoryPatch;
  return {
    canonicalIdentities: Array.isArray(draft.canonicalIdentities)
      ? draft.canonicalIdentities
      : [],
    aliasEvidence: Array.isArray(draft.aliasEvidence) ? draft.aliasEvidence : [],
    assertedFacts:
      draft.assertedFacts &&
      typeof draft.assertedFacts === "object" &&
      !Array.isArray(draft.assertedFacts)
        ? draft.assertedFacts
        : {},
    inferredHints:
      draft.inferredHints &&
      typeof draft.inferredHints === "object" &&
      !Array.isArray(draft.inferredHints)
        ? draft.inferredHints
        : {},
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

export const runCharacterDiscoveryStage = async (
  input: RunCharacterDiscoveryStageInput
): Promise<RunCharacterDiscoveryStageResult> => {
  const runtimeAgentId = "character-discovery-agent";
  const skillSource = resolveCharacterExtractionSkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
  });
  const skill = loadSkillDefinition(skillSource.workspaceRoot, skillSource.skillId);
  assertSkillCompatibleWithAgent(
    skill.definition.id,
    skill.definition.compatibleAgents,
    runtimeAgentId
  );
  const prompts = loadCharacterExtractionPrompts(skillSource.skillDir);
  const context = buildAgentContext({
    agentId: runtimeAgentId,
    segmentText: input.segmentText,
    fullBookText: input.fullBookText,
    characterMemory: input.characterMemory,
    budget: {
      maxContextChars: 4000,
      reservedOutputChars: 1200,
    },
  });
  const adapter = await resolveAdapter(input.adapter);
  const agent = createCharacterDiscoveryAgent({
    adapter,
  });

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "character_discovery",
      agent: {
        id: runtimeAgentId,
        execute: async () => {
          const result = await agent.execute({
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
              characterMemoryDraft: result.characterMemoryDraft,
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

  const memoryDraft = toMemoryPatch(stageResult.agent.output?.characterMemoryDraft);

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact: {
      kind: "character-memory-draft",
      skillId: skill.definition.id as "character-extraction",
      characterMemoryDraft: memoryDraft,
    },
  };
};
