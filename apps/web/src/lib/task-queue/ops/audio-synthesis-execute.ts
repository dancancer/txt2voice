import { serializeAudioJobError } from "@/lib/audio-job-error";
import { getAudioGenerator } from "@/lib/audio-generator";
import type {
  AudioSynthesisJobData,
  AudioSynthesisJobResult,
} from "@/lib/task-queue/core/types";

export interface AudioSynthesisJobContext {
  attempt: number;
  jobId?: string;
}

export async function runAudioSynthesisJob(
  data: AudioSynthesisJobData,
  context: AudioSynthesisJobContext
): Promise<AudioSynthesisJobResult> {
  const audioGenerator = getAudioGenerator();

  try {
    const result = await audioGenerator.executeAudioSynthesis(
      data.request,
      data.options
    );

    return {
      ...result,
      provider:
        typeof result.metadata?.routerDecision?.selectedEngine === "string"
          ? result.metadata.routerDecision.selectedEngine
          : typeof data.options.provider === "string"
            ? data.options.provider
            : null,
      attempt: context.attempt,
      retriesUsed: Math.max(context.attempt - 1, 0),
    };
  } catch (error) {
    throw new Error(
      serializeAudioJobError(error, {
        provider:
          typeof data.options.provider === "string"
            ? data.options.provider
            : "unknown",
        attempt: context.attempt,
        retriesUsed: Math.max(context.attempt - 1, 0),
      })
    );
  }
}
