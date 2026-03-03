import { TTSError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { buildCharacterMap } from "../storage/character-utils";
import { calculateScriptSummary } from "./summary";
import type {
  DialogueLine,
  GeneratedScript,
  ScriptGenerationOptions,
  SegmentSummary,
  SegmentProcessingResult,
} from "../types";

interface ProcessSegmentAndSaveInput {
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
  bookId: string;
}

type ProcessSegmentAndSaveFn = (
  input: ProcessSegmentAndSaveInput
) => Promise<SegmentProcessingResult>;

const loadBookForGeneration = async (params: {
  bookId: string;
  segmentIds?: string[];
}) => {
  const { bookId, segmentIds } = params;

  const segmentWhere =
    Array.isArray(segmentIds) && segmentIds.length > 0
      ? { id: { in: segmentIds } }
      : undefined;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      textSegments: {
        where: segmentWhere,
        orderBy: { orderIndex: "asc" },
      },
      characterProfiles: {
        where: { isActive: true },
        include: {
          aliases: true,
        },
      },
    },
  });

  if (!book) {
    throw new TTSError("书籍不存在", "TTS_SERVICE_DOWN", "script-generator");
  }

  return book;
};

const ensureSegments = (segments: any[], errorMessage: string) => {
  if (segments.length === 0) {
    throw new TTSError(errorMessage, "TTS_SERVICE_DOWN", "script-generator");
  }
};

const buildSegmentSummary = (dialogueLines: DialogueLine[], segmentId: string): SegmentSummary => {
  return {
    segmentId,
    lineCount: dialogueLines.length,
    characters: [...new Set(dialogueLines.map((line) => line.characterName || "未知"))],
  };
};

const runSegmentGeneration = async (params: {
  bookId: string;
  segments: any[];
  characterProfiles: any[];
  options: ScriptGenerationOptions;
  onProgress?: (done: number, total: number) => Promise<void> | void;
  processSegmentAndSave: ProcessSegmentAndSaveFn;
  errorPrefix: string;
}): Promise<GeneratedScript> => {
  const {
    bookId,
    segments,
    characterProfiles,
    options,
    onProgress,
    processSegmentAndSave,
    errorPrefix,
  } = params;

  const characterMap = buildCharacterMap(characterProfiles);
  const allDialogueLines: DialogueLine[] = [];
  const segmentSummaries: SegmentSummary[] = [];
  const failedSegmentIds: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    try {
      const segmentResult = await processSegmentAndSave({
        segment,
        characterMap,
        characterProfiles,
        options,
        bookId,
      });

      allDialogueLines.push(...segmentResult.dialogueLines);
      segmentSummaries.push(
        buildSegmentSummary(segmentResult.dialogueLines, segment.id)
      );

      if (onProgress) {
        await onProgress(index + 1, segments.length);
      }
    } catch (error) {
      console.error(`${errorPrefix} ${segment.id} 失败:`, error);
      failedSegmentIds.push(segment.id);
    }
  }

  if (allDialogueLines.length === 0) {
    throw new TTSError(
      "台本生成失败，没有生成任何台词",
      "TTS_SERVICE_DOWN",
      "script-generator"
    );
  }

  return {
    dialogueLines: allDialogueLines,
    summary: calculateScriptSummary(allDialogueLines, {
      totalSegments: segments.length,
      failedSegmentIds,
    }),
    segments: segmentSummaries,
  };
};

const resolvePartialSegments = (params: {
  segments: any[];
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
}): any[] => {
  const { segments, startFromSegmentId, startFromOrderIndex, limitToSegments } =
    params;

  let startIndex = 0;
  let hasExplicitStart = false;

  if (typeof startFromOrderIndex === "number") {
    hasExplicitStart = true;
    startIndex = segments.findIndex((seg) => seg.orderIndex === startFromOrderIndex);
  }

  if ((startIndex === -1 || !hasExplicitStart) && startFromSegmentId) {
    hasExplicitStart = true;
    startIndex = segments.findIndex((seg) => seg.id === startFromSegmentId);
  }

  if (hasExplicitStart && startIndex === -1) {
    throw new TTSError(
      "未找到指定的起始段落",
      "TTS_SERVICE_DOWN",
      "script-generator"
    );
  }

  const hasLimit = typeof limitToSegments === "number" && limitToSegments > 0;
  const endIndex = hasLimit
    ? Math.min(startIndex + limitToSegments, segments.length)
    : segments.length;

  if (startIndex >= endIndex) {
    throw new TTSError(
      "没有可处理的文本段落",
      "TTS_SERVICE_DOWN",
      "script-generator"
    );
  }

  return segments.slice(startIndex, endIndex);
};

export async function generateScriptByBook(params: {
  bookId: string;
  options: ScriptGenerationOptions;
  onProgress?: (done: number, total: number) => Promise<void> | void;
  processSegmentAndSave: ProcessSegmentAndSaveFn;
}): Promise<GeneratedScript> {
  const { bookId, options, onProgress, processSegmentAndSave } = params;

  const book = await loadBookForGeneration({ bookId });
  ensureSegments(book.textSegments, "没有可处理的文本段落");

  return runSegmentGeneration({
    bookId,
    segments: book.textSegments,
    characterProfiles: book.characterProfiles,
    options,
    onProgress,
    processSegmentAndSave,
    errorPrefix: "处理段落",
  });
}

export async function generatePartialScriptByBook(params: {
  bookId: string;
  options: ScriptGenerationOptions;
  generationParams: {
    startFromSegmentId?: string | null;
    startFromOrderIndex?: number | null;
    limitToSegments?: number;
  };
  onProgress?: (done: number, total: number) => Promise<void> | void;
  processSegmentAndSave: ProcessSegmentAndSaveFn;
}): Promise<GeneratedScript> {
  const { bookId, options, generationParams, onProgress, processSegmentAndSave } =
    params;

  const book = await loadBookForGeneration({ bookId });
  ensureSegments(book.textSegments, "没有可处理的文本段落");

  const segments = resolvePartialSegments({
    segments: book.textSegments,
    startFromSegmentId: generationParams.startFromSegmentId,
    startFromOrderIndex: generationParams.startFromOrderIndex,
    limitToSegments: generationParams.limitToSegments,
  });

  return runSegmentGeneration({
    bookId,
    segments,
    characterProfiles: book.characterProfiles,
    options,
    onProgress,
    processSegmentAndSave,
    errorPrefix: "处理段落",
  });
}

export async function regenerateSegmentsByBook(params: {
  bookId: string;
  segmentIds: string[];
  options: ScriptGenerationOptions;
  onProgress?: (done: number, total: number) => Promise<void> | void;
  processSegmentAndSave: ProcessSegmentAndSaveFn;
}): Promise<GeneratedScript> {
  const { bookId, segmentIds, options, onProgress, processSegmentAndSave } =
    params;

  const book = await loadBookForGeneration({ bookId, segmentIds });
  ensureSegments(book.textSegments, "没有找到指定的段落");

  return runSegmentGeneration({
    bookId,
    segments: book.textSegments,
    characterProfiles: book.characterProfiles,
    options,
    onProgress,
    processSegmentAndSave,
    errorPrefix: "重新处理段落",
  });
}
