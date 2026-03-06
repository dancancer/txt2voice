// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/自动编排触发参数
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { parseAutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import { startAutoPipelineTask } from "@/lib/auto-pipeline-trigger-service";

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json().catch(() => ({}));
    const options = parseAutoPipelineOptions(body?.options);
    const result = await startAutoPipelineTask({
      bookId,
      options,
      triggerSource: "pipeline_auto_api",
      allowReuseRunningTask: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        message: result.reused
          ? "已有自动编排任务执行中，已返回当前任务"
          : "Auto Pipeline 任务已启动",
        bookStatus: "processing",
        totalStages: result.totalStages,
        qualityCheckEnabled: result.qualityCheckEnabled,
        reused: result.reused,
      },
    });
  }
);
