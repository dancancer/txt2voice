// 一旦我被更新，请更新我的开头注释
// input: CharacterCandidate/Prisma 事务类型
// output: character utils 共享类型
// pos: script production storage
/**
 * 角色存储共享类型
 */

import type { Prisma } from "@/lib/prisma";

export type CharacterPersistenceClient = Prisma.TransactionClient;

export interface AliasItem {
  alias: string;
}

export interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  characteristics?: any;
  voicePreferences?: any;
  genderHint?: string | null;
  ageHint?: number | null;
  aliases?: AliasItem[];
}

export interface CharacterMemoryLikeIdentity {
  id?: string;
  name?: string;
}

export interface CharacterMemoryLikeAliasEvidence {
  alias?: string;
  canonicalId?: string;
}

export interface CharacterMemoryLike {
  canonicalIdentities?: CharacterMemoryLikeIdentity[];
  aliasEvidence?: CharacterMemoryLikeAliasEvidence[];
  assertedFacts?: Record<string, unknown>;
  inferredHints?: Record<string, unknown>;
}
