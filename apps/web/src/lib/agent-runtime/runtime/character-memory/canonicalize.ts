import type { SegmentScriptDraft } from "../../context";
import type {
  CanonicalizedSegmentScriptDraftResult,
  CharacterAliasConflict,
  CharacterMemorySnapshot,
  CharacterResolutionEvidence,
  CharacterResolutionRecord,
} from "./types";

const unique = (values: string[]): string[] => [...new Set(values)];

const resolveAliasCandidates = (
  speaker: string,
  snapshot: CharacterMemorySnapshot
): string[] => {
  return unique(
    snapshot.canonicalIdentities
      .filter((identity) =>
        snapshot.aliasEvidence.some(
          (entry) =>
            entry.alias.trim() === speaker &&
            entry.canonicalId.trim() === identity.id.trim()
        )
      )
      .map((identity) => identity.name.trim())
      .filter((name) => name.length > 0)
  );
};

export const canonicalizeSegmentScriptDraftSpeakers = (params: {
  draft: SegmentScriptDraft;
  snapshot: CharacterMemorySnapshot;
}): CanonicalizedSegmentScriptDraftResult<SegmentScriptDraft> => {
  const aliasConflicts: CharacterAliasConflict[] = [];
  const resolvedSpeakers: CharacterResolutionRecord[] = [];
  const unresolvedSpeakers = new Set<string>();

  const lines = params.draft.lines.map((line) => {
    const speaker = line.speaker.trim();
    const directCanonical =
      params.snapshot.derivedMaps.canonicalNameByAlias[speaker] ||
      params.snapshot.derivedMaps.canonicalNameById[speaker];
    const canonicalIdentity = params.snapshot.canonicalIdentities.find(
      (identity) => identity.name.trim() === speaker
    );

    if (canonicalIdentity) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: speaker,
        reason: "direct_match",
      });
      return line;
    }

    const aliasCandidates = resolveAliasCandidates(speaker, params.snapshot);
    if (aliasCandidates.length === 1) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: aliasCandidates[0]!,
        reason: "alias_match",
      });
      return {
        ...line,
        speaker: aliasCandidates[0]!,
      };
    }

    if (aliasCandidates.length > 1) {
      aliasConflicts.push({
        speaker,
        candidateCanonicals: aliasCandidates,
      });
      unresolvedSpeakers.add(speaker);
      resolvedSpeakers.push({
        raw: speaker,
        canonical: speaker,
        reason: "unknown",
      });
      return line;
    }

    if (directCanonical && directCanonical !== speaker) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: directCanonical,
        reason: "unchanged",
      });
      return {
        ...line,
        speaker: directCanonical,
      };
    }

    unresolvedSpeakers.add(speaker);
    resolvedSpeakers.push({
      raw: speaker,
      canonical: speaker,
      reason: "unknown",
    });
    return line;
  });

  const evidence: CharacterResolutionEvidence = {
    memoryVersion: params.snapshot.version,
    rawSpeakers: unique(params.draft.lines.map((line) => line.speaker.trim())),
    resolvedSpeakers,
    unresolvedSpeakers: [...unresolvedSpeakers],
    aliasConflicts,
  };

  return {
    draft: {
      ...params.draft,
      lines,
    },
    evidence,
  };
};
