// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import {
  createBookScriptSentence,
  deleteBookScriptSentences,
  listBookScriptSentences,
  reorderBookScriptSentences,
  updateBookScriptSentences,
} from "@/lib/script-sentence-service";

// GET /api/books/[id]/scripts - 获取书籍台本列表（分页）
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    const result = await listBookScriptSentences(bookId, searchParams);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

// POST /api/books/[id]/scripts - 创建新台本句子
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();

    const created = await createBookScriptSentence(bookId, body);

    return NextResponse.json({
      success: true,
      data: created,
    });
  }
);

// PUT /api/books/[id]/scripts - 批量更新台本句子
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();

    const updated = await updateBookScriptSentences(bookId, body);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  }
);

// DELETE /api/books/[id]/scripts - 批量删除台词
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);

    const result = await deleteBookScriptSentences(bookId, searchParams);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);

// PATCH /api/books/[id]/scripts - 重新排序台词
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;
    const body = await request.json();

    const result = await reorderBookScriptSentences(bookId, body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }
);
