import type {
  DialogueLine,
  ScriptGenerationSummary,
  SegmentFailureDetail,
} from "./types";

export const calculateScriptSummary = (
  dialogueLines: DialogueLine[],
  options?: {
    totalSegments?: number;
    failedSegmentIds?: string[];
    failedSegmentDetails?: SegmentFailureDetail[];
  }
): ScriptGenerationSummary => {
  const failedSegmentIds = options?.failedSegmentIds || [];
  const failedSegmentDetails = options?.failedSegmentDetails || [];
  const totalSegments =
    typeof options?.totalSegments === "number"
      ? options.totalSegments
      : new Set(dialogueLines.map((line) => line.segmentId)).size;

  const summary: ScriptGenerationSummary = {
    totalLines: dialogueLines.length,
    dialogueCount: dialogueLines.filter((line) => !line.isNarration).length,
    narrationCount: dialogueLines.filter((line) => line.isNarration).length,
    totalSegments,
    processedSegments: Math.max(totalSegments - failedSegmentIds.length, 0),
    failedSegments: failedSegmentIds.length,
    failedSegmentIds,
    failedSegmentDetails,
    characterDistribution: {},
    emotionDistribution: {},
  };

  for (const line of dialogueLines) {
    if (!line.isNarration && line.characterName) {
      summary.characterDistribution[line.characterName] =
        (summary.characterDistribution[line.characterName] || 0) + 1;
    }
  }

  for (const line of dialogueLines) {
    if (line.tone) {
      summary.emotionDistribution[line.tone] =
        (summary.emotionDistribution[line.tone] || 0) + 1;
    }
  }

  return summary;
};
