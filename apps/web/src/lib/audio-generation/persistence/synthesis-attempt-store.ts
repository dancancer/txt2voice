import { Prisma } from "@/generated/prisma";
import type prisma from "@/lib/prisma";
import type { TTSRequest } from "@/lib/tts-service";
import { TTSError } from "@/lib/error-handler";

import type {
  AudioGenerationRequest,
  RouteAttemptContext,
} from "../types";

function buildRouteAttemptPayload(routeAttemptContext?: RouteAttemptContext): {
  policyVersion: string | null;
  fallbackDepth: number | null;
  selection: Record<string, unknown> | null;
  routerDecision: Record<string, unknown> | null;
} {
  if (!routeAttemptContext) {
    return {
      policyVersion: null,
      fallbackDepth: null,
      selection: null,
      routerDecision: null,
    };
  }

  return {
    policyVersion: routeAttemptContext.policyVersion,
    fallbackDepth: routeAttemptContext.routeDecision.fallbackDepth,
    selection: {
      candidateId: routeAttemptContext.selectedCandidate.candidateId,
      provider: routeAttemptContext.selectedCandidate.provider,
      source: routeAttemptContext.selectedCandidate.source,
      rule: routeAttemptContext.selectedCandidate.rule,
      presetMatch: routeAttemptContext.selectedCandidate.presetMatch,
      speakerProfileId:
        routeAttemptContext.selectedCandidate.speakerProfileId || null,
      speakerEngineVariantId:
        routeAttemptContext.selectedCandidate.speakerEngineVariantId || null,
      candidateIndex: routeAttemptContext.candidateIndex,
    },
    routerDecision:
      routeAttemptContext.routeDecision as unknown as Record<string, unknown>,
  };
}

export async function recordFailedSynthesisAttempt(params: {
  scriptSentence: any;
  request: AudioGenerationRequest;
  startedAt: Date;
  error: unknown;
  prismaClient: typeof prisma;
  voiceProfile?: any | null;
  ttsRequest?: TTSRequest | null;
  fallbackEngine?: string;
  routeAttemptContext?: RouteAttemptContext;
  isFinal?: boolean;
}): Promise<void> {
  const {
    scriptSentence,
    request,
    startedAt,
    error,
    prismaClient,
    voiceProfile,
    ttsRequest,
    fallbackEngine,
    routeAttemptContext,
    isFinal = false,
  } = params;

  const now = new Date();
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorCode =
    error instanceof TTSError ? error.code : "AUDIO_GENERATION_FAILED";
  const routePayload = buildRouteAttemptPayload(routeAttemptContext);
  const attemptNo =
    (await prismaClient.synthesisAttempt.count({
      where: {
        sentenceId: scriptSentence.id,
      },
    })) + 1;

  await prismaClient.synthesisAttempt.create({
    data: {
      bookId: scriptSentence.bookId,
      chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
      segmentId: scriptSentence.segmentId,
      sentenceId: scriptSentence.id,
      speakerProfileId:
        routeAttemptContext?.selectedCandidate.speakerProfileId || null,
      speakerEngineVariantId:
        routeAttemptContext?.selectedCandidate.speakerEngineVariantId || null,
      engine: voiceProfile?.provider || fallbackEngine || "unknown",
      status: "failed",
      attemptNo,
      triggerType: "auto",
      requestPayload: {
        outputFormat: request.outputFormat || "mp3",
        overrides: request.overrides || {},
        voiceProfileId:
          request.voiceProfileId ||
          (typeof voiceProfile?.id === "string" ? voiceProfile.id : null),
        routerDecision: routePayload.routerDecision,
        routerPolicyVersion: routePayload.policyVersion,
      } as Prisma.InputJsonValue,
      appliedParams: {
        speed: ttsRequest?.speed ?? null,
        pitch: ttsRequest?.pitch ?? null,
        volume: ttsRequest?.volume ?? null,
        emotion: ttsRequest?.emotion ?? null,
        style: ttsRequest?.style ?? null,
        routerSelection: routePayload.selection,
      } as Prisma.InputJsonValue,
      metrics: {
        routerFallbackDepth: routeAttemptContext?.routeDecision.fallbackDepth ?? null,
        routerCandidateIndex: routeAttemptContext?.candidateIndex ?? null,
      } as Prisma.InputJsonValue,
      startedAt,
      finishedAt: now,
      durationMs: Math.max(0, now.getTime() - startedAt.getTime()),
      errorCode,
      errorMessage,
      isFinal,
    },
  });
}

export { buildRouteAttemptPayload };
