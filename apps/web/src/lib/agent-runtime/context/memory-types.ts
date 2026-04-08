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

interface CharacterProfileSeed {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
  characteristics?: {
    description?: string;
    personality?: string[];
    importance?: string;
  };
  voicePreferences?: {
    dialogueStyle?: string;
  };
  genderHint?: string | null;
  ageHint?: number | null;
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

const toNonEmptyText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const buildProfileAssertedFacts = (
  profile: CharacterProfileSeed
): Record<string, unknown> => {
  const facts: Record<string, unknown> = {};
  const description = toNonEmptyText(profile.characteristics?.description);
  const personality = toStringList(profile.characteristics?.personality);
  const importance = toNonEmptyText(profile.characteristics?.importance);
  const dialogueStyle = toNonEmptyText(profile.voicePreferences?.dialogueStyle);
  const gender = toNonEmptyText(profile.genderHint);
  const age =
    typeof profile.ageHint === "number" && Number.isFinite(profile.ageHint)
      ? profile.ageHint
      : null;

  if (description) {
    facts.description = description;
  }
  if (personality.length > 0) {
    facts.personality = personality;
  }
  if (importance) {
    facts.importance = importance;
  }
  if (dialogueStyle) {
    facts.dialogueStyle = dialogueStyle;
  }
  if (gender) {
    facts.gender = gender;
  }
  if (age !== null) {
    facts.age = age;
  }

  return facts;
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

export const buildCharacterMemoryFromProfiles = (
  profiles: CharacterProfileSeed[]
): CharacterMemory => {
  const canonicalIdentities: CharacterCanonicalIdentity[] = [];
  const aliasEvidence: CharacterAliasEvidence[] = [];
  const assertedFacts: Record<string, unknown> = {};
  const seenCanonicalIds = new Set<string>();
  const seenAliasKeys = new Set<string>();

  for (const profile of profiles) {
    const canonicalId =
      typeof profile.id === "string" && profile.id.trim().length > 0
        ? profile.id.trim()
        : "";
    const canonicalName =
      typeof profile.canonicalName === "string"
        ? profile.canonicalName.trim()
        : "";

    if (!canonicalId || !canonicalName || seenCanonicalIds.has(canonicalId)) {
      continue;
    }

    seenCanonicalIds.add(canonicalId);
    canonicalIdentities.push({
      id: canonicalId,
      name: canonicalName,
    });

    const facts = buildProfileAssertedFacts(profile);
    if (Object.keys(facts).length > 0) {
      assertedFacts[canonicalId] = facts;
    }

    for (const aliasItem of profile.aliases || []) {
      const alias =
        typeof aliasItem?.alias === "string" ? aliasItem.alias.trim() : "";
      const aliasKey = `${canonicalId}::${alias}`;

      if (!alias || seenAliasKeys.has(aliasKey)) {
        continue;
      }

      seenAliasKeys.add(aliasKey);
      aliasEvidence.push({
        alias,
        canonicalId,
        source: `profile:${canonicalId}`,
      });
    }
  }

  return {
    canonicalIdentities,
    aliasEvidence,
    assertedFacts,
    inferredHints: {},
  };
};
