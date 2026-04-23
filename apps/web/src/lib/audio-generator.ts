// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from "./error-handler";
import prisma from "./prisma";
import { ttsServiceManager } from "./tts-service";
import { executeSingleAudioSynthesis } from "./audio-generation/execution/single-audio-executor";
import { generateBatchAudioWithReliability as runBatchAudioWithReliability } from "./audio-generation/execution/batch-audio-runtime";
import type {
  AudioBatchGenerationHooks,
  AudioBatchGenerationSummary,
  AudioGenerationOptions,
  AudioGenerationRequest,
  AudioGenerationResult,
  AudioReliabilitySummary,
} from "./audio-generation/types";

export type {
  AudioBatchGenerationHooks,
  AudioBatchGenerationSummary,
  AudioGenerationOptions,
  AudioGenerationRequest,
  AudioGenerationResult,
  AudioReliabilityPassSummary,
  AudioReliabilityProviderFailure,
  AudioReliabilitySummary,
} from "./audio-generation/types";

export class AudioGenerator {
  private readonly defaultOptions: AudioGenerationOptions = {
    batchSize: 5,
    maxRetries: 3,
    retryDelay: 1000,
    priority: "normal",
    skipExisting: true,
    overwriteExisting: false,
  };

  async generateSingleAudio(
    request: AudioGenerationRequest,
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult> {
    const { runAudioSynthesisRequest } = await import("./audio-synthesis-runtime");
    return runAudioSynthesisRequest({
      request,
      options,
      metadata: {
        source: "audio_generator",
      },
    });
  }

  async executeAudioSynthesis(
    request: AudioGenerationRequest,
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult> {
    return executeSingleAudioSynthesis({
      request,
      options,
      defaultOptions: this.defaultOptions,
      prismaClient: prisma,
      ttsServiceManager,
    });
  }

  async generateBatchAudio(
    requests: AudioGenerationRequest[],
    options: AudioGenerationOptions = {},
    hooks?: AudioBatchGenerationHooks
  ): Promise<AudioGenerationResult[]> {
    const summary = await this.generateBatchAudioWithReliability(
      requests,
      options,
      hooks
    );
    return summary.results;
  }

  async generateBatchAudioWithReliability(
    requests: AudioGenerationRequest[],
    options: AudioGenerationOptions = {},
    hooks?: AudioBatchGenerationHooks
  ): Promise<AudioBatchGenerationSummary> {
    return runBatchAudioWithReliability({
      requests,
      options,
      defaultOptions: this.defaultOptions,
      generateSingleAudio: (request, mergedOptions) =>
        this.generateSingleAudio(request, mergedOptions),
      hooks,
    });
  }

  async generateChapterAudio(
    bookId: string,
    chapterId: string,
    options: AudioGenerationOptions = {},
    hooks?: AudioBatchGenerationHooks
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    results: AudioGenerationResult[];
    reliability: AudioReliabilitySummary;
  }> {
    const scriptSentences = await prisma.scriptSentence.findMany({
      where: {
        bookId,
        chapterId,
      },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: {
                voiceProfile: true,
              },
            },
          },
        },
        segment: {
          select: {
            id: true,
            chapterId: true,
            chapterOrderIndex: true,
          },
        },
      },
      orderBy: [
        { segment: { chapterOrderIndex: "asc" } },
        { orderInSegment: "asc" },
      ],
    });

    if (scriptSentences.length === 0) {
      throw new TTSError("该章节没有可生成的台词", "TTS_SERVICE_DOWN", "audio-generator");
    }

    const summary = await this.generateBatchAudioWithReliability(
      scriptSentences.map((sentence) => ({
        scriptSentenceId: sentence.id,
        outputFormat: "mp3",
      })),
      options,
      hooks
    );

    return {
      total: summary.results.length,
      success: summary.results.filter((result) => result.success).length,
      failed: summary.results.filter((result) => !result.success).length,
      results: summary.results,
      reliability: summary.reliability,
    };
  }

  async generateBookAudio(
    bookId: string,
    options: AudioGenerationOptions = {},
    hooks?: AudioBatchGenerationHooks
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    results: AudioGenerationResult[];
    reliability: AudioReliabilitySummary;
  }> {
    const scriptSentences = await prisma.scriptSentence.findMany({
      where: { bookId },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: {
                voiceProfile: true,
              },
            },
          },
        },
        segment: {
          select: {
            id: true,
            chapterId: true,
          },
        },
      },
      orderBy: [
        { segment: { orderIndex: "asc" } },
        { orderInSegment: "asc" },
      ],
    });

    if (scriptSentences.length === 0) {
      throw new TTSError("没有找到可生成的台词", "TTS_SERVICE_DOWN", "audio-generator");
    }

    const summary = await this.generateBatchAudioWithReliability(
      scriptSentences.map((sentence) => ({
        scriptSentenceId: sentence.id,
        outputFormat: "mp3",
      })),
      options,
      hooks
    );

    return {
      total: summary.results.length,
      success: summary.results.filter((result) => result.success).length,
      failed: summary.results.filter((result) => !result.success).length,
      results: summary.results,
      reliability: summary.reliability,
    };
  }

  async regenerateFailedAudio(
    bookId: string,
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult[]> {
    const failedAudioFiles = await prisma.audioFile.findMany({
      where: {
        bookId,
        status: "failed",
      },
      include: {
        scriptSentence: true,
      },
    });

    if (failedAudioFiles.length === 0) {
      return [];
    }

    const requests: AudioGenerationRequest[] = failedAudioFiles
      .filter(
        (audioFile): audioFile is typeof audioFile & { sentenceId: string } =>
          Boolean(audioFile.sentenceId)
      )
      .map((audioFile) => ({
        scriptSentenceId: audioFile.sentenceId,
        voiceProfileId: audioFile.voiceProfileId ?? undefined,
        outputFormat: (audioFile.format as "mp3" | "wav" | "ogg") || "mp3",
      }));

    await prisma.audioFile.deleteMany({
      where: {
        id: {
          in: failedAudioFiles.map((audioFile) => audioFile.id),
        },
      },
    });

    return this.generateBatchAudio(requests, options);
  }
}

export function getAudioGenerator(): AudioGenerator {
  return new AudioGenerator();
}
