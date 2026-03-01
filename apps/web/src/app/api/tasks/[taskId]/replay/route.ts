// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { assertReplayPermission } from "@/lib/task-replay-auth";
import { replayProcessingTask } from "@/lib/task-queue";

// POST /api/tasks/[taskId]/replay - 手动重放任务
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
  ) => {
    assertReplayPermission(request);

    const { taskId } = await params;
    const body = await request.json().catch(() => ({}));
    const force = body?.force !== false;

    const task = await prisma.processingTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        bookId: true,
        taskType: true,
        status: true,
      },
    });

    if (!task) {
      throw new ValidationError("任务不存在");
    }

    if (task.taskType !== "SCRIPT_GENERATION" && task.taskType !== "AUDIO_GENERATION") {
      throw new ValidationError("仅支持重放台本或音频生成任务");
    }

    const replayResult = await replayProcessingTask(taskId, {
      force,
      reason: "manual_api_replay",
    });

    return NextResponse.json({
      success: true,
      data: {
        ...replayResult,
        bookId: task.bookId,
      },
    });
  }
);
