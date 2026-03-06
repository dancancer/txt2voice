// 一旦我被更新，请更新我的开头注释
// input: 书籍 ID
// output: 复核工作台状态与动作
// pos: 质检复核页面数据钩子

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { booksApi } from "@/lib/api";
import type {
  DispatchAlertResponse,
  DispatchMetricsResponse,
  ManualReviewItem,
  ManualReviewResolveAction,
  ManualReviewStatusFilter,
  PipelineStatusResponse,
  QualitySummary,
  ReviewListResponse,
  ReviewPagination,
  ReviewSummary,
  ReviewWorkbenchFilters,
} from "../models/types";
import { REVIEW_PAGE_LIMIT } from "../models/types";

const DEFAULT_PAGINATION: ReviewPagination = {
  page: 1,
  limit: REVIEW_PAGE_LIMIT,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const DEFAULT_SUMMARY: ReviewSummary = {
  pendingCount: 0,
  reprocessingCount: 0,
  resolvedCount: 0,
  rejectedCount: 0,
  total: 0,
};

const DEFAULT_QUALITY_SUMMARY: QualitySummary = {
  checked: 0,
  passCount: 0,
  repairCount: 0,
  manualReviewCount: 0,
  deepGateOverrideCount: 0,
  falsePositiveCandidateCount: 0,
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asNonNegativeNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0;
};

const parseQualitySummary = (value: unknown): QualitySummary => {
  const record = asRecord(value) || {};
  const falsePositiveSignals = asRecord(record.falsePositiveSignals) || {};

  return {
    checked: asNonNegativeNumber(record.checked),
    passCount: asNonNegativeNumber(record.passCount),
    repairCount: asNonNegativeNumber(record.repairCount),
    manualReviewCount: asNonNegativeNumber(record.manualReviewCount),
    deepGateOverrideCount:
      asNonNegativeNumber(record.deepGateOverrideCount) ||
      asNonNegativeNumber(falsePositiveSignals.deepGateOverrideCount),
    falsePositiveCandidateCount:
      asNonNegativeNumber(record.falsePositiveCandidateCount) ||
      asNonNegativeNumber(falsePositiveSignals.candidateCount),
  };
};

const resolveActionLabel = (action: ManualReviewResolveAction): string => {
  if (action === "approve") {
    return "通过";
  }
  if (action === "reject") {
    return "驳回";
  }
  return "重生";
};

export function useReviewWorkbenchData(bookId: string) {
  const [bookTitle, setBookTitle] = useState("质检复核工作台");
  const [items, setItems] = useState<ManualReviewItem[]>([]);
  const [pagination, setPagination] = useState<ReviewPagination>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState<ReviewSummary>(DEFAULT_SUMMARY);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary>(DEFAULT_QUALITY_SUMMARY);
  const [metrics, setMetrics] = useState<DispatchMetricsResponse["data"] | null>(null);
  const [alerts, setAlerts] = useState<DispatchAlertResponse["data"]["alerts"]>([]);

  const [filters, setFilters] = useState<ReviewWorkbenchFilters>({
    status: "pending",
    issueType: "all",
    priority: "all",
  });
  const [page, setPage] = useState(1);
  const [windowDays, setWindowDays] = useState(7);
  const [sourceFilter, setSourceFilter] = useState("all");

  const [reviewLoading, setReviewLoading] = useState(true);
  const [sloLoading, setSloLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issueTypeOptions = useMemo(() => {
    const options = new Set<string>(["CER", "SPEAKER", "EMOTION", "CONTINUITY", "AUDIO"]);
    for (const item of items) {
      if (item.issueType) {
        options.add(item.issueType.toUpperCase());
      }
    }
    for (const bucket of metrics?.byIssueType || []) {
      options.add(bucket.issueType.toUpperCase());
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [items, metrics]);

  const loadBookTitle = useCallback(async () => {
    try {
      const bookResponse = await booksApi.getBook(bookId);
      setBookTitle(bookResponse.data.title || "质检复核工作台");
    } catch (loadError) {
      console.error("Failed to load book title:", loadError);
    }
  }, [bookId]);

  const loadReviewData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setReviewLoading(true);
      }

      const params = new URLSearchParams({
        page: String(page),
        limit: String(REVIEW_PAGE_LIMIT),
      });
      if (filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters.issueType !== "all") {
        params.set("issueType", filters.issueType);
      }
      if (filters.priority !== "all") {
        params.set("priority", filters.priority);
      }

      try {
        const response = await fetch(`/api/books/${bookId}/review/items?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReviewListResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "加载人工复核列表失败");
        }

        setItems(payload.data.data || []);
        setPagination(payload.data.pagination || DEFAULT_PAGINATION);
        setSummary(payload.data.summary || DEFAULT_SUMMARY);
        setError(null);
      } catch (loadError) {
        console.error("Failed to load review list:", loadError);
        setError(loadError instanceof Error ? loadError.message : "加载人工复核列表失败");
      } finally {
        if (showLoading) {
          setReviewLoading(false);
        }
      }
    },
    [bookId, filters.issueType, filters.priority, filters.status, page]
  );

  const loadSloData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setSloLoading(true);
      }

      const params = new URLSearchParams({
        days: String(windowDays),
      });
      if (sourceFilter !== "all") {
        params.set("source", sourceFilter);
      }
      if (filters.issueType !== "all") {
        params.set("issueType", filters.issueType);
      }

      try {
        const [metricsResponse, alertsResponse, pipelineResponse] = await Promise.all([
          fetch(`/api/books/${bookId}/qc/dispatch-metrics?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/books/${bookId}/qc/dispatch-alerts?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/books/${bookId}/pipeline/status`, { cache: "no-store" }),
        ]);

        const [metricsPayload, alertsPayload, pipelinePayload] = (await Promise.all([
          metricsResponse.json(),
          alertsResponse.json(),
          pipelineResponse.json(),
        ])) as [DispatchMetricsResponse, DispatchAlertResponse, PipelineStatusResponse];

        if (!metricsResponse.ok || !metricsPayload.success) {
          throw new Error(metricsPayload.error?.message || "加载 dispatch 指标失败");
        }
        if (!alertsResponse.ok || !alertsPayload.success) {
          throw new Error(alertsPayload.error?.message || "加载 dispatch 告警失败");
        }
        if (!pipelineResponse.ok || !pipelinePayload.success) {
          throw new Error(pipelinePayload.error?.message || "加载 pipeline 状态失败");
        }

        setMetrics(metricsPayload.data);
        setAlerts(alertsPayload.data.alerts || []);
        setQualitySummary(parseQualitySummary(pipelinePayload.data.qualitySummary));
      } catch (loadError) {
        console.error("Failed to load SLO board data:", loadError);
        toast.error(loadError instanceof Error ? loadError.message : "加载 SLO 指标失败");
      } finally {
        if (showLoading) {
          setSloLoading(false);
        }
      }
    },
    [bookId, filters.issueType, sourceFilter, windowDays]
  );

  useEffect(() => {
    loadBookTitle();
  }, [loadBookTitle]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  useEffect(() => {
    loadSloData();
  }, [loadSloData]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadReviewData(false), loadSloData(false)]);
    setRefreshing(false);
  }, [loadReviewData, loadSloData]);

  const updateStatusFilter = useCallback((status: ManualReviewStatusFilter) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const updateIssueTypeFilter = useCallback((issueType: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, issueType }));
  }, []);

  const updatePriorityFilter = useCallback((priority: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, priority }));
  }, []);

  const resolveItem = useCallback(
    async (item: ManualReviewItem, action: ManualReviewResolveAction) => {
      const actionLabel = resolveActionLabel(action);
      if (action !== "approve") {
        const confirmed = window.confirm(`确认要执行“${actionLabel}”吗？`);
        if (!confirmed) {
          return;
        }
      }

      setActionLoadingItemId(item.id);
      try {
        const response = await fetch(
          `/api/books/${bookId}/review/items/${item.id}/resolve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          error?: { message?: string };
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || `${actionLabel}失败`);
        }

        toast.success(`${actionLabel}成功`);
        await Promise.all([loadReviewData(false), loadSloData(false)]);
      } catch (resolveError) {
        console.error("Failed to resolve manual review item:", resolveError);
        toast.error(
          resolveError instanceof Error ? resolveError.message : `${actionLabel}失败`
        );
      } finally {
        setActionLoadingItemId(null);
      }
    },
    [bookId, loadReviewData, loadSloData]
  );

  return {
    bookTitle,
    items,
    pagination,
    summary,
    qualitySummary,
    metrics,
    alerts,
    filters,
    page,
    windowDays,
    sourceFilter,
    reviewLoading,
    sloLoading,
    refreshing,
    actionLoadingItemId,
    error,
    issueTypeOptions,
    setPage,
    setWindowDays,
    setSourceFilter,
    loadReviewData,
    loadSloData,
    refreshAll,
    updateStatusFilter,
    updateIssueTypeFilter,
    updatePriorityFilter,
    resolveItem,
  };
}
