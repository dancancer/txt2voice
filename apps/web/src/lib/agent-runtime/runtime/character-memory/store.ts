import {
  type CharacterMemory,
  buildCharacterMemoryFromProfiles,
  type MemoryPatch,
} from "../../context";
import { generateCommonCharacterNameVariations } from "../character-name-variations";
import { mergeCharacterMemoryPatch } from "./merge";
import type {
  CharacterMemorySnapshot,
  CharacterMemorySnapshotSource,
} from "./types";

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

const unique = (values: string[]): string[] => [...new Set(values)];

const buildDerivedMaps = (snapshot: {
  canonicalIdentities: Array<{ id: string; name: string }>;
  aliasEvidence: Array<{ alias: string; canonicalId: string }>;
}) => {
  const canonicalNameById = Object.fromEntries(
    snapshot.canonicalIdentities.map((identity) => [identity.id, identity.name])
  );
  const aliasCandidates = new Map<string, string[]>();

  for (const identity of snapshot.canonicalIdentities) {
    for (const alias of generateCommonCharacterNameVariations(identity.name)) {
      const bucket = aliasCandidates.get(alias) || [];
      bucket.push(identity.name);
      aliasCandidates.set(alias, unique(bucket));
    }
  }

  for (const entry of snapshot.aliasEvidence) {
    const canonicalName = canonicalNameById[entry.canonicalId];
    if (typeof canonicalName !== "string" || canonicalName.length === 0) {
      continue;
    }

    const alias = entry.alias.trim();
    if (!alias) {
      continue;
    }

    const bucket = aliasCandidates.get(alias) || [];
    bucket.push(canonicalName);
    aliasCandidates.set(alias, unique(bucket));
  }

  const canonicalNameByAlias = Object.fromEntries(
    [...aliasCandidates.entries()].flatMap(([alias, canonicalNames]) =>
      canonicalNames.length === 1 ? [[alias, canonicalNames[0]!]] : []
    )
  );
  const aliasSetByCanonicalId = Object.fromEntries(
    snapshot.canonicalIdentities.map((identity) => [
      identity.id,
      unique(
        [
          ...snapshot.aliasEvidence
            .filter((entry) => entry.canonicalId === identity.id)
            .map((entry) => entry.alias),
          ...generateCommonCharacterNameVariations(identity.name),
        ]
      ),
    ])
  );

  return {
    canonicalNameById,
    canonicalNameByAlias,
    aliasSetByCanonicalId,
  };
};

const buildDiagnostics = (
  source: CharacterMemorySnapshotSource
): CharacterMemorySnapshot["diagnostics"] => ({
  discoveryRunCount: source === "bootstrap" ? 0 : 1,
  sampleCoverage: {
    sampledSegments: 0,
    sampledChars: 0,
    strategy: source === "bootstrap" ? "bootstrap" : "incremental",
  },
  unknownSpeakerHits: 0,
  aliasConflictCount: 0,
  issues: [],
});

export const createBootstrapCharacterMemorySnapshot = (
  profiles: CharacterProfileSeed[],
  now: () => Date = () => new Date()
): CharacterMemorySnapshot => {
  const memory = buildCharacterMemoryFromProfiles(profiles);

  return createCharacterMemorySnapshot({
    memory,
    version: 1,
    source: "bootstrap",
    now,
  });
};

export const createDiscoveryRefreshCharacterMemorySnapshot = (
  profiles: CharacterProfileSeed[],
  options: {
    version?: number;
    now?: () => Date;
  } = {}
): CharacterMemorySnapshot => {
  const memory = buildCharacterMemoryFromProfiles(profiles);

  return createCharacterMemorySnapshot({
    memory,
    version: options.version,
    source: "discovery_refresh",
    now: options.now,
  });
};

export const createCharacterMemorySnapshot = (params: {
  memory: CharacterMemory;
  version?: number;
  source?: CharacterMemorySnapshotSource;
  status?: CharacterMemorySnapshot["status"];
  now?: () => Date;
}): CharacterMemorySnapshot => {
  const source = params.source ?? "persist_sync";
  return {
    version: params.version ?? 1,
    source,
    status: params.status ?? "ready",
    canonicalIdentities: params.memory.canonicalIdentities,
    aliasEvidence: params.memory.aliasEvidence,
    assertedFacts: params.memory.assertedFacts,
    inferredHints: params.memory.inferredHints,
    derivedMaps: buildDerivedMaps(params.memory),
    diagnostics: {
      ...buildDiagnostics(source),
      lastDiscoveryAt: (params.now ?? (() => new Date()))().toISOString(),
    },
  };
};

export const applyCharacterMemoryPatch = (params: {
  snapshot: CharacterMemorySnapshot;
  patch: MemoryPatch;
  source: Exclude<CharacterMemorySnapshotSource, "bootstrap">;
  now?: () => Date;
}): CharacterMemorySnapshot => {
  const merged = mergeCharacterMemoryPatch({
    snapshot: params.snapshot,
    patch: params.patch,
  });

  return {
    version: params.snapshot.version + 1,
    source: params.source,
    status: "ready",
    canonicalIdentities: merged.canonicalIdentities,
    aliasEvidence: merged.aliasEvidence,
    assertedFacts: merged.assertedFacts,
    inferredHints: merged.inferredHints,
    derivedMaps: buildDerivedMaps(merged),
    diagnostics: {
      ...params.snapshot.diagnostics,
      lastDiscoveryAt: (params.now ?? (() => new Date()))().toISOString(),
      discoveryRunCount: params.snapshot.diagnostics.discoveryRunCount + 1,
      sampleCoverage: {
        ...params.snapshot.diagnostics.sampleCoverage,
        strategy: "incremental",
      },
    },
  };
};
