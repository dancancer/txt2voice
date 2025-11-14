import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { indexTTSService } from "@/lib/indextts-service";

// POST /api/tts/synthesize/compare - 比较两个音频的说话人相似度
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { audioFile1, audioFile2 } = body;

  if (!audioFile1 || !audioFile2) {
    return NextResponse.json(
      {
        success: false,
        error: "audioFile1 and audioFile2 are required",
      },
      { status: 400 }
    );
  }

  try {
    const comparison = await indexTTSService.compareSpeakers(
      audioFile1,
      audioFile2
    );

    return NextResponse.json({
      success: true,
      data: {
        audioFile1,
        audioFile2,
        cosineSimilarity: comparison.cosineSimilarity,
        euclideanDistance: comparison.euclideanDistance,
        sameSpeakerProbability: comparison.sameSpeakerProbability,
        isSameSpeaker: comparison.isSameSpeaker,
        recommendation: comparison.isSameSpeaker
          ? "两个音频来自同一说话人，可以使用相同的语音模型"
          : "两个音频来自不同说话人，建议使用不同的语音模型",
      },
    });
  } catch (error) {
    console.error("Failed to compare speakers:", error);
    throw error;
  }
});
