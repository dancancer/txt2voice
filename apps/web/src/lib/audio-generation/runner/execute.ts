import type {
  AudioBatchGenerationHooks,
  AudioGenerationRequest,
  AudioGenerationOptions,
} from "@/lib/audio-generator";
import type {
  AudioGenerationTaskType,
  GeneratedAudioSummary,
} from "@/lib/audio-generation/runner/types";

export const executeAudioGeneration = async ({
  audioGenerator,
  bookId,
  type,
  chapterId,
  scriptSentenceIds,
  voiceProfileId,
  options,
  hooks,
}: {
  audioGenerator: ReturnType<typeof import("@/lib/audio-generator").getAudioGenerator>;
  bookId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  options: AudioGenerationOptions;
  hooks?: AudioBatchGenerationHooks;
}): Promise<GeneratedAudioSummary> => {
  let results: any[] = [];
  let totalSentences = 0;
  let audioReliability: Record<string, unknown> | null = null;

  if (type === "book") {
    const result = await audioGenerator.generateBookAudio(bookId, options, hooks);
    results = result.results;
    totalSentences = result.total;
    audioReliability =
      ((result as unknown as { reliability?: Record<string, unknown> }).reliability as
        | Record<string, unknown>
        | undefined) || null;
  } else if (type === "chapter" && chapterId) {
    const result = await audioGenerator.generateChapterAudio(
      bookId,
      chapterId,
      options,
      hooks
    );
    results = result.results;
    totalSentences = result.total;
    audioReliability =
      ((result as unknown as { reliability?: Record<string, unknown> }).reliability as
        | Record<string, unknown>
        | undefined) || null;
  } else if (type === "batch" && scriptSentenceIds) {
    const requests: AudioGenerationRequest[] = scriptSentenceIds.map((id) => ({
      scriptSentenceId: id,
      voiceProfileId,
      outputFormat: "mp3",
    }));

    if (typeof (audioGenerator as any).generateBatchAudioWithReliability === "function") {
      const summary = await (audioGenerator as any).generateBatchAudioWithReliability(
        requests,
        options,
        hooks
      );
      results = Array.isArray(summary?.results) ? summary.results : [];
      audioReliability =
        summary && typeof summary === "object" && summary.reliability
          ? summary.reliability
          : null;
    } else {
      results = await audioGenerator.generateBatchAudio(requests, options, hooks);
    }
    totalSentences = requests.length;
  } else if (type === "single" && scriptSentenceIds && scriptSentenceIds.length > 0) {
    const request: AudioGenerationRequest = {
      scriptSentenceId: scriptSentenceIds[0],
      voiceProfileId,
      outputFormat: "mp3",
    };
    const result = await audioGenerator.generateSingleAudio(request, options);
    results = [result];
    totalSentences = 1;
  } else {
    throw new Error("无效的生成类型");
  }

  return {
    results,
    totalSentences,
    audioReliability,
  };
};
