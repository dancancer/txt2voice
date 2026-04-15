// 一旦我被更新，请更新我的开头注释
// input: character discovery 原始 JSON/已有角色记忆
// output: 角色记忆 patch 归一化
// pos: agent runtime
import type {
  CharacterAliasEvidence,
  CharacterCanonicalIdentity,
  CharacterMemory,
  MemoryPatch,
} from "../../context";

interface CanonicalIdentityIndex {
  canonicalIdentities: CharacterCanonicalIdentity[];
  canonicalIdByName: Map<string, string>;
  canonicalIdByInputId: Map<string, string>;
  canonicalIdSet: Set<string>;
  canonicalIdentityById: Map<string, CharacterCanonicalIdentity>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
};

const toCanonicalId = (name: string, index: number): string => {
  const slug = name
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `char-${slug}` : `char-${index + 1}`;
};

const buildCanonicalIdentityIndex = (value: unknown): CanonicalIdentityIndex => {
  if (!Array.isArray(value)) {
    return {
      canonicalIdentities: [],
      canonicalIdByName: new Map(),
      canonicalIdByInputId: new Map(),
      canonicalIdSet: new Set(),
      canonicalIdentityById: new Map(),
    };
  }

  const canonicalIdByName = new Map<string, string>();
  const canonicalIdByInputId = new Map<string, string>();
  const canonicalIdentityById = new Map<string, CharacterCanonicalIdentity>();
  const canonicalIdentities: CharacterCanonicalIdentity[] = [];

  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) continue;
    const name = asText(item.name) ?? asText(item.canonicalName);
    if (!name) continue;
    const existingId = canonicalIdByName.get(name);
    const inputId = asText(item.id);
    if (existingId) {
      if (inputId) canonicalIdByInputId.set(inputId, existingId);
      continue;
    }
    const canonicalId = inputId ?? toCanonicalId(name, index);
    canonicalIdByName.set(name, canonicalId);
    canonicalIdByInputId.set(canonicalId, canonicalId);
    if (inputId) canonicalIdByInputId.set(inputId, canonicalId);
    const canonicalIdentity = { id: canonicalId, name };
    canonicalIdentities.push(canonicalIdentity);
    canonicalIdentityById.set(canonicalId, canonicalIdentity);
  }

  return {
    canonicalIdentities,
    canonicalIdByName,
    canonicalIdByInputId,
    canonicalIdSet: new Set(canonicalIdentities.map((item) => item.id)),
    canonicalIdentityById,
  };
};

const buildExistingCharacterMemoryIndex = (
  memory?: CharacterMemory
): CanonicalIdentityIndex => {
  if (!memory) return buildCanonicalIdentityIndex([]);
  const index = buildCanonicalIdentityIndex(memory.canonicalIdentities);
  for (const evidence of memory.aliasEvidence) {
    const alias = asText(evidence.alias);
    const canonicalId = asText(evidence.canonicalId);
    if (!alias || !canonicalId || !index.canonicalIdSet.has(canonicalId)) continue;
    if (!index.canonicalIdByName.has(alias)) {
      index.canonicalIdByName.set(alias, canonicalId);
    }
  }
  return index;
};

const resolveCanonicalId = (
  rawKey: string,
  primaryIndex: CanonicalIdentityIndex,
  fallbackIndex?: CanonicalIdentityIndex
): string | null => {
  const key = rawKey.trim();
  if (!key) return null;
  return (
    primaryIndex.canonicalIdByName.get(key) ??
    primaryIndex.canonicalIdByInputId.get(key) ??
    (primaryIndex.canonicalIdSet.has(key) ? key : null) ??
    fallbackIndex?.canonicalIdByName.get(key) ??
    fallbackIndex?.canonicalIdByInputId.get(key) ??
    (fallbackIndex?.canonicalIdSet.has(key) ? key : null) ??
    null
  );
};

const normalizeAliasEvidence = (
  value: unknown,
  primaryIndex: CanonicalIdentityIndex,
  fallbackIndex?: CanonicalIdentityIndex
): CharacterAliasEvidence[] => {
  if (!Array.isArray(value)) return [];
  const dedupe = new Set<string>();
  const normalized: CharacterAliasEvidence[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const alias = asText(item.alias);
    if (!alias) continue;
    const canonicalId =
      resolveCanonicalId(asText(item.canonicalId) ?? "", primaryIndex, fallbackIndex) ??
      resolveCanonicalId(asText(item.canonicalName) ?? "", primaryIndex, fallbackIndex);
    if (!canonicalId) continue;
    const source = asText(item.source) ?? "llm";
    const key = `${alias}::${canonicalId}::${source}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    normalized.push({ alias, canonicalId, source });
  }

  return normalized;
};

const normalizeFactBucket = (
  value: unknown,
  primaryIndex: CanonicalIdentityIndex,
  fallbackIndex?: CanonicalIdentityIndex
): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const normalized: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const canonicalId = resolveCanonicalId(rawKey, primaryIndex, fallbackIndex);
    if (!canonicalId) continue;
    const existing = normalized[canonicalId];
    normalized[canonicalId] =
      isRecord(existing) && isRecord(rawValue) ? { ...existing, ...rawValue } : rawValue;
  }

  return normalized;
};

const collectReferencedCanonicalIds = (params: {
  aliasEvidence: CharacterAliasEvidence[];
  assertedFacts: Record<string, unknown>;
  inferredHints: Record<string, unknown>;
}) => {
  const referencedIds = new Set<string>();
  params.aliasEvidence.forEach((evidence) => referencedIds.add(evidence.canonicalId));
  Object.keys(params.assertedFacts).forEach((id) => referencedIds.add(id));
  Object.keys(params.inferredHints).forEach((id) => referencedIds.add(id));
  return referencedIds;
};

const parseObject = (rawText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(rawText);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonPayload = (content: string): Record<string, unknown> => {
  const direct = parseObject(content);
  if (direct) return direct;
  const fencedBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedBlock?.[1]) {
    const fromFence = parseObject(fencedBlock[1]);
    if (fromFence) return fromFence;
  }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const fromBraces = parseObject(content.slice(start, end + 1));
    if (fromBraces) return fromBraces;
  }
  throw new Error("Invalid character discovery payload: expected JSON object");
};

const validatePayloadSchema = (payload: Record<string, unknown>) => {
  if (!Array.isArray(payload.canonicalIdentities)) {
    throw new Error(
      "Invalid character discovery payload: canonicalIdentities must be an array"
    );
  }
  if (!Array.isArray(payload.aliasEvidence)) {
    throw new Error(
      "Invalid character discovery payload: aliasEvidence must be an array"
    );
  }
  if (!isRecord(payload.assertedFacts)) {
    throw new Error(
      "Invalid character discovery payload: assertedFacts must be an object"
    );
  }
  if (!isRecord(payload.inferredHints)) {
    throw new Error(
      "Invalid character discovery payload: inferredHints must be an object"
    );
  }

  for (const [canonicalId, factBucket] of Object.entries(payload.assertedFacts)) {
    if (!isRecord(factBucket)) {
      throw new Error(
        `Invalid character discovery payload: assertedFacts.${canonicalId} must be an object`
      );
    }
  }

  for (const [canonicalId, hintBucket] of Object.entries(payload.inferredHints)) {
    if (!isRecord(hintBucket)) {
      throw new Error(
        `Invalid character discovery payload: inferredHints.${canonicalId} must be an object`
      );
    }
  }

  for (const identity of payload.canonicalIdentities) {
    if (!isRecord(identity)) {
      throw new Error(
        "Invalid character discovery payload: canonicalIdentities entries must be objects with name/canonicalName"
      );
    }
    const name = asText(identity.name) ?? asText(identity.canonicalName);
    if (!name) {
      throw new Error(
        "Invalid character discovery payload: canonicalIdentities entries must include name/canonicalName"
      );
    }
  }

  for (const evidence of payload.aliasEvidence) {
    if (!isRecord(evidence)) {
      throw new Error(
        "Invalid character discovery payload: aliasEvidence entries must be objects with alias and canonical pointer"
      );
    }
    const alias = asText(evidence.alias);
    const canonicalPointer =
      asText(evidence.canonicalId) ?? asText(evidence.canonicalName);
    if (!alias || !canonicalPointer) {
      throw new Error(
        "Invalid character discovery payload: aliasEvidence entries must include alias and canonicalId/canonicalName"
      );
    }
  }
};

export const mapResponseToMemoryPatch = (params: {
  content: string;
  existingCharacterMemory?: CharacterMemory;
}): MemoryPatch => {
  const payload = extractJsonPayload(params.content);
  validatePayloadSchema(payload);
  const identityIndex = buildCanonicalIdentityIndex(payload.canonicalIdentities);
  const existingIndex = buildExistingCharacterMemoryIndex(params.existingCharacterMemory);
  const aliasEvidence = normalizeAliasEvidence(
    payload.aliasEvidence,
    identityIndex,
    existingIndex
  );
  const assertedFacts = normalizeFactBucket(
    payload.assertedFacts,
    identityIndex,
    existingIndex
  );
  const inferredHints = normalizeFactBucket(
    payload.inferredHints,
    identityIndex,
    existingIndex
  );
  const referencedCanonicalIds = collectReferencedCanonicalIds({
    aliasEvidence,
    assertedFacts,
    inferredHints,
  });
  const canonicalIdentityById = new Map(identityIndex.canonicalIdentityById);

  for (const canonicalId of referencedCanonicalIds) {
    if (canonicalIdentityById.has(canonicalId)) continue;
    const existingIdentity = existingIndex.canonicalIdentityById.get(canonicalId);
    if (existingIdentity) canonicalIdentityById.set(canonicalId, existingIdentity);
  }

  return {
    canonicalIdentities: [...canonicalIdentityById.values()],
    aliasEvidence,
    assertedFacts,
    inferredHints,
  };
};
