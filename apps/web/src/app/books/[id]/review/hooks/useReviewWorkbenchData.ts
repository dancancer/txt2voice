// 一旦我被更新，请更新我的开头注释
// input: 书籍 ID
// output: 复核工作台状态与动作
// pos: 质检复核页面数据钩子

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { booksApi } from "@/lib/api";
import { SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS } from "@/lib/script-validation-detail";
import {
  SCRIPT_VALIDATION_ISSUE_TYPE,
  SCRIPT_VALIDATION_SUBTYPE_OPTIONS,
} from "@/lib/script-validation-review";
import type {
  BookSloMetricsResponse,
  DispatchAlertEvent,
  DispatchAlertEventListResponse,
  ManualReviewItem,
  ReviewRegenerateTask,
  ReviewRecommendedActionFilter,
  ManualReviewStatusFilter,
  ReviewListResponse,
  ReviewPagination,
  ReviewSummary,
  ReviewTaskListResponse,
  ReviewWorkbenchFilters,
} from "../models/types";
import { REVIEW_PAGE_LIMIT } from "../models/types";
import { useReviewWorkbenchActions } from "./useReviewWorkbenchActions";

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

const DEFAULT_DISPATCH_EVENT_SUMMARY = {
  openCount: 0,
  ackedCount: 0,
  resolvedCount: 0,
  totalCount: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toRegenerateTask = (
  task: NonNullable<ReviewTaskListResponse["data"]>[number]
): ReviewRegenerateTask | null => {
  const metadata = isRecord(task.metadata) ? task.metadata : null;
  const source =
    metadata?.source === "manual_review" || metadata?.source === "manual_review_batch"
      ? metadata.source
      : null;

  if (!source) {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata?.selectedReviewItemIds);
  const segmentIds = asStringArray(metadata?.segmentIds);
  const scriptSentenceIds = asStringArray(metadata?.scriptSentenceIds);
  const targetCount =
    selectedReviewItemIds.length ||
    segmentIds.length ||
    scriptSentenceIds.length ||
    1;

  return {
    id: task.id,
    taskType: task.taskType,
    status: task.status,
    progress: task.progress || 0,
    message: task.message || null,
    errorMessage: task.errorMessage || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt || null,
    source,
    targetCount,
  };
};

export function useReviewWorkbenchData(bookId: string) {
  const [bookTitle, setBookTitle] = useState("质检复核工作台");
  const [items, setItems] = useState<ManualReviewItem[]>([]);
  const [pagination, setPagination] = useState<ReviewPagination>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState<ReviewSummary>(DEFAULT_SUMMARY);
  const [sloMetrics, setSloMetrics] = useState<BookSloMetricsResponse["data"] | null>(null);
  const [dispatchEvents, setDispatchEvents] = useState<DispatchAlertEvent[]>([]);
  const [recentRegenerateTasks, setRecentRegenerateTasks] = useState<
    ReviewRegenerateTask[]
  >([]);
  const [dispatchEventSummary, setDispatchEventSummary] = useState(
    DEFAULT_DISPATCH_EVENT_SUMMARY
  );

  const [filters, setFilters] = useState<ReviewWorkbenchFilters>({
    status: "pending",
    issueType: "all",
    scriptSubtype: "all",
    recommendedAction: "all",
    priority: "all",
  });
  const [page, setPage] = useState(1);
  const [windowDays, setWindowDays] = useState(7);
  const [sourceFilter, setSourceFilter] = useState("all");

  const [reviewLoading, setReviewLoading] = useState(true);
  const [sloLoading, setSloLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issueTypeOptions = useMemo(() => {
    const options = new Set<string>(["CER", "SPEAKER", "EMOTION", "CONTINUITY", "AUDIO", SCRIPT_VALIDATION_ISSUE_TYPE]);
    for (const item of items) {
      if (item.issueType) {
        options.add(item.issueType.toUpperCase());
      }
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const showScriptSubtypeFilter = filters.issueType === SCRIPT_VALIDATION_ISSUE_TYPE;
  const showRecommendedActionFilter =
    filters.issueType === SCRIPT_VALIDATION_ISSUE_TYPE;

  const scriptSubtypeOptions = SCRIPT_VALIDATION_SUBTYPE_OPTIONS;
  const recommendedActionOptions = SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS;

  const loadBookTitle = useCallback(async () => {
    try {
      const bookResponse = await booksApi.getBook(bookId);
      setBookTitle(bookResponse.data.title || "质检复核工作台");
    } catch (loadError) {
      console.error("Failed to load book title:", loadError);
    }
  }, [bookId]);

  const buildReviewParams = useCallback(
    (nextPage?: number, includePaging = true) => {
      const params = new URLSearchParams();
      if (includePaging) {
        params.set("page", String(nextPage ?? page));
        params.set("limit", String(REVIEW_PAGE_LIMIT));
      }
      if (filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters.issueType !== "all") {
        params.set("issueType", filters.issueType);
      }
      if (filters.priority !== "all") {
        params.set("priority", filters.priority);
      }
      if (showScriptSubtypeFilter && filters.scriptSubtype !== "all") {
        params.set("scriptSubtype", filters.scriptSubtype);
      }
      if (showRecommendedActionFilter && filters.recommendedAction !== "all") {
        params.set("recommendedAction", filters.recommendedAction);
      }
      return params;
    },
    [
      filters.issueType,
      filters.priority,
      filters.recommendedAction,
      filters.scriptSubtype,
      filters.status,
      page,
      showRecommendedActionFilter,
      showScriptSubtypeFilter,
    ]
  );

  const loadReviewData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setReviewLoading(true);
      }

      const params = buildReviewParams();

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
    [bookId, buildReviewParams]
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

      try {
        const dispatchEventParams = new URLSearchParams({
          status: "active",
          page: "1",
          limit: "12",
          issueType: "SLO",
        });
        if (sourceFilter !== "all") {
          dispatchEventParams.set("source", sourceFilter);
        }

        const [sloMetricsResponse, dispatchEventResponse] = await Promise.all([
          fetch(`/api/books/${bookId}/slo/metrics?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/books/${bookId}/qc/dispatch-events?${dispatchEventParams.toString()}`, {
            cache: "no-store",
          }),
        ]);

        const [sloMetricsPayload, dispatchEventPayload] = (await Promise.all([
          sloMetricsResponse.json(),
          dispatchEventResponse.json(),
        ])) as [BookSloMetricsResponse, DispatchAlertEventListResponse];

        if (!sloMetricsResponse.ok || !sloMetricsPayload.success) {
          throw new Error(sloMetricsPayload.error?.message || "加载 SLO 指标失败");
        }
        if (!dispatchEventResponse.ok || !dispatchEventPayload.success) {
          throw new Error(dispatchEventPayload.error?.message || "加载告警事件失败");
        }

        setSloMetrics(sloMetricsPayload.data);
        setDispatchEvents(dispatchEventPayload.data || []);
        setDispatchEventSummary(
          dispatchEventPayload.summary || DEFAULT_DISPATCH_EVENT_SUMMARY
        );
      } catch (loadError) {
        console.error("Failed to load SLO board data:", loadError);
        toast.error(loadError instanceof Error ? loadError.message : "加载 SLO 指标失败");
      } finally {
        if (showLoading) {
          setSloLoading(false);
        }
      }
    },
    [bookId, sourceFilter, windowDays]
  );

  const loadRegenerateTasks = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setTaskLoading(true);
      }

      try {
        const params = new URLSearchParams({
          bookId,
          limit: "20",
        });
        const response = await fetch(`/api/tasks?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReviewTaskListResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "加载重生任务失败");
        }

        const tasks = (payload.data || [])
          .map((task) => toRegenerateTask(task))
          .filter((task): task is ReviewRegenerateTask => Boolean(task))
          .slice(0, 6);

        setRecentRegenerateTasks(tasks);
      } catch (loadError) {
        console.error("Failed to load regenerate tasks:", loadError);
        if (showLoading) {
          toast.error(loadError instanceof Error ? loadError.message : "加载重生任务失败");
        }
      } finally {
        if (showLoading) {
          setTaskLoading(false);
        }
      }
    },
    [bookId]
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

  useEffect(() => {
    loadRegenerateTasks();
  }, [loadRegenerateTasks]);

  const hasProcessingRegenerateTask = useMemo(
    () => recentRegenerateTasks.some((task) => task.status === "processing"),
    [recentRegenerateTasks]
  );

  useEffect(() => {
    if (!hasProcessingRegenerateTask) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all([loadReviewData(false), loadRegenerateTasks(false)]);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasProcessingRegenerateTask, loadRegenerateTasks, loadReviewData]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadReviewData(false),
      loadSloData(false),
      loadRegenerateTasks(false),
    ]);
    setRefreshing(false);
  }, [loadRegenerateTasks, loadReviewData, loadSloData]);

  const {
    actionLoadingItemId,
    batchActionLoading,
    dispatchEventActionId,
    resolveItem,
    resolveItemsInBatch,
    resolveDispatchEvent,
    exportReviewLogs,
  } = useReviewWorkbenchActions({
    bookId,
    buildReviewParams,
    refreshAfterReviewMutation: async () => {
      await Promise.all([
        loadReviewData(false),
        loadSloData(false),
        loadRegenerateTasks(false),
      ]);
    },
    refreshSloOnly: async () => {
      await loadSloData(false);
    },
  });

  const updateStatusFilter = useCallback((status: ManualReviewStatusFilter) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const updateIssueTypeFilter = useCallback((issueType: string) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      issueType,
      scriptSubtype:
        issueType === SCRIPT_VALIDATION_ISSUE_TYPE ? prev.scriptSubtype : "all",
      recommendedAction:
        issueType === SCRIPT_VALIDATION_ISSUE_TYPE
          ? prev.recommendedAction
          : "all",
    }));
  }, []);

  const updateScriptSubtypeFilter = useCallback((scriptSubtype: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, scriptSubtype }));
  }, []);

  const updateRecommendedActionFilter = useCallback(
    (recommendedAction: ReviewRecommendedActionFilter) => {
      setPage(1);
      setFilters((prev) => ({ ...prev, recommendedAction }));
    },
    []
  );

  const updatePriorityFilter = useCallback((priority: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, priority }));
  }, []);

  return {
    bookTitle,
    items,
    pagination,
    summary,
    sloMetrics,
    dispatchEvents,
    dispatchEventSummary,
    recentRegenerateTasks,
    filters,
    page,
    windowDays,
    sourceFilter,
    reviewLoading,
    sloLoading,
    taskLoading,
    refreshing,
    actionLoadingItemId,
    batchActionLoading,
    dispatchEventActionId,
    error,
    issueTypeOptions,
    recommendedActionOptions,
    scriptSubtypeOptions,
    showRecommendedActionFilter,
    showScriptSubtypeFilter,
    setPage,
    setWindowDays,
    setSourceFilter,
    loadReviewData,
    loadSloData,
    loadRegenerateTasks,
    refreshAll,
    updateStatusFilter,
    updateIssueTypeFilter,
    updateRecommendedActionFilter,
    updateScriptSubtypeFilter,
    updatePriorityFilter,
    resolveItem,
    resolveItemsInBatch,
    resolveDispatchEvent,
    exportReviewLogs,
  };
}
