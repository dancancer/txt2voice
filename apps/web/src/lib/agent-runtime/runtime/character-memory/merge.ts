import type { MemoryPatch } from "../../context";
import type { CharacterMemoryPatchMergeResult, CharacterMemorySnapshot } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

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

const mergeFactBuckets = (
  base: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> => {
  const merged = { ...base };

  for (const [canonicalId, value] of Object.entries(incoming)) {
    merged[canonicalId] = mergeBucketValue(merged[canonicalId], value);
  }

  return merged;
};

export const mergeCharacterMemoryPatch = (params: {
  snapshot: CharacterMemorySnapshot;
  patch: MemoryPatch;
}): CharacterMemoryPatchMergeResult => {
  const { snapshot, patch } = params;
  const canonicalIdByName = new Map(
    snapshot.canonicalIdentities.map((identity) => [identity.name.trim(), identity.id.trim()])
  );
  const canonicalIdByAlias = new Map(
    snapshot.aliasEvidence.map((evidence) => [evidence.alias.trim(), evidence.canonicalId.trim()])
  );
  const canonicalIdentityById = new Map(
    snapshot.canonicalIdentities.map((identity) => [identity.id.trim(), identity])
  );
  const remap = new Map<string, string>();

  for (const identity of patch.canonicalIdentities || []) {
    const incomingId = typeof identity.id === "string" ? identity.id.trim() : "";
    const incomingName =
      typeof identity.name === "string" ? identity.name.trim() : "";

    if (!incomingId || !incomingName) {
      continue;
    }

    const existingCanonicalId =
      canonicalIdByName.get(incomingName) ?? canonicalIdByAlias.get(incomingName);

    remap.set(incomingId, existingCanonicalId ?? incomingId);

    if (!existingCanonicalId) {
      canonicalIdentityById.set(incomingId, {
        id: incomingId,
        name: incomingName,
      });
      canonicalIdByName.set(incomingName, incomingId);
    }
  }

  const aliasEvidence = [...snapshot.aliasEvidence];
  const seenAliasKeys = new Set(
    aliasEvidence.map(
      (entry) => `${entry.alias.trim()}::${entry.canonicalId.trim()}::${entry.source.trim()}`
    )
  );

  for (const evidence of patch.aliasEvidence || []) {
    const alias = typeof evidence.alias === "string" ? evidence.alias.trim() : "";
    const source =
      typeof evidence.source === "string" ? evidence.source.trim() : "";
    const incomingCanonicalId =
      typeof evidence.canonicalId === "string" ? evidence.canonicalId.trim() : "";

    if (!alias || !source || !incomingCanonicalId) {
      continue;
    }

    const canonicalId =
      canonicalIdByAlias.get(alias) ??
      remap.get(incomingCanonicalId) ??
      incomingCanonicalId;

    const aliasKey = `${alias}::${canonicalId}::${source}`;
    if (seenAliasKeys.has(aliasKey)) {
      continue;
    }

    seenAliasKeys.add(aliasKey);
    aliasEvidence.push({
      alias,
      canonicalId,
      source,
    });
    if (!canonicalIdByAlias.has(alias)) {
      canonicalIdByAlias.set(alias, canonicalId);
    }
  }

  const canonicalIdentities = [...canonicalIdentityById.values()];

  return {
    canonicalIdentities,
    aliasEvidence,
    assertedFacts: mergeFactBuckets(
      snapshot.assertedFacts,
      remapFactBucket(patch.assertedFacts || {}, remap)
    ),
    inferredHints: mergeFactBuckets(
      snapshot.inferredHints,
      remapFactBucket(patch.inferredHints || {}, remap)
    ),
  };
};
