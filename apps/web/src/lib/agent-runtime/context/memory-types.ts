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
    assertedFacts: {
      ...baseMemory.assertedFacts,
      ...(patch.assertedFacts || {}),
    },
    inferredHints: {
      ...baseMemory.inferredHints,
      ...(patch.inferredHints || {}),
    },
  };
};
