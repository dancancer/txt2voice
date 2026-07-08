// 一旦我被更新，请更新我的开头注释
// input: 角色记忆/角色档案/候选角色
// output: 角色映射与候选构建结果
// pos: script production storage
/**
 * 角色候选与映射工具
 */

import { generateCommonCharacterNameVariations } from "@/lib/agent-runtime/runtime/character-name-variations";
import type { CharacterCandidate } from "../../types";
import {
  asRecord,
  normalizeCandidateAge,
  normalizeGender,
  normalizeImportance,
  pickNonEmptyText,
  toStringList,
} from "./normalize";
import type { CharacterMemoryLike, CharacterProfileLike } from "./types";

export function mapCharacterMemoryToCandidates(
  memory: CharacterMemoryLike
): CharacterCandidate[] {
  const canonicalIdentities = Array.isArray(memory.canonicalIdentities)
    ? memory.canonicalIdentities
    : [];
  const aliasEvidence = Array.isArray(memory.aliasEvidence)
    ? memory.aliasEvidence
    : [];
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

  const commonVariations = generateCommonCharacterNameVariations(
    profile.canonicalName
  );

  for (const variation of commonVariations) {
    map.set(variation, profile.canonicalName);
  }
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
