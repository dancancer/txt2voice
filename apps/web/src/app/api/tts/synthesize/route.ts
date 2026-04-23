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
    provider = "qwen3voice",
    voiceId,
    speakerId,
    temperature = 0.7,
    topK = 50,
    topP = 0.9,
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
        : typeof speakerId === "string" && speakerId.trim()
          ? speakerId.trim()
          : "";

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
          synthesisParams: {
            temperature,
            topK,
            topP,
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
