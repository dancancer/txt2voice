export interface CharacterCanonicalIdentity {
  id: string;
  name: string;
}

export interface CharacterAliasEvidence {
  alias: string;
  canonicalId: string;
  source: string;
}

export interface CharacterMemory {
  canonicalIdentities: CharacterCanonicalIdentity[];
  aliasEvidence: CharacterAliasEvidence[];
  assertedFacts: Record<string, unknown>;
  inferredHints: Record<string, unknown>;
}

export interface MemoryPatch {
  canonicalIdentities?: CharacterCanonicalIdentity[];
  aliasEvidence?: CharacterAliasEvidence[];
  assertedFacts?: Record<string, unknown>;
  inferredHints?: Record<string, unknown>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const mergeFactsByCanonicalIdentity = (
  baseFacts: Record<string, unknown>,
  patchFacts?: Record<string, unknown>
): Record<string, unknown> => {
  const nextFacts: Record<string, unknown> = { ...baseFacts };

  for (const [canonicalId, patchValue] of Object.entries(patchFacts || {})) {
    const baseValue = nextFacts[canonicalId];

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      nextFacts[canonicalId] = {
        ...baseValue,
        ...patchValue,
      };
      continue;
    }

    nextFacts[canonicalId] = patchValue;
  }

  return nextFacts;
};

export const mergeCharacterMemory = (
  baseMemory: CharacterMemory,
  patch: MemoryPatch
): CharacterMemory => {
  const mergedIdentityMap = new Map(
    baseMemory.canonicalIdentities.map((identity) => [identity.id, identity])
  );

  for (const identity of patch.canonicalIdentities || []) {
    mergedIdentityMap.set(identity.id, identity);
  }

  return {
    canonicalIdentities: [...mergedIdentityMap.values()],
    aliasEvidence: [...baseMemory.aliasEvidence, ...(patch.aliasEvidence || [])],
    assertedFacts: mergeFactsByCanonicalIdentity(
      baseMemory.assertedFacts,
      patch.assertedFacts
    ),
    inferredHints: mergeFactsByCanonicalIdentity(
      baseMemory.inferredHints,
      patch.inferredHints
    ),
  };
};
