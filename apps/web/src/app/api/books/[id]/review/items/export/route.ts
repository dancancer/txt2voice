// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/查询参数
// output: 复核处置日志 CSV 导出
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, withErrorHandler } from "@/lib/error-handler";
import prisma from "@/lib/prisma";
import {
  exportManualReviewItems,
  parseManualReviewExportQuery,
  toManualReviewCsv,
} from "@/lib/manual-review-service";

const buildFileName = (bookId: string): string => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
  return `manual-review-log-${bookId}-${stamp}.csv`;
};

// GET /api/books/[id]/review/items/export - 导出人工复核处置日志
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new ValidationError("书籍不存在");
    }

    const { searchParams } = new URL(request.url);
    const query = parseManualReviewExportQuery(searchParams);
    const rows = await exportManualReviewItems(bookId, query);
    const csv = toManualReviewCsv(rows);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${buildFileName(bookId)}\"`,
        "Cache-Control": "no-store",
      },
    });
  }
);
