// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma from "@/lib/prisma";

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; chapterId: string }> }
  ) => {
    const { id: bookId, chapterId } = await params;
    const body = await request.json().catch(() => ({}));

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      select: { id: true },
    });

    if (!chapter) {
      throw new ValidationError("章节不存在");
    }

    const payload = {
      type: "chapter",
      chapterId,
      autoMerge: body?.autoMerge ?? true,
      voiceProfileId: body?.voiceProfileId,
      options: body?.options || {
        skipExisting: body?.skipExisting ?? true,
        overwriteExisting: body?.overwriteExisting ?? false,
        batchSize: body?.batchSize,
        provider: body?.provider,
      },
    };

    const response = await fetch(`${request.nextUrl.origin}/api/books/${bookId}/audio/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    return NextResponse.json(result, {
      status: response.status,
    });
  }
);
