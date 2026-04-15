// 一旦我被更新，请更新我的开头注释
// input: 复核项列表/处置回调
// output: 人工复核队列卡片、脚本失败详情与批量操作
// pos: 质检复核页面子组件

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { ManualReviewItem, ManualReviewResolveAction } from "../models/types";
import { ReviewScriptEditWorkspace } from "./ReviewScriptEditWorkspace";
import { ReviewQueueListItemCard } from "./ReviewQueueListItemCard";

interface ReviewQueueListProps {
  items: ManualReviewItem[];
  loading: boolean;
  actionLoadingItemId: string | null;
  batchActionLoading: boolean;
  scriptSaveLoadingItemId: string | null;
  onResolve: (item: ManualReviewItem, action: ManualReviewResolveAction) => void;
  onBatchResolve: (
    itemIds: string[],
    action: ManualReviewResolveAction
  ) => Promise<boolean>;
  onSaveScriptEdit: (
    item: ManualReviewItem,
    structuredResult: Record<string, unknown>
  ) => Promise<boolean>;
}

export function ReviewQueueList({
  items,
  loading,
  actionLoadingItemId,
  batchActionLoading,
  scriptSaveLoadingItemId,
  onResolve,
  onBatchResolve,
  onSaveScriptEdit,
}: ReviewQueueListProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<ManualReviewItem | null>(null);

  const pendingItemIds = useMemo(
    () => items.filter((item) => item.status === "pending").map((item) => item.id),
    [items]
  );
  const pendingItemIdSet = useMemo(() => new Set(pendingItemIds), [pendingItemIds]);
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
        return prev.includes(itemId) ? prev : [...prev, itemId];
      }
      return prev.filter((currentId) => currentId !== itemId);
    });
  };

  const handleBatchResolve = async (action: ManualReviewResolveAction) => {
    const success = await onBatchResolve(effectiveSelectedItemIds, action);
    if (success) {
      setSelectedItemIds([]);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 !pt-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          正在加载复核队列...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 !pt-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
          当前筛选条件下没有待处理复核项。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-4 !pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={allPendingSelected}
                disabled={pendingItemIds.length === 0 || batchActionLoading}
                onChange={(event) =>
                  setSelectedItemIds(event.target.checked ? pendingItemIds : [])
                }
              />
              全选当前页待复核（{pendingItemIds.length}）
            </label>
            <span className="text-xs text-muted-foreground">已选择 {selectedCount} 条</span>
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
      {items.map((item) => (
        <ReviewQueueListItemCard
          key={item.id}
          item={item}
          checked={effectiveSelectedItemIds.includes(item.id)}
          canResolve={item.status === "pending"}
          actionPending={actionLoadingItemId === item.id}
          batchActionLoading={batchActionLoading}
          onToggleSelection={(checked) => toggleItemSelection(item.id, checked)}
          onOpenEdit={() => setEditingItem(item)}
          onResolve={(action) => onResolve(item, action)}
        />
      ))}
      <ReviewScriptEditWorkspace
        key={editingItem?.id || "review-script-workspace"}
        open={Boolean(editingItem)}
        item={editingItem}
        saving={scriptSaveLoadingItemId === editingItem?.id}
        onClose={() => setEditingItem(null)}
        onSave={async (structuredResult) => {
          if (!editingItem) return false;
          return onSaveScriptEdit(editingItem, structuredResult);
        }}
      />
    </div>
  );
}
