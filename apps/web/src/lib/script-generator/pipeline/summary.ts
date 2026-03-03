import type { DialogueLine, ScriptGenerationSummary } from "../types";

export function calculateScriptSummary(
  dialogueLines: DialogueLine[],
  options?: {
    totalSegments?: number;
    failedSegmentIds?: string[];
  }
): ScriptGenerationSummary {
  const failedSegmentIds = options?.failedSegmentIds || [];
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
}
