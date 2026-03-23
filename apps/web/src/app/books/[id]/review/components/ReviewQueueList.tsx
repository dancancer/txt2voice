// 一旦我被更新，请更新我的开头注释
// input: 复核项列表/处置回调
// output: 人工复核队列卡片、脚本失败详情与批量操作
// pos: 质检复核页面子组件

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getScriptValidationSubtypeLabel,
  SCRIPT_VALIDATION_ISSUE_TYPE,
} from "@/lib/script-validation-review";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import type { ManualReviewItem, ManualReviewResolveAction, ManualReviewStatus } from "../models/types";
import { buildScriptValidationDetailView } from "../models/script-validation-detail";
import { ReviewScriptEditWorkspace } from "./ReviewScriptEditWorkspace";

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
  if (normalized === SCRIPT_VALIDATION_ISSUE_TYPE) {
    return "台本校验";
  }
  return normalized;
};

const toActionLabel = (action: ManualReviewResolveAction, recommendedAction: string | null) => {
  if (action !== recommendedAction) {
    if (action === "approve") {
      return "通过";
    }
    if (action === "reject") {
      return "驳回";
    }
    return "重生";
  }

  if (action === "approve") {
    return "通过（推荐）";
  }
  if (action === "reject") {
    return "驳回（推荐）";
  }
  return "重生（推荐）";
};

const toRecommendedActionClassName = (
  action: ManualReviewResolveAction,
  recommendedAction: string | null
) => {
  if (action !== recommendedAction) {
    return "";
  }

  return "ring-2 ring-amber-300 ring-offset-2";
};

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
        const scriptDetail =
          item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
            ? buildScriptValidationDetailView({
                issueSubtype: item.issueSubtype,
                issueDetail: item.issueDetail,
              })
            : null;
        const primaryText =
          item.sentence?.text || scriptDetail?.segmentPreview || "当前条目缺少句子文本";
        const rawStructuredDialogues =
          scriptDetail?.structuredResult &&
          Array.isArray(scriptDetail.structuredResult.dialogues)
            ? scriptDetail.structuredResult.dialogues
            : [];
        const generatedPreview =
          rawStructuredDialogues.length > 0 &&
          rawStructuredDialogues[0] &&
          typeof rawStructuredDialogues[0] === "object" &&
          !Array.isArray(rawStructuredDialogues[0]) &&
          typeof (rawStructuredDialogues[0] as Record<string, unknown>).text === "string"
            ? ((rawStructuredDialogues[0] as Record<string, unknown>).text as string)
            : null;

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
                {item.issueSubtype ? (
                  <Badge variant="outline">
                    {getScriptValidationSubtypeLabel(item.issueSubtype)}
                  </Badge>
                ) : null}
                <Badge variant="outline">priority: {item.priority}</Badge>
                {score !== null && score !== undefined ? (
                  <Badge variant="outline">score: {score.toFixed(2)}</Badge>
                ) : null}
                <span className="text-xs text-slate-500">创建于 {formatDateTime(item.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {primaryText}
              </p>
              {item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-medium tracking-wide text-slate-500">
                      段落原文
                    </p>
                    <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {scriptDetail?.segmentContent || scriptDetail?.segmentPreview || "暂无完整原文"}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-medium tracking-wide text-slate-500">
                      当前生成结果预览
                    </p>
                    <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {generatedPreview || rawResponseFallback(scriptDetail?.rawResponse)}
                    </p>
                  </div>
                </div>
              ) : null}
              {scriptDetail?.summary ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {scriptDetail.summary}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>chapter: {item.chapterId || "-"}</span>
                <span>segment: {item.segmentId || "-"}</span>
                <span>sentence: {item.sentenceId || "-"}</span>
                <span>emotion: {item.sentence?.emotionLabel || "-"}</span>
                <span>更新时间: {formatDateTime(item.updatedAt)}</span>
              </div>
              {scriptDetail?.hasDetails ? (
                <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    查看脚本失败详情
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      {scriptDetail.stage ? <span>stage: {scriptDetail.stage}</span> : null}
                      {scriptDetail.errorCode ? <span>errorCode: {scriptDetail.errorCode}</span> : null}
                      {scriptDetail.coverageLabel ? <span>coverage: {scriptDetail.coverageLabel}</span> : null}
                    </div>
                    {scriptDetail.issueMessages.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium tracking-wide text-slate-500">
                          完整问题列表
                        </p>
                        <div className="space-y-2">
                          {scriptDetail.issueMessages.map((message) => (
                            <p
                              key={message}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                            >
                              {message}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {scriptDetail.issueCodes.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          问题代码
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {scriptDetail.issueCodes.map((code) => (
                            <Badge key={code} variant="outline">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {scriptDetail.issuePreviews.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          问题原文预览
                        </p>
                        <div className="space-y-2">
                          {scriptDetail.issuePreviews.map((preview) => (
                            <p
                              key={preview}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                            >
                              {preview}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {scriptDetail.actionHints.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium tracking-wide text-slate-500">
                          建议动作
                        </p>
                        <ol className="space-y-2">
                          {scriptDetail.actionHints.map((hint) => (
                            <li
                              key={hint}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                            >
                              {hint}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {scriptDetail.segmentPreview ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          段落原文预览
                        </p>
                        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                          {scriptDetail.segmentPreview}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
              {item.audio?.id ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-500">试听最近音频（audioId: {item.audio.id}）</p>
                  <audio controls preload="none" className="w-full">
                    <source src={`/api/audio/${item.audio.id}`} type="audio/mpeg" />
                    当前浏览器不支持音频播放。
                  </audio>
                </div>
              ) : null}
              {scriptDetail?.recommendedActionLabel ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  推荐动作：{scriptDetail.recommendedActionLabel}
                </div>
              ) : null}
              {item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE &&
              (scriptDetail?.segmentContent || scriptDetail?.rawResponse || scriptDetail?.structuredResult) ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    disabled={actionPending || batchActionLoading}
                    onClick={() => setEditingItem(item)}
                  >
                    打开修订工作台
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`min-h-10 ${toRecommendedActionClassName(
                    "approve",
                    scriptDetail?.recommendedAction || null
                  )}`}
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "approve")}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  {toActionLabel("approve", scriptDetail?.recommendedAction || null)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`min-h-10 ${toRecommendedActionClassName(
                    "reject",
                    scriptDetail?.recommendedAction || null
                  )}`}
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "reject")}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  {toActionLabel("reject", scriptDetail?.recommendedAction || null)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={`min-h-10 ${toRecommendedActionClassName(
                    "regenerate",
                    scriptDetail?.recommendedAction || null
                  )}`}
                  disabled={!canResolve || actionPending || batchActionLoading}
                  onClick={() => onResolve(item, "regenerate")}
                >
                  {actionPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-4 w-4" />
                  )}
                  {toActionLabel("regenerate", scriptDetail?.recommendedAction || null)}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <ReviewScriptEditWorkspace
        key={editingItem?.id || "review-script-workspace"}
        open={Boolean(editingItem)}
        item={editingItem}
        saving={scriptSaveLoadingItemId === editingItem?.id}
        onClose={() => setEditingItem(null)}
        onSave={async (structuredResult) => {
          if (!editingItem) {
            return false;
          }
          return onSaveScriptEdit(editingItem, structuredResult);
        }}
      />
    </div>
  );
}

function rawResponseFallback(rawResponse: string | undefined): string {
  if (!rawResponse) {
    return "暂无原始生成结果";
  }
  return rawResponse.slice(0, 160);
}
