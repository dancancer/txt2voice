import { ValidationError } from "@/lib/error-handler";

export function assertAudioGenerationAllowed(params: {
  status: string;
  scriptSentenceCount: number;
}) {
  if (params.scriptSentenceCount > 0) {
    return;
  }

  const allowedStatuses = new Set([
    "script_generated",
    "completed",
    "completed_with_errors",
    "generating_audio",
  ]);

  if (!allowedStatuses.has(params.status)) {
    throw new ValidationError("请先完成台本生成");
  }

  throw new ValidationError("没有可生成音频的台词");
}
