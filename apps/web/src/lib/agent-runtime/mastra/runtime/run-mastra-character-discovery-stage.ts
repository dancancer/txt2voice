import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import {
  buildAgentContext,
  type CharacterMemory,
  type MemoryPatch,
} from "../../context";
import { createCharacterDiscoveryAgent } from "../../runtime/agents/character-discovery-agent";
import { renderCharacterDiscoveryUserPrompt } from "../../runtime/agents/character-discovery-agent";
import { validateAgentContract } from "../../runtime/agent-contract";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../runtime/load-skill-runtime-bundle";
import {
  fitPromptToBudget,
  preservePromptValueEdges,
  resolvePromptBudgetLimit,
} from "../../runtime/prompt-budget";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../runtime/skill-contract";
import type { TraceDependencies } from "../../runtime/write-trace";
import type {
  CharacterDiscoveryArtifact,
  RunCharacterDiscoveryStageInput,
  RunCharacterDiscoveryStageResult,
} from "../../runtime/stages/run-character-discovery-stage";

interface CharacterDiscoveryRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

interface CharacterExtractionSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const defaultCharacterExtractionSkillId = "character-extraction";

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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
    skillDir: path.join(workspaceRoot, "skills", defaultCharacterExtractionSkillId),
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

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown stage execution error";
};

const isRetryableCharacterDiscoveryError = (message: string): boolean =>
  message.startsWith("Invalid character discovery payload");

export const runMastraCharacterDiscoveryStage = async (
  input: RunCharacterDiscoveryStageInput,
  deps: CharacterDiscoveryRuntimeDeps = {}
): Promise<RunCharacterDiscoveryStageResult> => {
  const runtimeAgentId = "character-discovery-agent";
  const promptBudget = {
    maxContextChars: 4000,
    reservedOutputChars: 1200,
  } as const;

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "character_discovery",
      agent: {
        id: runtimeAgentId,
        resolveFailure: ({ error }) => {
          const message = asErrorMessage(error);
          return isRetryableCharacterDiscoveryError(message)
            ? "retrying"
            : "failed";
        },
        execute: async () => {
          const skillSource = resolveCharacterExtractionSkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillRuntimeBundle(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          const agentContract = validateAgentContract({
            workspaceRoot: skillSource.workspaceRoot,
            agentSourceId: "character-discovery",
            stageId: "character_discovery",
            skill: skill.definition,
            registeredTools: [],
          });
          validateSkillContract({
            skill: skill.definition,
            agentId: runtimeAgentId,
            expectedContextRequirements: ["segment", "character_memory_summary"],
            expectedInputSchemaRef: "character-input",
            expectedOutputSchemaRef: "character-output",
          });
          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            fullBookText: input.fullBookText,
            characterMemory: input.characterMemory,
            budget: promptBudget,
          });
          const runtimeSystemPrompt = composeRuntimeSystemPrompt({
            agentInstructions: agentContract.agentInstructions,
            skillInstructions: skill.instructions,
            systemPrompt: skill.systemPrompt,
          });
          const promptBudgetResult = fitPromptToBudget({
            systemPrompt: runtimeSystemPrompt,
            maxPromptChars: resolvePromptBudgetLimit(promptBudget),
            variables: {
              segment_text:
                typeof context.inputContext.segmentText === "string"
                  ? context.inputContext.segmentText
                  : "",
              character_memory_summary:
                context.referenceMemory.characterMemorySummary,
            },
            trimOrder: ["character_memory_summary", "segment_text"],
            renderPrompt: (variables) =>
              renderCharacterDiscoveryUserPrompt(skill.userPrompt, {
                segmentText: variables.segment_text,
                characterMemorySummary: variables.character_memory_summary,
              }),
          });
          const segmentTextWasTrimmed =
            promptBudgetResult.trimmedKeys.includes("segment_text") &&
            promptBudgetResult.variables.segment_text.length > 0;
          const segmentText =
            segmentTextWasTrimmed &&
            typeof context.inputContext.segmentText === "string"
              ? preservePromptValueEdges(
                  context.inputContext.segmentText,
                  promptBudgetResult.variables.segment_text.length
                )
              : promptBudgetResult.variables.segment_text;
          const renderedUserPrompt = segmentTextWasTrimmed
            ? renderCharacterDiscoveryUserPrompt(skill.userPrompt, {
                segmentText,
                characterMemorySummary:
                  promptBudgetResult.variables.character_memory_summary,
              })
            : promptBudgetResult.prompt;
          if (promptBudgetResult.overBudget) {
            throw new Error(
              "Input context over budget for character discovery stage"
            );
          }

          const adapter = await resolveAdapter(input.adapter);
          const agent = createCharacterDiscoveryAgent({ adapter });
          const result = await agent.execute({
            segmentText,
            characterMemorySummary:
              promptBudgetResult.variables.character_memory_summary,
            existingCharacterMemory: input.characterMemory,
            modelPolicy: skill.definition.modelPolicy!,
            renderedUserPrompt,
            prompts: {
              systemPrompt: runtimeSystemPrompt,
              userPrompt: skill.userPrompt,
            },
          });
          const skillMetadata = buildSkillMetadataSnapshot(skill.definition, {
            runtimeSystemPrompt,
            systemPrompt: skill.systemPrompt,
            userPrompt: skill.userPrompt,
          });
          const reconciledDraft = reconcileCharacterMemoryDraft(
            result.characterMemoryDraft,
            input.characterMemory
          );

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              skillMetadata,
              characterMemoryDraft: reconciledDraft,
              provider: result.provider,
              model: result.model,
            },
          };
        },
      },
    },
    createId: deps.createId ?? input.createId ?? createRuntimeId,
    appendTrace:
      deps.appendTrace ?? input.appendTrace ?? (async () => undefined),
    now: deps.now ?? input.now,
    createStageRun:
      deps.createStageRun ?? input.createStageRun ?? (async () => undefined),
    updateStageRun: deps.updateStageRun ?? input.updateStageRun,
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      status: stageResult.status,
      error: stageResult.agent.error,
      failedArtifact: stageResult.agent.output?.failedArtifact,
    };
  }

  const memoryDraft = toMemoryPatch(stageResult.agent.output?.characterMemoryDraft);
  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultCharacterExtractionSkillId;

  const artifact: CharacterDiscoveryArtifact = {
    kind: "character-memory-draft",
    skillId: skillId as "character-extraction",
    characterMemoryDraft: memoryDraft,
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
  };

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact,
  };
};
