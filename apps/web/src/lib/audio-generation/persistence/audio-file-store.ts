import { mkdir, readFile, stat, writeFile } from "fs/promises";
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

export type ReferenceAudioUploader = (params: {
  provider: string;
  filePath: string;
  fileName: string;
}) => Promise<string | null | undefined>;

const asNonEmptyText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const inferAudioMimeType = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "wav") {
    return "audio/wav";
  }
  if (extension === "ogg") {
    return "audio/ogg";
  }

  return "audio/mpeg";
};

const uploadVoxCpmReferenceAudio: ReferenceAudioUploader = async ({
  provider,
  filePath,
  fileName,
}) => {
  if (provider !== "voxcpm") {
    return null;
  }

  const { VoxCPMService } = await import("@/lib/voxcpm-service");
  const audioBuffer = await readFile(filePath);
  const uploadFile = new File([new Uint8Array(audioBuffer)], fileName, {
    type: inferAudioMimeType(fileName),
  });
  const result = await new VoxCPMService().uploadAudio(uploadFile);

  return asNonEmptyText(result.filename);
};

const hasExistingCandidateReferenceAudio = (
  routeAttemptContext: RouteAttemptContext | undefined
): boolean => {
  const voiceProfile = routeAttemptContext?.selectedCandidate.voiceProfile;
  const defaultParameters = voiceProfile?.defaultParameters || {};

  return Boolean(
    asNonEmptyText(voiceProfile?.referenceAudio) ||
      asNonEmptyText(defaultParameters.referenceAudio) ||
      asNonEmptyText(defaultParameters.reference_audio)
  );
};

const shouldBackfillVoxCpmReference = (
  voiceProfile: any,
  routeAttemptContext: RouteAttemptContext | undefined
): boolean =>
  voiceProfile?.provider === "voxcpm" &&
  !hasExistingCandidateReferenceAudio(routeAttemptContext) &&
  Boolean(routeAttemptContext?.selectedCandidate.speakerEngineVariantId);

const uploadGeneratedReferenceAudio = async (params: {
  provider: string;
  filePath: string;
  fileName: string;
  uploadReferenceAudio: ReferenceAudioUploader;
}): Promise<string | null> => {
  try {
    return (
      asNonEmptyText(
        await params.uploadReferenceAudio({
          provider: params.provider,
          filePath: params.filePath,
          fileName: params.fileName,
        })
      ) || null
    );
  } catch (error) {
    console.warn("VoxCPM reference audio upload failed:", error);
    return null;
  }
};

export async function saveAudioFile(params: {
  scriptSentence: any;
  voiceProfile: any;
  ttsResponse: any;
  request: AudioGenerationRequest;
  ttsRequest: TTSRequest;
  startedAt: Date | null;
  prismaClient: typeof prisma;
  routeAttemptContext?: RouteAttemptContext;
  uploadReferenceAudio?: ReferenceAudioUploader;
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
    uploadReferenceAudio = uploadVoxCpmReferenceAudio,
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

  const fileSize = (await stat(filePath)).size;
  const durationSeconds = resolveAudioDurationSeconds(
    scriptSentence.text,
    ttsResponse?.duration
  );
  const attemptNo =
    (await prismaClient.synthesisAttempt.count({
      where: {
        sentenceId: scriptSentence.id,
      },
    })) + 1;
  const generatedReferenceAudio = shouldBackfillVoxCpmReference(
    voiceProfile,
    routeAttemptContext
  )
    ? await uploadGeneratedReferenceAudio({
        provider: voiceProfile.provider,
        filePath,
        fileName: filename,
        uploadReferenceAudio,
      })
    : null;

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
      generatedReferenceAudio &&
      shouldBackfillVoxCpmReference(voiceProfile, routeAttemptContext)
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
