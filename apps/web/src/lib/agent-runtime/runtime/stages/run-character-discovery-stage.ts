import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import { buildAgentContext, type CharacterMemory, type MemoryPatch } from "../../context";
import type { StageExecutor } from "../executor-policy";
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
  executor?: StageExecutor;
  shadowMode?: boolean;
  runMastraCharacterDiscoveryStage?: (
    input: RunCharacterDiscoveryStageInput
  ) => Promise<RunCharacterDiscoveryStageResult>;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

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

const mergeBucketValue = (existing: unknown, incoming: unknown): unknown => {
  if (isRecord(existing) && isRecord(incoming)) {
    return {
      ...existing,
      ...incoming,
    };
  }

  return incoming;
};

const remapFactBucket = (
  bucket: Record<string, unknown>,
  remap: Map<string, string>
): Record<string, unknown> => {
  const remapped: Record<string, unknown> = {};

  for (const [rawKey, value] of Object.entries(bucket)) {
    const canonicalId = remap.get(rawKey) ?? rawKey;
    remapped[canonicalId] = mergeBucketValue(remapped[canonicalId], value);
  }

  return remapped;
};

const reconcileCharacterMemoryDraft = (
  draft: MemoryPatch,
  characterMemory?: CharacterMemory
): MemoryPatch => {
  if (!characterMemory || characterMemory.canonicalIdentities.length === 0) {
    return draft;
  }

  const existingCanonicalIdByName = new Map<string, string>();
  const existingCanonicalIdByAlias = new Map<string, string>();
  const existingCanonicalNameById = new Map<string, string>();
  for (const identity of characterMemory.canonicalIdentities) {
    const canonicalId = identity.id.trim();
    const name = identity.name.trim();
    if (canonicalId && !existingCanonicalNameById.has(canonicalId)) {
      existingCanonicalNameById.set(canonicalId, name);
    }

    if (name && !existingCanonicalIdByName.has(name)) {
      existingCanonicalIdByName.set(name, canonicalId);
    }
  }

  for (const evidence of characterMemory.aliasEvidence) {
    const alias = evidence.alias.trim();
    const canonicalId = evidence.canonicalId.trim();
    if (!alias || !canonicalId || existingCanonicalIdByAlias.has(alias)) {
      continue;
    }

    existingCanonicalIdByAlias.set(alias, canonicalId);
  }

  const resolveExistingCanonicalId = (nameOrAlias: string): string | undefined =>
    existingCanonicalIdByName.get(nameOrAlias) ??
    existingCanonicalIdByAlias.get(nameOrAlias);

  const remap = new Map<string, string>();
  const incomingCanonicalIdentities: Array<{ id: string; name: string }> = [];

  for (const identity of draft.canonicalIdentities || []) {
    const incomingId =
      typeof identity.id === "string" ? identity.id.trim() : "";
    const incomingName =
      typeof identity.name === "string" ? identity.name.trim() : "";
    if (!incomingId || !incomingName) {
      continue;
    }

    incomingCanonicalIdentities.push({
      id: incomingId,
      name: incomingName,
    });

    const canonicalId = resolveExistingCanonicalId(incomingName) ?? incomingId;
    remap.set(incomingId, canonicalId);
  }

  const aliasDedup = new Set<string>();
  const aliasEvidence: Array<{
    alias: string;
    canonicalId: string;
    source: string;
  }> = [];
  for (const evidence of draft.aliasEvidence || []) {
    const alias = typeof evidence.alias === "string" ? evidence.alias : "";
    const source = typeof evidence.source === "string" ? evidence.source : "";
    const incomingCanonicalId =
      typeof evidence.canonicalId === "string" ? evidence.canonicalId : "";
    if (!alias || !source || !incomingCanonicalId) {
      continue;
    }

    const canonicalIdFromAlias = existingCanonicalIdByAlias.get(alias);
    const canonicalId =
      canonicalIdFromAlias ??
      remap.get(incomingCanonicalId) ??
      incomingCanonicalId;
    if (canonicalIdFromAlias) {
      remap.set(incomingCanonicalId, canonicalIdFromAlias);
    }

    const key = `${alias}::${canonicalId}::${source}`;
    if (aliasDedup.has(key)) {
      continue;
    }

    aliasDedup.add(key);
    aliasEvidence.push({
      alias,
      canonicalId,
      source,
    });
  }

  const canonicalIdentityById = new Map<string, { id: string; name: string }>();
  const canonicalIdentities: { id: string; name: string }[] = [];
  for (const identity of incomingCanonicalIdentities) {
    const canonicalId = remap.get(identity.id) ?? identity.id;
    if (canonicalIdentityById.has(canonicalId)) {
      continue;
    }

    const canonicalIdentity = {
      id: canonicalId,
      name: existingCanonicalNameById.get(canonicalId) ?? identity.name,
    };
    canonicalIdentityById.set(canonicalId, canonicalIdentity);
    canonicalIdentities.push(canonicalIdentity);
  }

  return {
    canonicalIdentities,
    aliasEvidence,
    assertedFacts: remapFactBucket(draft.assertedFacts || {}, remap),
    inferredHints: remapFactBucket(draft.inferredHints || {}, remap),
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

export const runCharacterDiscoveryStageNative = async (
  input: RunCharacterDiscoveryStageInput
): Promise<RunCharacterDiscoveryStageResult> => {
  const runtimeAgentId = "character-discovery-agent";

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "character_discovery",
      agent: {
        id: runtimeAgentId,
        execute: async () => {
          const skillSource = resolveCharacterExtractionSkillSource({
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
          const result = await agent.execute({
            segmentText:
              typeof context.inputContext.segmentText === "string"
                ? context.inputContext.segmentText
                : "",
            characterMemorySummary: context.referenceMemory.characterMemorySummary,
            prompts,
          });
          const reconciledDraft = reconcileCharacterMemoryDraft(
            result.characterMemoryDraft,
            input.characterMemory
          );

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              characterMemoryDraft: reconciledDraft,
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
  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultCharacterExtractionSkillId;

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact: {
      kind: "character-memory-draft",
      skillId: skillId as "character-extraction",
      characterMemoryDraft: memoryDraft,
    },
  };
};

const buildShadowInput = (
  input: RunCharacterDiscoveryStageInput
): RunCharacterDiscoveryStageInput => ({
  ...input,
  createStageRun: undefined,
  updateStageRun: undefined,
  appendTrace: async () => undefined,
});

export const runCharacterDiscoveryStage = async (
  input: RunCharacterDiscoveryStageInput
): Promise<RunCharacterDiscoveryStageResult> => {
  const runMastraCharacterDiscoveryStage =
    input.runMastraCharacterDiscoveryStage ??
    (
      await import("../../mastra/runtime/run-mastra-character-discovery")
    ).runMastraCharacterDiscovery;

  if (input.executor === "mastra") {
    return runMastraCharacterDiscoveryStage(input);
  }

  if (input.shadowMode) {
    const nativePromise = runCharacterDiscoveryStageNative(input);
    const shadowPromise = runMastraCharacterDiscoveryStage(
      buildShadowInput(input)
    );
    const [nativeResult] = await Promise.all([
      nativePromise,
      shadowPromise.catch(() => null),
    ]);

    return nativeResult;
  }

  return runCharacterDiscoveryStageNative(input);
};
