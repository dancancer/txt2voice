// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { ttsServiceManager } from "@/lib/tts-service";

// POST /api/tts/synthesize - 语音合成
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const {
    text,
    provider = "voxcpm",
    voiceId,
    speakerId,
    referenceAudio,
    promptAudio,
    promptText,
    temperature = 0.7,
    topK = 50,
    topP = 0.9,
    controlInstruction,
    cfgValue,
    inferenceTimesteps,
    normalize,
    denoise,
    outputFormat = "mp3",
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

  try {
    await ttsServiceManager.ready();

    const resolvedVoiceId =
      typeof voiceId === "string" && voiceId.trim()
        ? voiceId.trim()
        : "__voxcpm_default__";

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

    const voice = await ttsServiceManager.getVoice(provider, resolvedVoiceId);
    if (!voice) {
      return NextResponse.json(
        {
          success: false,
          error: `Voice ${resolvedVoiceId} not found for provider ${provider}`,
        },
        { status: 400 }
      );
    }

    const synthesisResult = await ttsServiceManager.synthesize(
      {
        text,
        voice,
        outputFormat,
        temperature,
        topK,
        topP,
        referenceAudio:
          typeof referenceAudio === "string" ? referenceAudio.trim() : undefined,
        promptAudio: typeof promptAudio === "string" ? promptAudio.trim() : undefined,
        promptText: typeof promptText === "string" ? promptText.trim() : undefined,
        providerParams:
          provider === "voxcpm"
            ? {
                voxcpm: {
                  controlInstruction,
                  cfgValue,
                  inferenceTimesteps,
                  normalize,
                  denoise,
                },
              }
            : undefined,
      },
      provider
    );

    const audioUrl = synthesisResult.metadata?.audioUrl || null;

    return NextResponse.json({
      success: true,
      data: {
        taskId:
          typeof synthesisResult.metadata?.jobId === "string"
            ? synthesisResult.metadata.jobId
            : `local-${Date.now()}`,
        status:
          typeof synthesisResult.metadata?.status === "string"
            ? synthesisResult.metadata.status
            : "completed",
        audioUrl,
        duration: synthesisResult.duration,
        format: synthesisResult.format || outputFormat,
        metadata: {
          provider,
          text,
          speakerId,
          synthesisParams: {
            temperature,
            topK,
            topP,
            controlInstruction,
            cfgValue,
            inferenceTimesteps,
            normalize,
            denoise,
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
