import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

import { Prisma } from "@/generated/prisma";
import { getBookAudioDir } from "@/lib/storage-path";
import type prisma from "@/lib/prisma";
import type { TTSRequest } from "@/lib/tts-service";

import type {
  AudioGenerationRequest,
  RouteAttemptContext,
} from "../types";
import { buildRouteAttemptPayload } from "./synthesis-attempt-store";
import { resolveAudioDurationSeconds } from "../synthesis/tts-parameter-normalizer";

const resolveGeneratedReferenceAudio = (ttsResponse: any): string | null => {
  const filename = ttsResponse?.metadata?.filename;
  if (typeof filename === "string" && filename.trim().length > 0) {
    return filename.trim();
  }

  return null;
};

const shouldBackfillVoxCpmReference = (
  voiceProfile: any,
  routeAttemptContext: RouteAttemptContext | undefined,
  referenceAudio: string | null
): boolean =>
  voiceProfile?.provider === "voxcpm" &&
  Boolean(referenceAudio) &&
  Boolean(routeAttemptContext?.selectedCandidate.speakerEngineVariantId);

export async function saveAudioFile(params: {
  scriptSentence: any;
  voiceProfile: any;
  ttsResponse: any;
  request: AudioGenerationRequest;
  ttsRequest: TTSRequest;
  startedAt: Date | null;
  prismaClient: typeof prisma;
  routeAttemptContext?: RouteAttemptContext;
}) {
  const {
    scriptSentence,
    voiceProfile,
    ttsResponse,
    request,
    ttsRequest,
    startedAt,
    prismaClient,
    routeAttemptContext,
  } = params;

  const audioDir = getBookAudioDir(scriptSentence.bookId);
  try {
    await mkdir(audioDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create audio directory:", error);
  }

  const timestamp = Date.now();
  const filename = `${scriptSentence.id}_${timestamp}.${request.outputFormat || "mp3"}`;
  const filePath = join(audioDir, filename);
  await writeFile(filePath, Buffer.from(ttsResponse.audioBuffer));

  const fileSize = (await import("fs").then((fs) => fs.statSync(filePath))).size;
  const durationSeconds = resolveAudioDurationSeconds(
    scriptSentence.text,
    ttsResponse?.duration
  );
  const generatedReferenceAudio = resolveGeneratedReferenceAudio(ttsResponse);
  const attemptNo =
    (await prismaClient.synthesisAttempt.count({
      where: {
        sentenceId: scriptSentence.id,
      },
    })) + 1;

  return prismaClient.$transaction(async (tx) => {
    const audioFile = await tx.audioFile.create({
      data: {
        sentenceId: scriptSentence.id,
        segmentId: scriptSentence.segmentId,
        chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
        bookId: scriptSentence.bookId,
        voiceProfileId: typeof voiceProfile.id === "string" ? voiceProfile.id : null,
        filePath,
        fileName: filename,
        fileSize: BigInt(fileSize),
        duration: durationSeconds,
        format: request.outputFormat || "mp3",
        status: "completed",
        provider: voiceProfile.provider,
        attemptNo,
        engineUsed: voiceProfile.provider,
        qualityStatus: "pending",
      },
    });

    const now = new Date();
    const routePayload = buildRouteAttemptPayload(routeAttemptContext);
    await tx.synthesisAttempt.create({
      data: {
        bookId: scriptSentence.bookId,
        chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
        segmentId: scriptSentence.segmentId,
        sentenceId: scriptSentence.id,
        audioFileId: audioFile.id,
        speakerProfileId:
          routeAttemptContext?.selectedCandidate.speakerProfileId || null,
        speakerEngineVariantId:
          routeAttemptContext?.selectedCandidate.speakerEngineVariantId || null,
        engine: voiceProfile.provider || "unknown",
        status: "completed",
        attemptNo,
        triggerType: "auto",
        requestPayload: {
          outputFormat: request.outputFormat || "mp3",
          overrides: request.overrides || {},
          voiceProfileId:
            request.voiceProfileId ||
            (typeof voiceProfile.id === "string" ? voiceProfile.id : null),
          routerDecision: routePayload.routerDecision,
          routerPolicyVersion: routePayload.policyVersion,
        } as Prisma.InputJsonValue,
        appliedParams: {
          speed: ttsRequest.speed,
          pitch: ttsRequest.pitch,
          volume: ttsRequest.volume,
          emotion: ttsRequest.emotion,
          style: ttsRequest.style,
          routerSelection: routePayload.selection,
        } as Prisma.InputJsonValue,
        metrics: {
          durationSeconds,
          fileSize,
          routerFallbackDepth: routePayload.fallbackDepth,
          routerCandidateIndex: routeAttemptContext?.candidateIndex ?? null,
        } as Prisma.InputJsonValue,
        startedAt: startedAt ?? now,
        finishedAt: now,
        durationMs: startedAt ? Math.max(0, now.getTime() - startedAt.getTime()) : null,
        isFinal: true,
      },
    });

    if (
      shouldBackfillVoxCpmReference(
        voiceProfile,
        routeAttemptContext,
        generatedReferenceAudio
      )
    ) {
      await tx.speakerEngineVariant.updateMany({
        where: {
          id: routeAttemptContext!.selectedCandidate.speakerEngineVariantId!,
          referenceAudio: null,
        },
        data: {
          referenceAudio: generatedReferenceAudio,
        },
      });
    }

    return audioFile;
  });
}
