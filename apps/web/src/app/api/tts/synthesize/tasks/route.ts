import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { indexTTSService } from "@/lib/indextts-service";

// GET /api/tts/synthesize/tasks - 获取合成任务状态
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      {
        success: false,
        error: "taskId is required",
      },
      { status: 400 }
    );
  }

  try {
    const task = await indexTTSService.getSynthesisTask(taskId);

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.taskId,
        status: task.status,
        audioUrl: task.audioUrl,
        duration: task.duration,
        errorMessage: task.errorMessage,
        metadata: task.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to get synthesis task:", error);
    throw error;
  }
});
