import { NextRequest, NextResponse } from "next/server";
import {
  withErrorHandler,
  ValidationError,
  TTSError,
} from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  getScriptGenerator,
  ScriptGenerationOptions,
} from "@/lib/script-generator";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

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
    }: {
      options?: Partial<ScriptGenerationOptions>;
      startFromSegmentId?: string | null;
      regenerateSegments?: boolean;
    } = body;

    // Extract limitToSegments option if provided
    const limitToSegments = options.limitToSegments as number | undefined;
    // Remove limitToSegments from options before passing to script generator
    if (limitToSegments !== undefined) {
      delete (options as any).limitToSegments;
    }

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

    // 允许从多种状态生成台本
    const allowedStatuses = ["processed", "analyzed", "script_generated"];
    if (!allowedStatuses.includes(book.status)) {
      console.log("=====book.status", book.status);
      throw new ValidationError("请先完成文本处理");
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

      // 异步执行台本生成任务
      runScriptGeneration(bookId, task.id, options, {
        startFromSegmentId,
        startFromOrderIndex,
        regenerateSegments,
        limitToSegments,
      }).catch((error) => {
        console.error("台本生成任务失败:", error);
      });

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
        characterName: sentence.character?.canonicalName || "旁白",
        text: sentence.text,
        emotion: sentence.tone,
        segmentOrder: sentence.segment?.orderIndex,
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
    const { segmentIds = [] }: { segmentIds: string[] } = body;

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

    // 异步执行指定段落的台本生成
    runScriptGeneration(
      bookId,
      task.id,
      {},
      {
        segmentIds,
        regenerateSegments: true,
      }
    ).catch((error) => {
      console.error("段落台本重新生成失败:", error);
    });

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
          status: "analyzed",
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

/**
 * 执行台本生成任务
 */
async function runScriptGeneration(
  bookId: string,
  taskId: string,
  options: Partial<ScriptGenerationOptions>,
  extraParams: {
    startFromSegmentId?: string | null;
    startFromOrderIndex?: number | null;
    regenerateSegments?: boolean;
    segmentIds?: string[];
    limitToSegments?: number;
  } = {}
): Promise<void> {
  try {
    await updateTaskProgress(taskId, 10, "准备生成台本");

    const scriptGenerator = getScriptGenerator();
    let script: any;

    await updateTaskProgress(taskId, 30, "开始分析文本");

    // 根据参数选择不同的处理方式
    if (extraParams.regenerateSegments && extraParams.segmentIds) {
      // 重新生成指定段落
      console.log("重新生成指定段落:", extraParams.segmentIds);
      script = await scriptGenerator.regenerateSegmentScript(
        bookId,
        extraParams.segmentIds,
        options
      );
      await updateTaskProgress(taskId, 70, "保存段落台本数据");
      await scriptGenerator.savePartialScriptToDatabase(bookId, script);
    } else if (
      extraParams.startFromSegmentId ||
      extraParams.startFromOrderIndex !== null
    ) {
      // 增量处理或限制段落数量的处理
      console.log(
        "从指定段落开始处理:",
        extraParams.startFromSegmentId || extraParams.startFromOrderIndex
      );
      if (extraParams.limitToSegments) {
        // 限制段落数量的处理
        console.log("限制处理段落数量:", extraParams.limitToSegments);
        script = await scriptGenerator.generatePartialScript(bookId, options, {
          startFromSegmentId: extraParams.startFromSegmentId,
          startFromOrderIndex: extraParams.startFromOrderIndex,
        });
        // 手动限制段落数量
        script.segments = script.segments.slice(0, extraParams.limitToSegments);
        await updateTaskProgress(
          taskId,
          70,
          `保存前${extraParams.limitToSegments}个段落的台本数据`
        );
        await scriptGenerator.savePartialScriptToDatabase(bookId, script);
      } else {
        // 正常增量处理
        script = await scriptGenerator.generatePartialScript(bookId, options, {
          startFromSegmentId: extraParams.startFromSegmentId,
          startFromOrderIndex: extraParams.startFromOrderIndex,
        });
        await updateTaskProgress(taskId, 70, "保存增量台本数据");
        await scriptGenerator.savePartialScriptToDatabase(bookId, script);
      }
    } else {
      // 完整生成
      script = await scriptGenerator.generateScript(bookId, options);
      await updateTaskProgress(taskId, 70, "保存台本数据");
      await scriptGenerator.saveScriptToDatabase(bookId, script);
    }

    await updateTaskProgress(taskId, 90, "更新书籍状态");

    // 获取统计信息用于更新元数据
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        scriptSentences: true,
      },
    });

    await updateTaskProgress(taskId, 100, "台本生成完成");

    // 标记任务完成
    const taskData = await mergeTaskData(taskId, {
      message: extraParams.regenerateSegments
        ? "段落重新生成完成"
        : extraParams.startFromSegmentId
        ? "增量台本生成完成"
        : "台本生成完成",
      metadata: {
        totalLines: script.summary.totalLines,
        dialogueCount: script.summary.dialogueCount,
        narrationCount: script.summary.narrationCount,
        characterCount: Object.keys(script.summary.characterDistribution)
          .length,
        segmentCount: script.segments.length,
        isPartial:
          extraParams.startFromSegmentId || extraParams.regenerateSegments,
        regeneratedSegments: extraParams.segmentIds?.length || 0,
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "completed",
        completedAt: new Date(),
        taskData,
      },
    });
  } catch (error) {
    console.error("台本生成失败:", error);

    // 标记任务失败
    const taskData = await mergeTaskData(taskId, { message: "台本生成失败" });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        taskData,
      },
    });

    // 重置书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: "analyzed" },
    });

    throw error;
  }
}
