// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/查询参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  createPaginationResponse,
  parsePaginationParams,
} from "@/lib/api-utils";
import { formatProcessingTask } from "@/lib/processing-task-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const status = searchParams.get("status")?.trim();
  const taskType = searchParams.get("taskType")?.trim();
  const bookId = searchParams.get("bookId")?.trim();

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (taskType) {
    where.taskType = taskType;
  }
  if (bookId) {
    where.bookId = bookId;
  }

  const [tasks, total] = await Promise.all([
    prisma.processingTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        book: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.processingTask.count({ where }),
  ]);

  const data = tasks.map((task) => {
    const formatted = formatProcessingTask(task);
    return {
      id: formatted.id,
      bookId: formatted.bookId,
      bookTitle: task.book?.title || null,
      taskType: formatted.taskType,
      status: formatted.status,
      progress: formatted.progress,
      message: formatted.message,
      metadata: formatted.metadata,
      errorMessage: formatted.error,
      createdAt: formatted.createdAt,
      updatedAt: formatted.updatedAt,
      completedAt: formatted.completedAt,
    };
  });

  return NextResponse.json({
    success: true,
    ...createPaginationResponse(data, total, page, limit),
  });
});
