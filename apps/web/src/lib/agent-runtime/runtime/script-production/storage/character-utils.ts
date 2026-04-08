import prisma, { Prisma } from "@/lib/prisma";
import type { CharacterCandidate } from "../types";

type CharacterPersistenceClient = Prisma.TransactionClient;

interface AliasItem {
  alias: string;
}

interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  characteristics?: any;
  voicePreferences?: any;
  genderHint?: string | null;
  ageHint?: number | null;
  aliases?: AliasItem[];
}

const mergeAliasList = (
  left: AliasItem[] | undefined,
  right: AliasItem[] | undefined
): AliasItem[] => {
  const aliasSet = new Set<string>();
  const merged: AliasItem[] = [];

  for (const item of [...(left || []), ...(right || [])]) {
    const alias = typeof item?.alias === "string" ? item.alias.trim() : "";
    if (!alias || aliasSet.has(alias)) {
      continue;
    }
    aliasSet.add(alias);
    merged.push({ alias });
  }

  return merged;
};

const mergeCharacterProfile = (
  base: CharacterProfileLike,
  incoming: CharacterProfileLike
): CharacterProfileLike => ({
  ...base,
  ...incoming,
  aliases: mergeAliasList(base.aliases, incoming.aliases),
});

const mergeCharacterProfiles = (
  seedProfiles: CharacterProfileLike[],
  databaseProfiles: CharacterProfileLike[]
): CharacterProfileLike[] => {
  const mergedProfiles: CharacterProfileLike[] = [...seedProfiles];

  for (const dbProfile of databaseProfiles) {
    const existingIndex = mergedProfiles.findIndex(
      (profile) =>
        (dbProfile.id && profile.id === dbProfile.id) ||
        (dbProfile.canonicalName &&
          profile.canonicalName === dbProfile.canonicalName)
    );

    if (existingIndex < 0) {
      mergedProfiles.push(dbProfile);
      continue;
    }

    mergedProfiles[existingIndex] = mergeCharacterProfile(
      mergedProfiles[existingIndex],
      dbProfile
    );
  }

  return mergedProfiles;
};

interface CharacterMemoryLikeIdentity {
  id?: string;
  name?: string;
}

interface CharacterMemoryLikeAliasEvidence {
  alias?: string;
  canonicalId?: string;
}

interface CharacterMemoryLike {
  canonicalIdentities?: CharacterMemoryLikeIdentity[];
  aliasEvidence?: CharacterMemoryLikeAliasEvidence[];
  assertedFacts?: Record<string, unknown>;
  inferredHints?: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const pickNonEmptyText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return undefined;
};

const normalizeGender = (value: unknown): CharacterCandidate["gender"] => {
  if (value === "male" || value === "female" || value === "unknown") {
    return value;
  }

  return "unknown";
};

const normalizeImportance = (value: unknown): CharacterCandidate["importance"] => {
  if (value === "main" || value === "secondary" || value === "minor") {
    return value;
  }

  return "minor";
};

const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
};

const normalizeCandidateAge = (
  assertedAge: unknown,
  inferredAge: unknown
): CharacterCandidate["age"] => {
  const candidate = assertedAge ?? inferredAge;

  if (
    candidate === null ||
    candidate === undefined ||
    typeof candidate === "string" ||
    typeof candidate === "number"
  ) {
    return candidate ?? null;
  }

  return null;
};

export function mapCharacterMemoryToCandidates(
  memory: CharacterMemoryLike
): CharacterCandidate[] {
  const canonicalIdentities = Array.isArray(memory.canonicalIdentities)
    ? memory.canonicalIdentities
    : [];
  const aliasEvidence = Array.isArray(memory.aliasEvidence) ? memory.aliasEvidence : [];
  const assertedFacts = asRecord(memory.assertedFacts) || {};
  const inferredHints = asRecord(memory.inferredHints) || {};

  const aliasesByCanonicalId = new Map<string, string[]>();
  for (const item of aliasEvidence) {
    const canonicalId =
      typeof item.canonicalId === "string" ? item.canonicalId.trim() : "";
    const alias = typeof item.alias === "string" ? item.alias.trim() : "";
    if (!canonicalId || !alias) {
      continue;
    }

    const bucket = aliasesByCanonicalId.get(canonicalId) || [];
    if (!bucket.includes(alias)) {
      bucket.push(alias);
      aliasesByCanonicalId.set(canonicalId, bucket);
    }
  }

  const seenNames = new Set<string>();
  const candidates: CharacterCandidate[] = [];

  for (const identity of canonicalIdentities) {
    const canonicalId = typeof identity.id === "string" ? identity.id.trim() : "";
    const name = typeof identity.name === "string" ? identity.name.trim() : "";
    if (!canonicalId || !name || name === "旁白" || seenNames.has(name)) {
      continue;
    }

    seenNames.add(name);

    const assertedBucket = asRecord(assertedFacts[canonicalId]) || {};
    const inferredBucket = asRecord(inferredHints[canonicalId]) || {};
    const personality = [
      ...toStringList(assertedBucket.personality),
      ...toStringList(inferredBucket.personality),
    ];

    candidates.push({
      name,
      aliases: aliasesByCanonicalId.get(canonicalId) || [],
      description: pickNonEmptyText(
        assertedBucket.description,
        inferredBucket.description
      ),
      gender: normalizeGender(assertedBucket.gender ?? inferredBucket.gender),
      age: normalizeCandidateAge(assertedBucket.age, inferredBucket.age),
      personality: [...new Set(personality)],
      importance: normalizeImportance(
        assertedBucket.importance ?? inferredBucket.importance
      ),
      dialogueStyle: pickNonEmptyText(
        assertedBucket.dialogueStyle,
        inferredBucket.dialogueStyle
      ),
    });
  }

  return candidates;
}

export function buildCharacterMap(
  characterProfiles: CharacterProfileLike[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const profile of characterProfiles) {
    addCharacterToMap(map, profile);
  }

  return map;
}

const generateCommonVariations = (name: string): string[] => {
  const variations: string[] = [];

  if (name.length > 2) {
    variations.push(name.slice(0, -1));
    variations.push(name.slice(1));
  }

  if (name.includes("先生") || name.includes("小姐") || name.includes("女士")) {
    variations.push(name.replace(/先生|小姐|女士/g, ""));
  }

  return variations;
};

export function addCharacterToMap(
  map: Map<string, string>,
  profile: { canonicalName?: string; aliases?: Array<{ alias: string }> }
): void {
  if (!profile?.canonicalName) {
    return;
  }

  map.set(profile.canonicalName, profile.canonicalName);

  if (profile.aliases) {
    for (const alias of profile.aliases) {
      if (alias?.alias) {
        map.set(alias.alias, profile.canonicalName);
      }
    }
  }

  const commonVariations = generateCommonVariations(profile.canonicalName);
  for (const variation of commonVariations) {
    map.set(variation, profile.canonicalName);
  }
}

export function normalizeCharacterCandidates(
  rawCandidates: any[]
): CharacterCandidate[] {
  if (!Array.isArray(rawCandidates)) {
    return [];
  }

  return rawCandidates
    .map((candidate): CharacterCandidate | null => {
      const name =
        typeof candidate?.name === "string" ? candidate.name.trim() : "";
      if (!name || name === "旁白") {
        return null;
      }

      const aliases = Array.isArray(candidate?.aliases)
        ? candidate.aliases
            .filter((alias: any) => typeof alias === "string" && alias.trim())
            .map((alias: string) => alias.trim())
        : [];

      const personality = Array.isArray(candidate?.personality)
        ? candidate.personality
            .filter((trait: any) => typeof trait === "string" && trait.trim())
            .map((trait: string) => trait.trim())
        : typeof candidate?.personality === "string" &&
            candidate.personality.trim()
          ? [candidate.personality.trim()]
          : [];

      const gender =
        candidate?.gender === "male" ||
        candidate?.gender === "female" ||
        candidate?.gender === "unknown"
          ? candidate.gender
          : "unknown";

      const importance =
        candidate?.importance === "main" ||
        candidate?.importance === "secondary" ||
        candidate?.importance === "minor"
          ? candidate.importance
          : "minor";

      return {
        name,
        aliases,
        description:
          typeof candidate?.description === "string"
            ? candidate.description.trim()
            : "",
        gender,
        age: candidate?.age ?? null,
        personality,
        importance,
        dialogueStyle:
          typeof candidate?.dialogueStyle === "string"
            ? candidate.dialogueStyle.trim()
            : "",
      };
    })
    .filter((candidate): candidate is CharacterCandidate => candidate !== null);
}

export function resolveCandidateCanonicalName(
  candidate: CharacterCandidate,
  characterMap: Map<string, string>
): string {
  const mapped = characterMap.get(candidate.name);
  if (mapped) {
    return mapped;
  }

  for (const alias of candidate.aliases) {
    const aliasMapped = characterMap.get(alias);
    if (aliasMapped) {
      return aliasMapped;
    }
  }

  return candidate.name;
}

export function parseAgeHint(age: any): number | null {
  if (age === null || age === undefined) {
    return null;
  }

  if (typeof age === "number") {
    return age;
  }

  if (typeof age === "string") {
    const ageStr = age.trim();

    const numberMatch = ageStr.match(/\d+/);
    if (numberMatch) {
      const num = parseInt(numberMatch[0], 10);
      return Number.isNaN(num) ? null : num;
    }

    const rangeMatch = ageStr.match(/(\d+)-?(\d*)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start;
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        return Math.round((start + end) / 2);
      }
    }

    const ageMap: Record<string, number> = {
      儿童: 8,
      少年: 15,
      青年: 25,
      中年: 40,
      老年: 65,
      幼年: 5,
      成年: 30,
      青年人: 25,
      中年人: 40,
      老年人: 65,
    };

    for (const [key, value] of Object.entries(ageMap)) {
      if (ageStr.includes(key)) {
        return value;
      }
    }
  }

  return null;
}

const upsertCharacterCandidatesWithDb = async (params: {
  bookId: string;
  candidates: CharacterCandidate[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  db: CharacterPersistenceClient;
}): Promise<void> => {
  const { bookId, candidates, characterProfiles, characterMap, db } = params;

  if (candidates.length === 0) {
    return;
  }

  const importanceWeight: Record<"main" | "secondary" | "minor", number> = {
    main: 3,
    secondary: 2,
    minor: 1,
  };

  const existingProfiles = await db.characterProfile.findMany({
    where: {
      bookId,
      isActive: true,
    },
    include: {
      aliases: true,
    },
  });
  const runtimeProfiles = mergeCharacterProfiles(
    characterProfiles,
    existingProfiles
  );
  const runtimeMap = new Map(characterMap);
  for (const profile of runtimeProfiles) {
    addCharacterToMap(runtimeMap, profile);
    addCharacterToMap(characterMap, profile);
  }

  for (const candidate of candidates) {
    const canonicalName = resolveCandidateCanonicalName(
      candidate,
      runtimeMap
    ).trim();

    if (!canonicalName || canonicalName === "旁白") {
      continue;
    }

    let profile = runtimeProfiles.find(
      (item) => item.canonicalName === canonicalName
    );

    const aliasSet = new Set(candidate.aliases);
    if (candidate.name && candidate.name !== canonicalName) {
      aliasSet.add(candidate.name);
    }

    if (!profile) {
      const created = await db.characterProfile.create({
        data: {
          bookId,
          canonicalName,
          characteristics: {
            description:
              candidate.description ||
              `台本生成识别的角色：${canonicalName}`,
            personality: candidate.personality,
            importance: candidate.importance || "minor",
            relationships: {},
          },
          voicePreferences: {
            dialogueStyle: candidate.dialogueStyle || "自然",
          },
          genderHint:
            candidate.gender === "male" || candidate.gender === "female"
              ? candidate.gender
              : "unknown",
          ageHint: parseAgeHint(candidate.age),
          emotionBaseline: "neutral",
          isActive: true,
        },
      });

      profile = { ...created, aliases: [] };
      runtimeProfiles.push(profile);
      characterProfiles.push(profile);
    } else {
      const updateData: Record<string, any> = {};
      const characteristics = (profile.characteristics as any) || {};
      const voicePreferences = (profile.voicePreferences as any) || {};
      const nextCharacteristics = { ...characteristics };
      let shouldUpdateCharacteristics = false;

      if (candidate.description && !characteristics.description) {
        nextCharacteristics.description = candidate.description;
        shouldUpdateCharacteristics = true;
      }

      if (
        candidate.personality.length > 0 &&
        (!Array.isArray(characteristics.personality) ||
          characteristics.personality.length === 0)
      ) {
        nextCharacteristics.personality = candidate.personality;
        shouldUpdateCharacteristics = true;
      }

      const currentImportance: "main" | "secondary" | "minor" =
        characteristics.importance === "main" ||
        characteristics.importance === "secondary" ||
        characteristics.importance === "minor"
          ? characteristics.importance
          : "minor";
      const candidateImportance: "main" | "secondary" | "minor" =
        candidate.importance === "main" ||
        candidate.importance === "secondary" ||
        candidate.importance === "minor"
          ? candidate.importance
          : "minor";
      if (importanceWeight[candidateImportance] > importanceWeight[currentImportance]) {
        nextCharacteristics.importance = candidateImportance;
        shouldUpdateCharacteristics = true;
      }

      if (shouldUpdateCharacteristics) {
        updateData.characteristics = nextCharacteristics;
      }

      if (candidate.dialogueStyle && !voicePreferences.dialogueStyle) {
        updateData.voicePreferences = {
          ...voicePreferences,
          dialogueStyle: candidate.dialogueStyle,
        };
      }

      if (
        profile.genderHint === "unknown" &&
        candidate.gender &&
        candidate.gender !== "unknown"
      ) {
        updateData.genderHint = candidate.gender;
      }

      if (profile.ageHint === null || profile.ageHint === undefined) {
        const ageHint = parseAgeHint(candidate.age);
        if (ageHint !== null) {
          updateData.ageHint = ageHint;
        }
      }

      if (Object.keys(updateData).length > 0) {
        const updatedProfile = await db.characterProfile.update({
          where: { id: profile.id },
          data: updateData,
        });
        profile = {
          ...profile,
          ...updatedProfile,
          aliases: profile.aliases,
        };
        const profileIndex = characterProfiles.findIndex(
          (item) => item.id === profile?.id
        );
        if (profileIndex >= 0) {
          characterProfiles[profileIndex] = profile;
        }
        const runtimeProfileIndex = runtimeProfiles.findIndex(
          (item) => item.id === profile?.id
        );
        if (runtimeProfileIndex >= 0) {
          runtimeProfiles[runtimeProfileIndex] = profile;
        }
      }
    }

    if (!profile || !profile.id) {
      continue;
    }

    if (aliasSet.size > 0) {
      const existingAliases = new Set(
        (profile.aliases || []).map((alias: any) => alias.alias)
      );
      const aliasesToCreate = [...aliasSet].filter(
        (alias) => alias && alias !== canonicalName && !existingAliases.has(alias)
      );

      if (aliasesToCreate.length > 0) {
        await db.characterAlias.createMany({
          data: aliasesToCreate.map((alias) => ({
            characterId: profile.id as string,
            alias,
          })),
          skipDuplicates: true,
        });

        profile.aliases = [
          ...(profile.aliases || []),
          ...aliasesToCreate.map((alias) => ({ alias })),
        ];
      }
    }

    addCharacterToMap(characterMap, {
      canonicalName: profile?.canonicalName,
      aliases: profile?.aliases || [],
    });
    addCharacterToMap(runtimeMap, {
      canonicalName: profile?.canonicalName,
      aliases: profile?.aliases || [],
    });
  }
};

export async function upsertCharacterCandidates(params: {
  bookId: string;
  candidates: CharacterCandidate[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  db?: CharacterPersistenceClient;
}): Promise<void> {
  if (params.db) {
    await upsertCharacterCandidatesWithDb({
      ...params,
      db: params.db,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await upsertCharacterCandidatesWithDb({
      ...params,
      db: tx,
    });
  });
}
