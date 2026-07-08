import type { SegmentScriptDraft } from "../../context";
import { isNarrationSpeaker } from "@/lib/narration-character";
import type {
  CanonicalizedSegmentScriptDraftResult,
  CharacterAliasConflict,
  CharacterMemorySnapshot,
  CharacterResolutionEvidence,
  CharacterResolutionRecord,
} from "./types";

const unique = (values: string[]): string[] => [...new Set(values)];

const BLOCKING_UNKNOWN_SPEAKERS = new Set([
  "未知",
  "unknown",
  "不明",
  "未识别",
  "说话人",
  "speaker",
]);

const LOCAL_ROLE_MARKERS = [
  "的人",
  "人",
  "者",
  "男声",
  "女声",
  "男人",
  "女人",
  "老人",
  "少年",
  "少女",
  "先生",
  "女士",
  "医生",
  "警察",
  "司机",
  "店员",
];

const isAutoCreatableLocalSpeaker = (speaker: string): boolean => {
  const normalized = speaker.trim();
  if (!normalized || BLOCKING_UNKNOWN_SPEAKERS.has(normalized.toLowerCase())) {
    return false;
  }

  if (normalized.length > 16 || /[，。！？、,.!?；;：:“”"']/u.test(normalized)) {
    return false;
  }

  return LOCAL_ROLE_MARKERS.some((marker) => normalized.includes(marker));
};

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
    if (isNarrationSpeaker(speaker)) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: speaker,
        reason: "direct_match",
      });
      return line;
    }

    const canonicalByAlias = params.snapshot.derivedMaps.canonicalNameByAlias[speaker];
    const canonicalById = params.snapshot.derivedMaps.canonicalNameById[speaker];
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
    if (canonicalByAlias && canonicalByAlias !== speaker) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: canonicalByAlias,
        reason: "alias_match",
      });
      return {
        ...line,
        speaker: canonicalByAlias,
      };
    }

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

    if (canonicalById && canonicalById !== speaker) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: canonicalById,
        reason: "unchanged",
      });
      return {
        ...line,
        speaker: canonicalById,
      };
    }

    if (isAutoCreatableLocalSpeaker(speaker)) {
      resolvedSpeakers.push({
        raw: speaker,
        canonical: speaker,
        reason: "auto_local",
      });
      return line;
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
