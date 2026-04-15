// 一旦我被更新，请更新我的开头注释
// input: 角色候选/角色档案/事务客户端
// output: 角色 upsert 持久化能力
// pos: script production storage
/**
 * 角色候选持久化
 */

import prisma from "@/lib/prisma";
import type { CharacterCandidate } from "../../types";
import { addCharacterToMap, resolveCandidateCanonicalName } from "./mapping";
import { mergeCharacterProfiles, parseAgeHint } from "./normalize";
import type {
  CharacterPersistenceClient,
  CharacterProfileLike,
} from "./types";

const IMPORTANCE_WEIGHT: Record<"main" | "secondary" | "minor", number> = {
  main: 3,
  secondary: 2,
  minor: 1,
};

async function loadRuntimeProfiles(params: {
  bookId: string;
  db: CharacterPersistenceClient;
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
}) {
  const existingProfiles = await params.db.characterProfile.findMany({
    where: {
      bookId: params.bookId,
      isActive: true,
    },
    include: {
      aliases: true,
    },
  });

  const runtimeProfiles = mergeCharacterProfiles(
    params.characterProfiles,
    existingProfiles
  );
  const runtimeMap = new Map(params.characterMap);

  for (const profile of runtimeProfiles) {
    addCharacterToMap(runtimeMap, profile);
    addCharacterToMap(params.characterMap, profile);
  }

  return { runtimeProfiles, runtimeMap };
}

async function createProfile(params: {
  bookId: string;
  candidate: CharacterCandidate;
  canonicalName: string;
  db: CharacterPersistenceClient;
}): Promise<CharacterProfileLike> {
  const created = await params.db.characterProfile.create({
    data: {
      bookId: params.bookId,
      canonicalName: params.canonicalName,
      characteristics: {
        description:
          params.candidate.description ||
          `台本生成识别的角色：${params.canonicalName}`,
        personality: params.candidate.personality,
        importance: params.candidate.importance || "minor",
        relationships: {},
      },
      voicePreferences: {
        dialogueStyle: params.candidate.dialogueStyle || "自然",
      },
      genderHint:
        params.candidate.gender === "male" ||
        params.candidate.gender === "female"
          ? params.candidate.gender
          : "unknown",
      ageHint: parseAgeHint(params.candidate.age),
      emotionBaseline: "neutral",
      isActive: true,
    },
  });

  return {
    ...created,
    aliases: [],
  };
}

async function updateProfileIfNeeded(params: {
  candidate: CharacterCandidate;
  profile: CharacterProfileLike;
  db: CharacterPersistenceClient;
  runtimeProfiles: CharacterProfileLike[];
  characterProfiles: CharacterProfileLike[];
}): Promise<CharacterProfileLike> {
  const { candidate, db, runtimeProfiles, characterProfiles } = params;
  let { profile } = params;
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

  if (IMPORTANCE_WEIGHT[candidateImportance] > IMPORTANCE_WEIGHT[currentImportance]) {
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

  if (Object.keys(updateData).length === 0) {
    return profile;
  }

  const updatedProfile = await db.characterProfile.update({
    where: { id: profile.id },
    data: updateData,
  });

  profile = {
    ...profile,
    ...updatedProfile,
    aliases: profile.aliases,
  };

  syncProfileById(characterProfiles, profile);
  syncProfileById(runtimeProfiles, profile);
  return profile;
}

function syncProfileById(
  profiles: CharacterProfileLike[],
  profile: CharacterProfileLike
) {
  const profileIndex = profiles.findIndex((item) => item.id === profile?.id);
  if (profileIndex >= 0) {
    profiles[profileIndex] = profile;
  }
}

async function syncAliases(params: {
  profile: CharacterProfileLike;
  canonicalName: string;
  aliasSet: Set<string>;
  db: CharacterPersistenceClient;
}) {
  if (!params.profile.id || params.aliasSet.size === 0) {
    return;
  }

  const existingAliases = new Set(
    (params.profile.aliases || []).map((alias: any) => alias.alias)
  );
  const aliasesToCreate = [...params.aliasSet].filter(
    (alias) =>
      alias &&
      alias !== params.canonicalName &&
      !existingAliases.has(alias)
  );

  if (aliasesToCreate.length === 0) {
    return;
  }

  await params.db.characterAlias.createMany({
    data: aliasesToCreate.map((alias) => ({
      characterId: params.profile.id as string,
      alias,
    })),
    skipDuplicates: true,
  });

  params.profile.aliases = [
    ...(params.profile.aliases || []),
    ...aliasesToCreate.map((alias) => ({ alias })),
  ];
}

async function upsertCharacterCandidatesWithDb(params: {
  bookId: string;
  candidates: CharacterCandidate[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  db: CharacterPersistenceClient;
}): Promise<void> {
  const { bookId, candidates, characterProfiles, characterMap, db } = params;

  if (candidates.length === 0) {
    return;
  }

  const { runtimeProfiles, runtimeMap } = await loadRuntimeProfiles({
    bookId,
    db,
    characterProfiles,
    characterMap,
  });

  for (const candidate of candidates) {
    const canonicalName = resolveCandidateCanonicalName(
      candidate,
      runtimeMap
    ).trim();

    if (!canonicalName || canonicalName === "旁白") {
      continue;
    }

    const aliasSet = new Set(candidate.aliases);
    if (candidate.name && candidate.name !== canonicalName) {
      aliasSet.add(candidate.name);
    }

    let profile =
      runtimeProfiles.find((item) => item.canonicalName === canonicalName) ||
      null;

    if (!profile) {
      profile = await createProfile({
        bookId,
        candidate,
        canonicalName,
        db,
      });
      runtimeProfiles.push(profile);
      characterProfiles.push(profile);
    } else {
      profile = await updateProfileIfNeeded({
        candidate,
        profile,
        db,
        runtimeProfiles,
        characterProfiles,
      });
    }

    if (!profile?.id) {
      continue;
    }

    await syncAliases({
      profile,
      canonicalName,
      aliasSet,
      db,
    });

    addCharacterToMap(characterMap, {
      canonicalName: profile.canonicalName,
      aliases: profile.aliases || [],
    });
    addCharacterToMap(runtimeMap, {
      canonicalName: profile.canonicalName,
      aliases: profile.aliases || [],
    });
  }
}

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
