// 一旦我被更新，请更新我的开头注释
// input: 书籍 ID/回调依赖
// output: 复核处置与告警事件动作
// pos: 质检复核页面动作钩子

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  ManualReviewItem,
  ManualReviewResolveAction,
  ReviewBatchResolveResponse,
  ReviewScriptSaveResponse,
} from "../models/types";

interface ReviewWorkbenchActionInput {
  bookId: string;
  buildReviewParams: (nextPage?: number, includePaging?: boolean) => URLSearchParams;
  refreshAfterReviewMutation: () => Promise<void>;
  refreshSloOnly: () => Promise<void>;
}

const resolveActionLabel = (action: ManualReviewResolveAction): string => {
  if (action === "approve") {
    return "通过";
  }
  if (action === "reject") {
    return "驳回";
  }
  return "重生";
};

export function useReviewWorkbenchActions({
  bookId,
  buildReviewParams,
  refreshAfterReviewMutation,
  refreshSloOnly,
}: ReviewWorkbenchActionInput) {
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [dispatchEventActionId, setDispatchEventActionId] =
    useState<string | null>(null);
  const [scriptSaveLoadingItemId, setScriptSaveLoadingItemId] =
    useState<string | null>(null);

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
        await refreshAfterReviewMutation();
      } catch (resolveError) {
        console.error("Failed to resolve manual review item:", resolveError);
        toast.error(
          resolveError instanceof Error ? resolveError.message : `${actionLabel}失败`
        );
      } finally {
        setActionLoadingItemId(null);
      }
    },
    [bookId, refreshAfterReviewMutation]
  );

  const resolveItemsInBatch = useCallback(
    async (itemIds: string[], action: ManualReviewResolveAction) => {
      if (itemIds.length === 0) {
        toast.error("请先选择至少 1 条复核项");
        return false;
      }

      const actionLabel = resolveActionLabel(action);
      const confirmed = window.confirm(
        `确认要对 ${itemIds.length} 条复核项执行“${actionLabel}”吗？`
      );
      if (!confirmed) {
        return false;
      }

      setBatchActionLoading(true);
      try {
        const response = await fetch(`/api/books/${bookId}/review/items/batch-resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            itemIds,
            action,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as ReviewBatchResolveResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || `批量${actionLabel}失败`);
        }

        toast.success(`批量${actionLabel}完成，处理 ${payload.data.processedCount} 条`);
        await refreshAfterReviewMutation();
        return true;
      } catch (batchError) {
        console.error("Failed to resolve manual review items in batch:", batchError);
        toast.error(
          batchError instanceof Error ? batchError.message : `批量${actionLabel}失败`
        );
        return false;
      } finally {
        setBatchActionLoading(false);
      }
    },
    [bookId, refreshAfterReviewMutation]
  );

  const resolveDispatchEvent = useCallback(
    async (eventId: string, action: "ack" | "resolve") => {
      setDispatchEventActionId(eventId);
      try {
        const response = await fetch(
          `/api/books/${bookId}/qc/dispatch-events/${eventId}/resolve`,
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
          throw new Error(
            payload.error?.message ||
              (action === "ack" ? "告警事件 ack 失败" : "告警事件 resolve 失败")
          );
        }

        toast.success(action === "ack" ? "告警事件已 ack" : "告警事件已 resolve");
        await refreshSloOnly();
      } catch (eventError) {
        console.error("Failed to resolve dispatch event:", eventError);
        toast.error(eventError instanceof Error ? eventError.message : "告警事件处理失败");
      } finally {
        setDispatchEventActionId(null);
      }
    },
    [bookId, refreshSloOnly]
  );

  const exportReviewLogs = useCallback(async () => {
    try {
      const params = buildReviewParams(undefined, false);
      const response = await fetch(
        `/api/books/${bookId}/review/items/export?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("导出处置日志失败");
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${bookId}-manual-review-log.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (exportError) {
      console.error("Failed to export review logs:", exportError);
      toast.error(exportError instanceof Error ? exportError.message : "导出处置日志失败");
    }
  }, [bookId, buildReviewParams]);

  const saveScriptEdit = useCallback(
    async (
      item: ManualReviewItem,
      structuredResult: Record<string, unknown>
    ): Promise<boolean> => {
      setScriptSaveLoadingItemId(item.id);
      try {
        const response = await fetch(
          `/api/books/${bookId}/review/items/${item.id}/script-save`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              structuredResult,
            }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as ReviewScriptSaveResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "保存人工修订台本失败");
        }

        toast.success("人工修订台本已保存");
        await refreshAfterReviewMutation();
        return true;
      } catch (saveError) {
        console.error("Failed to save manual review script edit:", saveError);
        toast.error(
          saveError instanceof Error ? saveError.message : "保存人工修订台本失败"
        );
        return false;
      } finally {
        setScriptSaveLoadingItemId(null);
      }
    },
    [bookId, refreshAfterReviewMutation]
  );

  return {
    actionLoadingItemId,
    batchActionLoading,
    dispatchEventActionId,
    scriptSaveLoadingItemId,
    resolveItem,
    resolveItemsInBatch,
    resolveDispatchEvent,
    exportReviewLogs,
    saveScriptEdit,
  };
}
