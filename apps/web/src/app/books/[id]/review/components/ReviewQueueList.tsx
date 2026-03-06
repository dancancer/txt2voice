// 一旦我被更新，请更新我的开头注释
// input: 复核项列表/处置回调
// output: 人工复核队列卡片与批量操作
// pos: 质检复核页面子组件

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import type { ManualReviewItem, ManualReviewResolveAction, ManualReviewStatus } from "../models/types";

const REVIEW_STATUS_META: Record<
  ManualReviewStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "待复核",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  reprocessing: {
    label: "重生中",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  resolved: {
    label: "已通过",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "已驳回",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toIssueLabel = (issueType: string): string => {
  const normalized = issueType.trim().toUpperCase();
  if (normalized === "CER") {
    return "文本准确率";
  }
  if (normalized === "SPEAKER") {
    return "说话人一致性";
  }
  if (normalized === "EMOTION") {
    return "情绪匹配";
  }
  if (normalized === "CONTINUITY") {
    return "章节一致性";
  }
  if (normalized === "AUDIO") {
    return "音频质量";
  }
  return normalized;
};

interface ReviewQueueListProps {
  items: ManualReviewItem[];
  loading: boolean;
  actionLoadingItemId: string | null;
  batchActionLoading: boolean;
  onResolve: (item: ManualReviewItem, action: ManualReviewResolveAction) => void;
  onBatchResolve: (
    itemIds: string[],
    action: ManualReviewResolveAction
  ) => Promise<boolean>;
}

export function ReviewQueueList({
  items,
  loading,
  actionLoadingItemId,
  batchActionLoading,
  onResolve,
  onBatchResolve,
}: ReviewQueueListProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const pendingItemIds = useMemo(
    () => items.filter((item) => item.status === "pending").map((item) => item.id),
    [items]
  );
  const pendingItemIdSet = useMemo(
    () => new Set(pendingItemIds),
    [pendingItemIds]
  );
  const effectiveSelectedItemIds = useMemo(
    () => selectedItemIds.filter((itemId) => pendingItemIdSet.has(itemId)),
    [pendingItemIdSet, selectedItemIds]
  );
  const selectedCount = effectiveSelectedItemIds.length;
  const allPendingSelected =
    pendingItemIds.length > 0 &&
    pendingItemIds.every((itemId) => effectiveSelectedItemIds.includes(itemId));

  const toggleItemSelection = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      if (checked) {
        if (prev.includes(itemId)) {
          return prev;
        }
        return [...prev, itemId];
      }
      return prev.filter((currentId) => currentId !== itemId);
    });
  };

  const toggleSelectAllPending = (checked: boolean) => {
    setSelectedItemIds(checked ? pendingItemIds : []);
  };

  const handleBatchResolve = async (action: ManualReviewResolveAction) => {
    const success = await onBatchResolve(effectiveSelectedItemIds, action);
    if (success) {
      setSelectedItemIds([]);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-12 !pt-12 text-center text-slate-600">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
          正在加载复核队列...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-12 !pt-12 text-center text-slate-600">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
          当前筛选条件下没有待处理复核项。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4 !pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allPendingSelected}
                disabled={pendingItemIds.length === 0 || batchActionLoading}
                onChange={(event) => toggleSelectAllPending(event.target.checked)}
              />
              全选当前页待复核（{pendingItemIds.length}）
            </label>
            <span className="text-xs text-slate-500">已选择 {selectedCount} 条</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={selectedCount === 0 || batchActionLoading}
              onClick={() => handleBatchResolve("approve")}
            >
              {batchActionLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              批量通过
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10"
              disabled={selectedCount === 0 || batchActionLoading}
              onClick={() => handleBatchResolve("regenerate")}
            >
              {batchActionLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-4 w-4" />
              )}
              批量重生
            </Button>
          </div>
        </CardContent>
      </Card>
      {items.map((item) => {
        const statusMeta = REVIEW_STATUS_META[item.status];
        const score = item.latestQualityCheck?.score ?? item.audio?.qualityScore;
        const actionPending = actionLoadingItemId === item.id;
        const canResolve = item.status === "pending";
        const checked = effectiveSelectedItemIds.includes(item.id);

        return (
          <Card key={item.id} className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 p-4 !pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {canResolve ? (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={batchActionLoading || actionPending}
                      onChange={(event) => toggleItemSelection(item.id, event.target.checked)}
                    />
                    选中
                  </label>
                ) : null}
                <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                <Badge variant="outline">{toIssueLabel(item.issueType)}</Badge>
                <Badge variant="outline">priority: {item.priority}</Badge>
                {score !== null && score !== undefined ? (
                  <Badge variant="outline">score: {score.toFixed(2)}</Badge>
                ) : null}
                <span className="text-xs text-slate-500">创建于 {formatDateTime(item.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {item.sentence?.text || "当前条目缺少句子文本"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>chapter: {item.chapterId || "-"}</span>
                <span>sentence: {item.sentenceId || "-"}</span>
                <span>emotion: {item.sentence?.emotionLabel || "-"}</span>
                <span>更新时间: {formatDateTime(item.updatedAt)}</span>
              </div>
              {item.audio?.id ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-500">试听最近音频（audioId: {item.audio.id}）</p>
                  <audio controls preload="none" className="w-full">
                    <source src={`/api/audio/${item.audio.id}`} type="audio/mpeg" />
                    当前浏览器不支持音频播放。
                  </audio>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "approve")}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  通过
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "reject")}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  驳回
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "regenerate")}
                >
                  {actionPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-4 w-4" />
                  )}
                  重生
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
