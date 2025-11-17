import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { indexTTSService } from "@/lib/indextts-service";
import { ttsServiceManager } from "@/lib/tts-service";
import prisma from "@/lib/prisma";

// POST /api/tts/synthesize - 语音合成
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const {
    text,
    provider = "indextts",
    voiceId,
    referenceAudio,
    emotionControlMethod = "Same as the voice reference",
    emotionReference,
    emotionVector,
    emotionWeight = 0.7,
    sample = 1,
    temperature = 0.7,
    beamSearch = true,
    topK = 50,
    topP = 0.9,
    outputFormat = "mp3",
    speed = 1.0,
    pitch = 0,
    volume = 1.0,
  } = body;

  if (!text) {
    return NextResponse.json(
      {
        success: false,
        error: "text is required",
      },
      { status: 400 }
    );
  }

  if (!referenceAudio && provider === "indextts") {
    return NextResponse.json(
      {
        success: false,
        error: "referenceAudio is required for IndexTTS provider",
      },
      { status: 400 }
    );
  }

  try {
    let synthesisResult: any;

    if (provider === "indextts") {
      // 使用 IndexTTS 进行语音合成
      const synthesizeRequest = {
        text,
        referenceAudio,
        emoControlMethod: emotionControlMethod,
        emotionReference,
        emotionVector,
        emotionWeight,
        sample,
        temperature,
        beamSearch,
        topK,
        topP,
      };

      synthesisResult = await indexTTSService.synthesizeAndWait(
        synthesizeRequest,
        {
          timeout: 300000, // 5分钟超时，适配长文案
          interval: 3000, // 3秒检查一次
        }
      );

      // 更新说话人使用次数
      if (referenceAudio) {
        const speaker = await prisma.speakerProfile.findFirst({
          where: {
            OR: [
              { referenceAudio },
              {
                metadata: {
                  path: ["uploadData", "filename"],
                  equals: referenceAudio,
                },
              },
            ],
          },
        });

        if (speaker) {
          await prisma.speakerProfile.update({
            where: { id: speaker.id },
            data: {
              usageCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });
        }
      }
    } else {
      await ttsServiceManager.ready();
      // 使用其他 TTS 提供商
      const ttsProvider = ttsServiceManager.getProvider(provider);
      if (!ttsProvider) {
        return NextResponse.json(
          {
            success: false,
            error: `TTS provider ${provider} not available`,
          },
          { status: 400 }
        );
      }

      const voice = await ttsServiceManager.getVoice(provider, voiceId);
      if (!voice) {
        return NextResponse.json(
          {
            success: false,
            error: `Voice ${voiceId} not found for provider ${provider}`,
          },
          { status: 400 }
        );
      }

      const ttsRequest = {
        text,
        voice,
        outputFormat,
        speed,
        pitch,
        volume,
      };

      synthesisResult = await ttsServiceManager.synthesize(
        ttsRequest,
        provider
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: synthesisResult.taskId || `local-${Date.now()}`,
        status: synthesisResult.status || "completed",
        audioUrl: synthesisResult.audioUrl,
        duration: synthesisResult.duration,
        format: outputFormat,
        metadata: {
          provider,
          text,
          referenceAudio,
          emotionControlMethod,
          emotionWeight,
          synthesisParams: {
            sample,
            temperature,
            beamSearch,
            topK,
            topP,
          },
          audioParams: {
            outputFormat,
            speed,
            pitch,
            volume,
          },
          ...synthesisResult.metadata,
        },
      },
    });
  } catch (error) {
    console.error("Failed to synthesize speech:", error);
    throw error;
  }
});
