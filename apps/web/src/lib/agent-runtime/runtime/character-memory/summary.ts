import type { CharacterMemorySnapshot } from "./types";

const unique = (values: string[]): string[] => [...new Set(values)];

export const buildCharacterMemorySummary = (
  snapshot: CharacterMemorySnapshot
): string =>
  JSON.stringify({
    version: snapshot.version,
    characters: snapshot.canonicalIdentities.map((identity) => ({
      id: identity.id,
      name: identity.name,
      aliases: snapshot.derivedMaps.aliasSetByCanonicalId[identity.id] || [],
      assertedFacts: snapshot.assertedFacts[identity.id] ?? {},
      inferredHints: snapshot.inferredHints[identity.id] ?? {},
    })),
  });

export const buildCharacterResolutionHints = (
  snapshot: CharacterMemorySnapshot
): string =>
  JSON.stringify({
    memoryVersion: snapshot.version,
    canonicalNames: snapshot.canonicalIdentities.map((identity) => identity.name),
    aliasToCanonical: Object.fromEntries(
      unique(snapshot.aliasEvidence.map((entry) => entry.alias)).map((alias) => [
        alias,
        snapshot.derivedMaps.canonicalNameByAlias[alias],
      ])
    ),
  });
