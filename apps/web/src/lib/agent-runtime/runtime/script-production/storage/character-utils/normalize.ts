// 一旦我被更新，请更新我的开头注释
// input: 原始角色候选/记忆片段
// output: 归一化后的角色数据与基础工具
// pos: script production storage
/**
 * 角色数据归一化工具
 */

import { normalizeCharacterDiscoveryGender } from "@/lib/agent-runtime/runtime/contracts/character-discovery";
import type { CharacterCandidate } from "../../types";
import type { AliasItem, CharacterProfileLike } from "./types";

export const mergeAliasList = (
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

export const mergeCharacterProfiles = (
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

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const pickNonEmptyText = (...values: unknown[]): string | undefined => {
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

export const normalizeGender = (
  value: unknown
): CharacterCandidate["gender"] => {
  return normalizeCharacterDiscoveryGender(value);
};

export const normalizeImportance = (
  value: unknown
): CharacterCandidate["importance"] => {
  if (value === "main" || value === "secondary" || value === "minor") {
    return value;
  }

  return "minor";
};

export const toStringList = (value: unknown): string[] => {
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

export const normalizeCandidateAge = (
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

      return {
        name,
        aliases,
        description:
          typeof candidate?.description === "string"
            ? candidate.description.trim()
            : "",
        gender: normalizeGender(candidate?.gender),
        age: candidate?.age ?? null,
        personality,
        importance: normalizeImportance(candidate?.importance),
        dialogueStyle:
          typeof candidate?.dialogueStyle === "string"
            ? candidate.dialogueStyle.trim()
            : "",
      };
    })
    .filter((candidate): candidate is CharacterCandidate => candidate !== null);
}

export function parseAgeHint(age: any): number | null {
  if (age === null || age === undefined) {
    return null;
  }

  if (typeof age === "number") {
    return age;
  }

  if (typeof age !== "string") {
    return null;
  }

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

  return null;
}
