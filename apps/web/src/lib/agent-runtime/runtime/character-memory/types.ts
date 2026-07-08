import type {
  CharacterAliasEvidence,
  CharacterCanonicalIdentity,
  CharacterMemory,
} from "../../context";

export type CharacterMemorySnapshotSource =
  | "bootstrap"
  | "discovery_refresh"
  | "persist_sync";

export type CharacterMemorySnapshotStatus = "ready" | "degraded" | "failed";

export interface CharacterMemoryDerivedMaps {
  canonicalNameById: Record<string, string>;
  canonicalNameByAlias: Record<string, string>;
  aliasSetByCanonicalId: Record<string, string[]>;
}

export interface CharacterMemoryDiagnostics {
  lastDiscoveryAt?: string;
  discoveryRunCount: number;
  sampleCoverage: {
    sampledSegments: number;
    sampledChars: number;
    strategy: "bootstrap" | "incremental";
  };
  unknownSpeakerHits: number;
  aliasConflictCount: number;
  issues: string[];
}

export interface CharacterMemorySnapshot extends CharacterMemory {
  version: number;
  source: CharacterMemorySnapshotSource;
  status: CharacterMemorySnapshotStatus;
  derivedMaps: CharacterMemoryDerivedMaps;
  diagnostics: CharacterMemoryDiagnostics;
}

export type CharacterResolutionReason =
  | "direct_match"
  | "alias_match"
  | "unchanged"
  | "auto_local"
  | "unknown";

export interface CharacterResolutionRecord {
  raw: string;
  canonical: string;
  reason: CharacterResolutionReason;
}

export interface CharacterAliasConflict {
  speaker: string;
  candidateCanonicals: string[];
}

export interface CharacterResolutionEvidence {
  memoryVersion: number;
  rawSpeakers: string[];
  resolvedSpeakers: CharacterResolutionRecord[];
  unresolvedSpeakers: string[];
  aliasConflicts: CharacterAliasConflict[];
}

export interface CanonicalizedSegmentScriptDraftResult<TDraft> {
  draft: TDraft;
  evidence: CharacterResolutionEvidence;
}

export interface CharacterMemoryPatchMergeResult {
  canonicalIdentities: CharacterCanonicalIdentity[];
  aliasEvidence: CharacterAliasEvidence[];
  assertedFacts: Record<string, unknown>;
  inferredHints: Record<string, unknown>;
}
