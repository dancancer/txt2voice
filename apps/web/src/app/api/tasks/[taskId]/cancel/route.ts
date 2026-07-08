// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import { assertReplayPermission } from "@/lib/task-replay-auth";
import { cancelProcessingTask } from "@/lib/task-queue";

// POST /api/tasks/[taskId]/cancel - 手动取消任务
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
  ) => {
    assertReplayPermission(request);

    const { taskId } = await params;
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

    if (task.status === "completed" || task.status === "failed") {
      throw new ValidationError("仅支持取消等待中、执行中或已取消的任务");
    }

    const cancelResult = await cancelProcessingTask(taskId, {
      reason: "manual_api_cancel",
    });

    return NextResponse.json({
      success: true,
      data: cancelResult,
    });
  }
);
