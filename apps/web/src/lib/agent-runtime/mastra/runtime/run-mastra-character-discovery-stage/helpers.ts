// 一旦我被更新，请更新我的开头注释
// input: character discovery stage 输入/已有角色记忆
// output: mastra character discovery 辅助函数
// pos: agent runtime mastra
import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../../adapters/llm-adapter";
import type { CharacterMemory, MemoryPatch } from "../../../context";

interface CharacterExtractionSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

export const defaultCharacterExtractionSkillId = "character-extraction";

export const createRuntimeId = () =>
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

export const resolveCharacterExtractionSkillSource = (params: {
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

export const toMemoryPatch = (value: unknown): MemoryPatch => {
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

export const reconcileCharacterMemoryDraft = (
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

export const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../../adapters/llm-adapter");
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

export const isRetryableCharacterDiscoveryError = (message: string): boolean =>
  message.startsWith("Invalid character discovery payload");

export const resolveCharacterDiscoveryFailureState = (error: unknown) =>
  isRetryableCharacterDiscoveryError(asErrorMessage(error)) ? "retrying" : "failed";
