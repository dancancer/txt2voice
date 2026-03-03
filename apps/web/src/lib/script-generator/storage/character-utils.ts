import prisma from "@/lib/prisma";
import type { CharacterCandidate } from "../types";

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

export async function upsertCharacterCandidates(params: {
  bookId: string;
  candidates: CharacterCandidate[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
}): Promise<void> {
  const { bookId, candidates, characterProfiles, characterMap } = params;

  if (candidates.length === 0) {
    return;
  }

  const importanceWeight: Record<"main" | "secondary" | "minor", number> = {
    main: 3,
    secondary: 2,
    minor: 1,
  };

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const canonicalName = resolveCandidateCanonicalName(
        candidate,
        characterMap
      ).trim();

      if (!canonicalName || canonicalName === "旁白") {
        continue;
      }

      let profile = characterProfiles.find(
        (item) => item.canonicalName === canonicalName
      );

      const aliasSet = new Set(candidate.aliases);
      if (candidate.name && candidate.name !== canonicalName) {
        aliasSet.add(candidate.name);
      }

      if (!profile) {
        const created = await tx.characterProfile.create({
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
          const updatedProfile = await tx.characterProfile.update({
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
          await tx.characterAlias.createMany({
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
    }
  });
}
