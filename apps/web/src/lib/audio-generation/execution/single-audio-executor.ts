import type prisma from "@/lib/prisma";
import type { TTSRequest } from "@/lib/tts-service";
import { TTSError } from "@/lib/error-handler";

import type {
  AudioGenerationOptions,
  AudioGenerationRequest,
  AudioGenerationResult,
  VoiceRouteResolution,
} from "../types";
import { createRouteAttemptContext, applyRouterPresetToRequest } from "../routing/route-attempt";
import { runVoiceRoutingAgent } from "@/lib/auto-pipeline/voice-routing-agent";
import { buildTTSRequest } from "../synthesis/tts-request-builder";
import { recordFailedSynthesisAttempt } from "../persistence/synthesis-attempt-store";
import { saveAudioFile } from "../persistence/audio-file-store";

const isRetryableAudioError = (error: unknown): error is TTSError =>
  error instanceof TTSError && error.retryable === true;

export async function executeSingleAudioSynthesis(params: {
  request: AudioGenerationRequest;
  options: AudioGenerationOptions;
  defaultOptions: AudioGenerationOptions;
  prismaClient: typeof prisma;
  ttsServiceManager: {
    synthesize: (request: TTSRequest, provider: string) => Promise<any>;
    ready: () => Promise<void>;
    getVoice: (provider: string, voiceId: string) => Promise<any>;
  };
}): Promise<AudioGenerationResult> {
  const { request, options, defaultOptions, prismaClient, ttsServiceManager } = params;
  const finalOptions = { ...defaultOptions, ...options };
  let scriptSentence: any | null = null;
  let attemptStartedAt: Date | null = null;
  let routeResolution: VoiceRouteResolution | null = null;
  let lastError: unknown = null;

  try {
    scriptSentence = await prismaClient.scriptSentence.findUnique({
      where: { id: request.scriptSentenceId },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: {
                voiceProfile: true,
              },
              orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            },
            speakerBindings: {
              include: {
                speakerProfile: {
                  include: {
                    engineVariants: {
                      where: {
                        isActive: true,
                      },
                      include: {
                        emotionPresets: {
                          where: {
                            isActive: true,
                          },
                        },
                      },
                      orderBy: [
                        { isDefault: "desc" },
                        { routingWeight: "desc" },
                        { createdAt: "asc" },
                      ],
                    },
                  },
                },
              },
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
          },
        },
        segment: {
          select: {
            id: true,
            chapterId: true,
          },
        },
        book: true,
      },
    });

    if (!scriptSentence) {
      return {
        success: false,
        error: "台词不存在",
      };
    }

    if (finalOptions.skipExisting) {
      const existingAudio = await prismaClient.audioFile.findFirst({
        where: {
          sentenceId: request.scriptSentenceId,
          status: "completed",
        },
      });

      if (existingAudio && !finalOptions.overwriteExisting) {
        return {
          success: true,
          audioFileId: existingAudio.id,
          duration: Number(existingAudio.duration) ?? undefined,
          fileSize: Number(existingAudio.fileSize) ?? undefined,
        };
      }
    }

    attemptStartedAt = new Date();
    const voiceRoutingDecision = await runVoiceRoutingAgent({
      scriptSentence,
      request,
      options: finalOptions,
      prismaClient,
    });
    routeResolution = voiceRoutingDecision.routeResolution;

    if (!routeResolution?.selectedCandidate) {
      try {
        await recordFailedSynthesisAttempt({
          scriptSentence,
          request,
          startedAt: attemptStartedAt,
          prismaClient,
          routeAttemptContext: routeResolution
            ? createRouteAttemptContext({
                routeResolution,
                selectedCandidate: routeResolution.rankedCandidates[0] || null,
                candidateIndex: 0,
              })
            : undefined,
          fallbackEngine:
            finalOptions.preferredProvider || scriptSentence.engineHint || undefined,
          error: new Error("未找到可用的声音配置（包含旁白兜底）"),
        });
      } catch (persistError) {
        console.warn("写入失败合成尝试记录失败:", persistError);
      }

      return {
        success: false,
        error: "未找到可用的声音配置（包含旁白兜底）",
      };
    }

    const attemptCandidates = routeResolution.rankedCandidates.filter(
      (candidate) => candidate.eligible && Boolean(candidate.voiceProfile)
    );

    for (let index = 0; index < attemptCandidates.length; index += 1) {
      const candidate = attemptCandidates[index];
      const voiceProfile = candidate.voiceProfile;
      if (!voiceProfile) {
        continue;
      }

      const routeAttemptContext = createRouteAttemptContext({
        routeResolution,
        selectedCandidate: candidate,
        candidateIndex: index,
      });
      const effectiveRequest = applyRouterPresetToRequest(
        request,
        candidate.matchedPreset
      );
      let ttsRequest: TTSRequest | null = null;

      try {
        ttsRequest = await buildTTSRequest({
          scriptSentence,
          voiceProfile,
          request: effectiveRequest,
          routeAttemptContext,
          ttsServiceManager,
        });

        const ttsResponse = await ttsServiceManager.synthesize(
          ttsRequest,
          voiceProfile.provider
        );
        const audioFile = await saveAudioFile({
          scriptSentence,
          voiceProfile,
          ttsResponse,
          request: effectiveRequest,
          ttsRequest,
          startedAt: attemptStartedAt,
          prismaClient,
          routeAttemptContext,
        });

        return {
          success: true,
          audioFileId: audioFile.id,
          duration: Number(audioFile.duration) ?? undefined,
          fileSize: Number(audioFile.fileSize) ?? undefined,
          metadata: {
            routerDecision: routeAttemptContext.routeDecision,
            routerPolicyVersion: routeAttemptContext.policyVersion,
            fallbackDepth: routeAttemptContext.routeDecision.fallbackDepth,
            attemptCandidateId: candidate.candidateId,
            attemptSource: candidate.source,
            attemptEngine: candidate.provider,
          },
        };
      } catch (error) {
        lastError = error;
        const isFinalAttempt = index >= attemptCandidates.length - 1;

        try {
          await recordFailedSynthesisAttempt({
            scriptSentence,
            voiceProfile,
            request: effectiveRequest,
            ttsRequest,
            startedAt: attemptStartedAt,
            prismaClient,
            fallbackEngine:
              finalOptions.preferredProvider || scriptSentence.engineHint || undefined,
            routeAttemptContext,
            error,
            isFinal: isFinalAttempt,
          });
        } catch (persistError) {
          console.warn("写入失败合成尝试记录失败:", persistError);
        }

        if (!isFinalAttempt && finalOptions.enableRouterDebug) {
          console.warn("音频路由降级重试", {
            sentenceId: request.scriptSentenceId,
            candidateId: candidate.candidateId,
            provider: candidate.provider,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    }

    if (isRetryableAudioError(lastError)) {
      throw lastError;
    }

    return {
      success: false,
      error:
        lastError instanceof Error
          ? lastError.message
          : "音频生成失败：全部路由候选均失败",
      metadata: {
        routerDecision: routeResolution.routeDecision,
      },
    };
  } catch (error) {
    console.error("音频生成失败:", error);

    if (scriptSentence && attemptStartedAt && !routeResolution?.selectedCandidate) {
      try {
        await recordFailedSynthesisAttempt({
          scriptSentence,
          request,
          startedAt: attemptStartedAt,
          prismaClient,
          fallbackEngine:
            finalOptions.preferredProvider || scriptSentence.engineHint || undefined,
          routeAttemptContext: routeResolution
            ? createRouteAttemptContext({
                routeResolution,
                selectedCandidate: routeResolution.rankedCandidates[0] || null,
                candidateIndex: 0,
              })
            : undefined,
          error,
        });
      } catch (persistError) {
        console.warn("写入失败合成尝试记录失败:", persistError);
      }
    }

    if (isRetryableAudioError(error)) {
      throw error;
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
