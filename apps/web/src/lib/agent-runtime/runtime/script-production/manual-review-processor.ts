import { TTSError } from "@/lib/error-handler";
import type { Prisma } from "@/lib/prisma";
import {
  addCharacterToMap,
  normalizeCharacterCandidates,
  resolveCandidateCanonicalName,
  upsertCharacterCandidates,
} from "./storage/character-utils";
import { saveSegmentScriptToDatabase } from "./storage/persistence";
import type {
  CharacterCandidate,
  DialogueLine,
  ScriptGenerationOptions,
  SegmentFailureDetail,
  SegmentProcessingResult,
} from "./types";
import {
  formatSegmentValidationError,
  resolveScriptLineText,
  validateSegmentScript,
} from "./helpers/segment-script-validator";

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && !Number.isNaN(value) ? value : null;

const buildSegmentPreview = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 120);

const buildSegmentFailureDetail = (params: {
  segment: any;
  message: string;
  patch?: Partial<SegmentFailureDetail>;
}): SegmentFailureDetail => ({
  segmentId: params.segment.id,
  chapterId: params.segment.chapterId ?? null,
  orderIndex:
    typeof params.segment.orderIndex === "number" &&
    Number.isFinite(params.segment.orderIndex)
      ? params.segment.orderIndex
      : -1,
  stage: params.patch?.stage || "unknown",
  errorCode: params.patch?.errorCode || "UNKNOWN_ERROR",
  message: params.message,
  provider: params.patch?.provider || null,
  retryable: params.patch?.retryable === true,
  coverageRatio:
    typeof params.patch?.coverageRatio === "number"
      ? params.patch.coverageRatio
      : null,
  issueCodes: params.patch?.issueCodes || [],
  issueMessages: params.patch?.issueMessages || [params.message],
  issuePreviews: params.patch?.issuePreviews || [],
  segmentPreview: buildSegmentPreview(params.segment.content),
  segmentContent: params.segment.content,
  rawResponse: params.patch?.rawResponse ?? null,
  structuredResult: params.patch?.structuredResult ?? null,
});

const throwSegmentError = (params: {
  segment: any;
  message: string;
  patch?: Partial<SegmentFailureDetail>;
}): never => {
  const error = new TTSError(
    params.message,
    "TTS_SERVICE_DOWN",
    params.patch?.provider || "script-validator"
  );
  error.details = buildSegmentFailureDetail({
    segment: params.segment,
    message: params.message,
    patch: params.patch,
  });
  throw error;
};

const resolveScriptSentences = (result: any): any[] => {
  if (Array.isArray(result)) {
    return result;
  }

  if (result?.dialogues && Array.isArray(result.dialogues)) {
    return result.dialogues;
  }

  if (result?.dialogueLines && Array.isArray(result.dialogueLines)) {
    return result.dialogueLines;
  }

  return [];
};

const resolveRawCharacters = (result: any): any[] => {
  if (result?.characters && Array.isArray(result.characters)) {
    return result.characters;
  }

  if (result?.newCharacters && Array.isArray(result.newCharacters)) {
    return result.newCharacters;
  }

  return [];
};

const ensureDialogueLengthCap = (params: {
  segment: any;
  dialogueLines: DialogueLine[];
  maxDialogueLength: number;
}) => {
  const oversizedLine = params.dialogueLines.find(
    (line) => line.text.trim().length > params.maxDialogueLength
  );

  if (!oversizedLine) {
    return;
  }

  throwSegmentError({
    segment: params.segment,
    message: `段落 ${params.segment.id} 存在超长台词，长度 ${oversizedLine.text.trim().length} 超过上限 ${params.maxDialogueLength}`,
    patch: {
      stage: "dialogue_length",
      errorCode: "DIALOGUE_TOO_LONG",
      provider: "script-validator",
      issueCodes: ["DIALOGUE_TOO_LONG"],
      issueMessages: [
        `长度 ${oversizedLine.text.trim().length} 超过上限 ${params.maxDialogueLength}`,
      ],
      issuePreviews: [oversizedLine.text.trim().slice(0, 40)],
      retryable: false,
    },
  });
};

const buildStagedCharacterMap = (params: {
  characterCandidates: CharacterCandidate[];
  characterMap: Map<string, string>;
}) => {
  const stagedCharacterMap = new Map(params.characterMap);
  const stagedProfiles: Array<{
    canonicalName: string;
    aliases: Array<{ alias: string }>;
  }> = [];

  for (const candidate of params.characterCandidates) {
    const canonicalName = resolveCandidateCanonicalName(
      candidate,
      stagedCharacterMap
    );
    const aliasSet = new Set<string>(candidate.aliases);
    if (candidate.name !== canonicalName) {
      aliasSet.add(candidate.name);
    }

    const stagedProfile = {
      canonicalName,
      aliases: [...aliasSet].map((alias) => ({ alias })),
    };

    addCharacterToMap(stagedCharacterMap, stagedProfile);
    stagedProfiles.push(stagedProfile);
  }

  return { stagedCharacterMap, stagedProfiles };
};

const commitStagedCharacterMap = (params: {
  characterMap: Map<string, string>;
  stagedProfiles: Array<{
    canonicalName: string;
    aliases: Array<{ alias: string }>;
  }>;
}) => {
  for (const profile of params.stagedProfiles) {
    addCharacterToMap(params.characterMap, profile);
  }
};

const mapDialogueLines = (params: {
  segment: any;
  scriptSentences: any[];
  characterMap: Map<string, string>;
}): DialogueLine[] => {
  const validation = validateSegmentScript({
    segmentContent: params.segment.content,
    scriptSentences: params.scriptSentences,
  });

  if (!validation.valid) {
    throwSegmentError({
      segment: params.segment,
      message: formatSegmentValidationError(validation),
      patch: {
        stage: "script_validation",
        errorCode: "SCRIPT_VALIDATION_FAILED",
        provider: "script-validator",
        coverageRatio: validation.coverageRatio,
        issueCodes: validation.issues.map((issue) => issue.code),
        issueMessages: validation.issues.map((issue) => issue.message),
        issuePreviews: validation.issues
          .map((issue) => asTrimmedString(issue.preview))
          .filter((preview) => preview.length > 0),
        retryable: false,
      },
    });
  }

  return validation.lines.map((validatedLine, index) => {
    const sentence = params.scriptSentences[index] || {};
    let characterName = validatedLine.speaker || "未知";

    if (characterName !== "旁白" && characterName !== "未知") {
      characterName = params.characterMap.get(characterName) || characterName;
    }

    const ttsHints =
      sentence.ttsHints && typeof sentence.ttsHints === "object"
        ? sentence.ttsHints
        : {
            pitch: 1,
            rate: 1,
            emphasis: "",
          };

    return {
      id: sentence.id || `${params.segment.id}_${index}`,
      characterName,
      rawSpeaker: validatedLine.speaker,
      text: validatedLine.resolvedText,
      tone: sentence.tone || "中性",
      roleType: characterName === "旁白" ? "narration" : "dialogue",
      emotionLabel:
        typeof sentence.emotionLabel === "string"
          ? sentence.emotionLabel
          : undefined,
      emotionIntensity:
        typeof sentence.emotionIntensity === "number"
          ? sentence.emotionIntensity
          : undefined,
      engineHint:
        typeof sentence.engineHint === "string" ? sentence.engineHint : undefined,
      priority:
        sentence.priority === "high" ||
        sentence.priority === "normal" ||
        sentence.priority === "low"
          ? sentence.priority
          : undefined,
      prosody:
        sentence.prosody && typeof sentence.prosody === "object"
          ? sentence.prosody
          : undefined,
      strength: typeof sentence.strength === "number" ? sentence.strength : 75,
      pauseAfter:
        typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
      segmentId: params.segment.id,
      chapterId: params.segment.chapterId,
      orderInSegment: index,
      isNarration: characterName === "旁白",
      ttsParameters: {
        ttsHints,
        originalSpeaker: validatedLine.speaker,
        sourceText: validatedLine.sourceText,
        sourceStart: validatedLine.sourceStart,
        sourceEnd: validatedLine.sourceEnd,
        engineHint:
          typeof sentence.engineHint === "string"
            ? sentence.engineHint
            : undefined,
        strength: typeof sentence.strength === "number" ? sentence.strength : 75,
        pauseAfter:
          typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
        confidence: 0.8,
      },
    };
  });
};

export const buildSegmentProcessingResultFromStructuredResult = (params: {
  segment: any;
  structuredResult: Record<string, unknown>;
  characterMap: Map<string, string>;
  options: ScriptGenerationOptions;
}): SegmentProcessingResult => {
  const scriptSentences = resolveScriptSentences(params.structuredResult);
  const rawCharacters = resolveRawCharacters(params.structuredResult);
  const characterCandidates = normalizeCharacterCandidates(rawCharacters);
  const { stagedCharacterMap, stagedProfiles } = buildStagedCharacterMap({
    characterCandidates,
    characterMap: params.characterMap,
  });

  const dialogueLines = mapDialogueLines({
    segment: params.segment,
    scriptSentences,
    characterMap: stagedCharacterMap,
  }).filter((line) => line.text.trim().length > 0);

  ensureDialogueLengthCap({
    segment: params.segment,
    dialogueLines,
    maxDialogueLength: params.options.maxDialogueLength,
  });

  commitStagedCharacterMap({
    characterMap: params.characterMap,
    stagedProfiles,
  });

  return { dialogueLines, characterCandidates };
};

export const persistSegmentProcessingResult = async (params: {
  bookId: string;
  segmentId: string;
  result: SegmentProcessingResult;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  db?: Prisma.TransactionClient;
}) => {
  const { bookId, segmentId, result, characterMap, characterProfiles, db } = params;

  if (result.dialogueLines.length === 0) {
    throw new TTSError(
      `段落 ${segmentId} 未生成有效台词`,
      "TTS_SERVICE_DOWN",
      "mastra-script-production"
    );
  }

  if (result.characterCandidates.length > 0) {
    await upsertCharacterCandidates({
      bookId,
      candidates: result.characterCandidates,
      characterProfiles,
      characterMap,
      db,
    });
  }

  await saveSegmentScriptToDatabase({
    bookId,
    segmentId,
    dialogueLines: result.dialogueLines,
    characterProfiles,
    characterMap,
    db,
  });
};
