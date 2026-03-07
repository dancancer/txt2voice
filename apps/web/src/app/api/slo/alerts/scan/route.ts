// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/扫描参数/SLO 告警服务
// output: 核心 SLO 扫描结果
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { APIError, withErrorHandler } from "@/lib/error-handler";
import { parseSloAlertScheduleQuery } from "@/lib/slo-alerts/query";
import { scanSloAlertsForBooks } from "@/lib/slo-alerts/scanner";

const parseBookIdsFromRequest = (
  searchParams: URLSearchParams,
  body: unknown
): string[] => {
  const fromQuery = searchParams
    .getAll("bookId")
    .concat((searchParams.get("bookIds") || "").split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const fromBody =
    body && typeof body === "object" && !Array.isArray(body)
      ? Array.isArray((body as Record<string, unknown>).bookIds)
        ? ((body as Record<string, unknown>).bookIds as unknown[])
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        : []
      : [];

  return Array.from(new Set([...fromQuery, ...fromBody]));
};

const ensureScanToken = (request: NextRequest): void => {
  const requiredToken =
    process.env.SLO_ALERT_SCAN_TOKEN?.trim() ||
    process.env.QC_DISPATCH_ALERT_SCAN_TOKEN?.trim();
  if (!requiredToken) {
    return;
  }

  const incomingToken =
    request.headers.get("x-slo-alert-scan-token")?.trim() ||
    request.headers.get("x-qc-alert-scan-token")?.trim();
  if (incomingToken === requiredToken) {
    return;
  }

  throw new APIError("scan token invalid", 401, "UNAUTHORIZED");
};

// POST /api/slo/alerts/scan - 执行跨书籍核心 SLO 告警扫描
export const POST = withErrorHandler(async (request: NextRequest) => {
  ensureScanToken(request);

  const body = await request.json().catch(() => ({}));
  const { searchParams } = new URL(request.url);
  const query = parseSloAlertScheduleQuery(searchParams);
  const bookIds = parseBookIdsFromRequest(searchParams, body);
  const triggeredBy = request.headers.get("x-operator") || "scheduled_slo_scan_api";

  const result = await scanSloAlertsForBooks({
    query,
    bookIds,
    triggeredBy,
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
});
