// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import {
  withErrorHandler,
  ValidationError,
} from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import {
  jsonObject,
  mergeTaskData,
} from "@/lib/processing-task-utils";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import { enqueueScriptGenerationJob } from "@/lib/task-queue";

// POST /api/books/[id]/script/generate - 生成朗读台本
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const {
      options = {},
      startFromSegmentId = null,
      regenerateSegments = false,
      limitToSegments,
    }: {
      options?: Partial<ScriptGenerationOptions>;
      startFromSegmentId?: string | null;
      regenerateSegments?: boolean;
      limitToSegments?: number;
    } = body;

    // 验证书籍状态
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        characterProfiles: {
          where: { isActive: true },
        },
        textSegments: true,
        scriptSentences: true,
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 允许从稳定状态重跑台本
    const allowedStatuses = [
      "processed",
      "manual_review_pending",
      "script_generated",
      "completed",
      "completed_with_errors",
    ];
    if (!allowedStatuses.includes(book.status)) {
      console.log("=====book.status", book.status);
      throw new ValidationError("请先完成文本处理");
    }

    if (book.status === "manual_review_pending") {
      const blockingReviewItem = await prisma.manualReviewItem.findFirst({
        where: {
          bookId,
          status: {
            in: ["pending", "reprocessing"],
          },
          issueType: {
            not: SCRIPT_VALIDATION_ISSUE_TYPE,
          },
        },
        select: {
          id: true,
        },
      });

      if (blockingReviewItem) {
        throw new ValidationError(
          "当前仍存在非台本校验复核项，请先完成相关复核后再重跑台本"
        );
      }
    }

    // 如果指定了起始段落，验证它是否存在
    let startFromOrderIndex = null;
    if (startFromSegmentId) {
      const startSegment = book.textSegments.find(
        (seg) => seg.id === startFromSegmentId
      );
      if (!startSegment) {
        throw new ValidationError("指定的起始段落不存在");
      }
      startFromOrderIndex = startSegment.orderIndex;
    }

    if (!book.textSegments || book.textSegments.length === 0) {
      throw new ValidationError("没有可处理的文本段落");
    }

    // 检查是否已经在生成中
    const existingTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
      },
    });

    if (existingTask) {
      throw new ValidationError("台本生成正在进行中，请稍后");
    }

    try {
      // 创建处理任务
      const taskData: any = {
        message: startFromSegmentId
          ? "从指定段落开始生成台本"
          : "开始生成朗读台本",
        regenerateSegments,
        limitToSegments: typeof limitToSegments === "number" ? limitToSegments : null,
        metadata: {
          previousBookStatus: book.status,
        },
      };

      if (startFromSegmentId) {
        taskData.startFromSegmentId = startFromSegmentId;
        taskData.startFromOrderIndex = startFromOrderIndex;
      }

      const task = await prisma.processingTask.create({
        data: {
          bookId,
          taskType: "SCRIPT_GENERATION",
          status: "processing",
          progress: 0,
          taskData,
        },
      });

      // 更新书籍状态
      await prisma.book.update({
        where: { id: bookId },
        data: { status: "generating_script" },
      });

      try {
        await enqueueScriptGenerationJob({
          taskId: task.id,
          bookId,
          options,
          extraParams: {
            startFromSegmentId,
            startFromOrderIndex,
            regenerateSegments,
            limitToSegments,
          },
        });
      } catch (queueError) {
        const message =
          queueError instanceof Error ? queueError.message : "台本任务入队失败";
        const failedTaskData = await mergeTaskData(task.id, {
          message: "台本任务入队失败",
          metadata: {
            queueError: message,
          },
        });

        await prisma.processingTask.update({
          where: { id: task.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: message,
            taskData: failedTaskData,
          },
        });

        await prisma.book.update({
          where: { id: bookId },
          data: { status: "processed" },
        });

        throw queueError;
      }

      return NextResponse.json({
        success: true,
        data: {
          taskId: task.id,
          message: "台本生成任务已启动",
          bookStatus: "generating_script",
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

// GET /api/books/[id]/script/generate - 获取生成状态和段落信息
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const includePreview = searchParams.get("includePreview") === "true";
    const previewLines = parseInt(searchParams.get("previewLines") || "10");
    const includeSegmentStatus =
      searchParams.get("includeSegmentStatus") === "true";

    const { id: bookId } = await params;
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          orderBy: { orderIndex: "asc" },
        },
        scriptSentences: {
          include: {
            character: {
              select: { id: true, canonicalName: true, genderHint: true },
            },
            segment: {
              select: { id: true, orderIndex: true },
            },
          },
          orderBy: [
            { segment: { orderIndex: "asc" } },
            { orderInSegment: "asc" },
          ],
          take: includePreview ? previewLines : undefined,
        },
        processingTasks: {
          where: { taskType: "SCRIPT_GENERATION" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const latestTask = book.processingTasks[0];

    const response: any = {
      success: true,
      data: {
        bookStatus: book.status,
        hasScript: book.scriptSentences.length > 0,
        scriptStatus: latestTask?.status || "not_started",
        totalLines: book.scriptSentences.length,
        totalSegments: book.textSegments.length,
        lastGenerated: latestTask?.completedAt,
        generationProgress: latestTask?.progress || 0,
      },
    };

    if (includePreview && book.scriptSentences.length > 0) {
      response.data.preview = book.scriptSentences.map((sentence) => ({
        id: sentence.id,
        speaker: sentence.character?.canonicalName || sentence.rawSpeaker || "旁白",
        text: sentence.text,
        tone: sentence.tone,
        segmentOrderIndex: sentence.segment?.orderIndex,
        orderInSegment: sentence.orderInSegment,
      }));
    }

    if (includeSegmentStatus && book.textSegments.length > 0) {
      // 分析每个段落的处理状态
      const segmentStatus = book.textSegments.map((segment) => {
        const segmentSentences = book.scriptSentences.filter(
          (sentence) => sentence.segmentId === segment.id
        );

        return {
          id: segment.id,
          orderIndex: segment.orderIndex,
          content: segment.content.substring(0, 100) + "...",
          wordCount: segment.content.length,
          processed: segmentSentences.length > 0,
          lineCount: segmentSentences.length,
          firstGeneratedAt:
            segmentSentences.length > 0
              ? new Date(
                  Math.min(
                    ...segmentSentences.map((s) =>
                      new Date(s.createdAt).getTime()
                    )
                  )
                )
              : null,
          lastGeneratedAt:
            segmentSentences.length > 0
              ? new Date(
                  Math.max(
                    ...segmentSentences.map((s) =>
                      new Date(s.createdAt).getTime()
                    )
                  )
                )
              : null,
        };
      });

      const processedSegments = segmentStatus.filter(
        (seg) => seg.processed
      ).length;
      const unprocessedSegments = book.textSegments.length - processedSegments;

      response.data.segments = {
        items: segmentStatus,
        summary: {
          total: book.textSegments.length,
          processed: processedSegments,
          unprocessed: unprocessedSegments,
          processedPercentage: Math.round(
            (processedSegments / book.textSegments.length) * 100
          ),
        },
      };
    }

    return NextResponse.json(response);
  }
);

// PATCH /api/books/[id]/script/generate - 重新生成特定段落
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();
    const {
      segmentIds = [],
      options = {},
    }: {
      segmentIds: string[];
      options?: Partial<ScriptGenerationOptions>;
    } = body;

    if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
      throw new ValidationError("请提供要重新生成的段落ID列表");
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          where: { id: { in: segmentIds } },
        },
      },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    if (book.textSegments.length !== segmentIds.length) {
      throw new ValidationError("部分段落不存在");
    }

    // 检查是否已经在生成中
    const existingTask = await prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
      },
    });

    if (existingTask) {
      throw new ValidationError("台本生成正在进行中，请稍后");
    }

    // 删除指定段落的台词记录
    await prisma.scriptSentence.deleteMany({
      where: {
        bookId: bookId,
        segmentId: { in: segmentIds },
      },
    });

    // 创建处理任务
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
        progress: 0,
        taskData: {
          message: `重新生成${segmentIds.length}个段落的台本`,
          regenerateSegments: true,
          segmentIds,
          segmentCount: segmentIds.length,
        },
      },
    });

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });

    try {
      await enqueueScriptGenerationJob({
        taskId: task.id,
        bookId,
        options,
        extraParams: {
          segmentIds,
          regenerateSegments: true,
        },
      });
    } catch (queueError) {
      const message =
        queueError instanceof Error ? queueError.message : "任务入队失败";
      const failedTaskData = await mergeTaskData(task.id, {
        message: "段落台本任务入队失败",
        metadata: {
          queueError: message,
        },
      });

      await prisma.processingTask.update({
        where: { id: task.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
          taskData: failedTaskData,
        },
      });

      await prisma.book.update({
        where: { id: bookId },
        data: { status: "processed" },
      });

      throw queueError;
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        message: `开始重新生成${segmentIds.length}个段落的台本`,
        segmentCount: segmentIds.length,
      },
    });
  }
);

// DELETE /api/books/[id]/script/generate - 清除所有台本
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    // 删除现有的台词记录
    await prisma.$transaction(async (tx) => {
      // 删除音频文件记录
      await tx.audioFile.deleteMany({
        where: { bookId: bookId },
      });

      // 删除台词记录
      await tx.scriptSentence.deleteMany({
        where: { bookId: bookId },
      });

      // 删除处理任务记录
      await tx.processingTask.deleteMany({
        where: {
          bookId: bookId,
          taskType: "SCRIPT_GENERATION",
        },
      });

      // 重置书籍状态
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: "processed",
          metadata: {
            ...jsonObject(book.metadata),
            scriptGeneratedAt: null,
            totalScriptLines: null,
            scriptDeletedAt: new Date().toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "台本已清除，可以重新生成",
    });
  }
);
