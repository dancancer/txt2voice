import type { CharacterMemory, SegmentScriptDraft } from "../context";
import {
  buildCharacterMap,
  mapCharacterMemoryToCandidates,
  upsertCharacterCandidates,
} from "../runtime/script-production/storage/character-utils";
import {
  mapSegmentScriptDraftToDialogueLines,
  saveSegmentScriptToDatabase,
} from "../runtime/script-production/storage/persistence";
import type {
  CharacterCandidate,
  DialogueLine,
} from "../runtime/script-production/types";
import { isNarrationSpeaker } from "@/lib/narration-character";

interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
}

interface PersistToolsDeps {
  mapCharacterMemoryToCandidates?: typeof mapCharacterMemoryToCandidates;
  upsertCharacterCandidates?: typeof upsertCharacterCandidates;
  mapSegmentScriptDraftToDialogueLines?: typeof mapSegmentScriptDraftToDialogueLines;
  saveSegmentScriptToDatabase?: typeof saveSegmentScriptToDatabase;
}

export interface PersistCharacterMemoryDraftInput {
  bookId: string;
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
  candidates: CharacterCandidate[];
}

export interface PersistSegmentScriptDraftInput {
  bookId: string;
  segmentId: string;
  dialogueLines: DialogueLine[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
}

export interface PersistCharacterMemoryDraftRequest {
  bookId: string;
  characterMemory: CharacterMemory;
  characterProfiles?: CharacterProfileLike[];
  characterMap?: Map<string, string>;
}

export interface PersistSegmentScriptDraftRequest {
  bookId: string;
  segmentScriptDraft: SegmentScriptDraft;
  chapterId?: string | null;
  characterProfiles?: CharacterProfileLike[];
  characterMap?: Map<string, string>;
}

export interface PersistCharacterMemoryDraftResult {
  persistedCharacterCount: number;
}

export interface PersistSegmentScriptDraftResult {
  persistedSentenceCount: number;
  persistedCharacterCount: number;
}

export interface PersistTools {
  persistCharacterMemoryDraft: (
    input: PersistCharacterMemoryDraftRequest
  ) => Promise<PersistCharacterMemoryDraftResult>;
  persistSegmentScriptDraft: (
    input: PersistSegmentScriptDraftRequest
  ) => Promise<PersistSegmentScriptDraftResult>;
}

const buildSpeakerCandidates = (params: {
  dialogueLines: DialogueLine[];
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
}): CharacterCandidate[] => {
  const knownNames = new Set<string>();
  for (const profile of params.characterProfiles) {
    if (typeof profile.canonicalName === "string" && profile.canonicalName.trim()) {
      knownNames.add(profile.canonicalName.trim());
    }
    for (const alias of profile.aliases || []) {
      if (typeof alias?.alias === "string" && alias.alias.trim()) {
        knownNames.add(alias.alias.trim());
      }
    }
  }
  for (const key of params.characterMap.keys()) {
    knownNames.add(key);
  }

  const candidates: CharacterCandidate[] = [];
  const seen = new Set<string>();
  for (const line of params.dialogueLines) {
    const speaker = (line.characterName || line.rawSpeaker || "").trim();
    if (!speaker || speaker === "未知" || isNarrationSpeaker(speaker)) {
      continue;
    }
    if (knownNames.has(speaker) || seen.has(speaker)) {
      continue;
    }

    seen.add(speaker);
    candidates.push({
      name: speaker,
      aliases: [],
      personality: [],
      importance: "minor",
    });
  }

  return candidates;
};

const createPersistenceContext = (params: {
  characterProfiles?: CharacterProfileLike[];
  characterMap?: Map<string, string>;
}): {
  characterProfiles: CharacterProfileLike[];
  characterMap: Map<string, string>;
} => {
  const characterProfiles = params.characterProfiles || [];
  const characterMap = params.characterMap || buildCharacterMap(characterProfiles);

  return {
    characterProfiles,
    characterMap,
  };
};

export const createPersistTools = (deps: PersistToolsDeps = {}): PersistTools => {
  const mapMemoryToCandidates =
    deps.mapCharacterMemoryToCandidates || mapCharacterMemoryToCandidates;
  const persistCharacters = deps.upsertCharacterCandidates || upsertCharacterCandidates;
  const mapDraftToDialogueLines =
    deps.mapSegmentScriptDraftToDialogueLines || mapSegmentScriptDraftToDialogueLines;
  const persistSegmentSentences =
    deps.saveSegmentScriptToDatabase || saveSegmentScriptToDatabase;

  return {
    persistCharacterMemoryDraft: async (input) => {
      const context = createPersistenceContext({
        characterProfiles: input.characterProfiles,
        characterMap: input.characterMap,
      });
      const candidates = mapMemoryToCandidates(input.characterMemory);

      await persistCharacters({
        bookId: input.bookId,
        candidates,
        characterProfiles: context.characterProfiles,
        characterMap: context.characterMap,
      });

      return {
        persistedCharacterCount: candidates.length,
      };
    },

    persistSegmentScriptDraft: async (input) => {
      const context = createPersistenceContext({
        characterProfiles: input.characterProfiles,
        characterMap: input.characterMap,
      });
      const dialogueLines = mapDraftToDialogueLines({
        segmentScriptDraft: input.segmentScriptDraft,
        chapterId: input.chapterId,
      });
      const speakerCandidates = buildSpeakerCandidates({
        dialogueLines,
        characterProfiles: context.characterProfiles,
        characterMap: context.characterMap,
      });

      if (speakerCandidates.length > 0) {
        await persistCharacters({
          bookId: input.bookId,
          candidates: speakerCandidates,
          characterProfiles: context.characterProfiles,
          characterMap: context.characterMap,
        });
      }

      await persistSegmentSentences({
        bookId: input.bookId,
        segmentId: input.segmentScriptDraft.segmentId,
        dialogueLines,
        characterProfiles: context.characterProfiles,
        characterMap: context.characterMap,
      });

      return {
        persistedSentenceCount: dialogueLines.length,
        persistedCharacterCount: speakerCandidates.length,
      };
    },
  };
};
