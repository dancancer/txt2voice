// 一旦我被更新，请更新我的开头注释
// input: 复核列表/筛选器/动作回调
// output: 人工复核队列视图
// pos: 质检复核页面子组件

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type {
  ManualReviewItem,
  ManualReviewResolveAction,
  ManualReviewStatus,
  ManualReviewStatusFilter,
  ReviewPagination,
} from "../models/types";

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

interface ReviewFilterBarProps {
  status: ManualReviewStatusFilter;
  issueType: string;
  priority: string;
  issueTypeOptions: string[];
  onStatusChange: (value: ManualReviewStatusFilter) => void;
  onIssueTypeChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ReviewFilterBar({
  status,
  issueType,
  priority,
  issueTypeOptions,
  onStatusChange,
  onIssueTypeChange,
  onPriorityChange,
  onRefresh,
  refreshing,
}: ReviewFilterBarProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 !pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={status} onValueChange={(value) => onStatusChange(value as ManualReviewStatusFilter)}>
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">待复核</SelectItem>
              <SelectItem value="reprocessing">重生中</SelectItem>
              <SelectItem value="resolved">已通过</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
              <SelectItem value="all">全部状态</SelectItem>
            </SelectContent>
          </Select>

          <Select value={issueType} onValueChange={onIssueTypeChange}>
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="问题类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部问题类型</SelectItem>
              {issueTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {toIssueLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={onPriorityChange}>
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部优先级</SelectItem>
              <SelectItem value="high">high</SelectItem>
              <SelectItem value="normal">normal</SelectItem>
              <SelectItem value="low">low</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                刷新中
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                刷新数据
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ReviewQueueListProps {
  items: ManualReviewItem[];
  loading: boolean;
  actionLoadingItemId: string | null;
  onResolve: (item: ManualReviewItem, action: ManualReviewResolveAction) => void;
}

export function ReviewQueueList({
  items,
  loading,
  actionLoadingItemId,
  onResolve,
}: ReviewQueueListProps) {
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
      {items.map((item) => {
        const statusMeta = REVIEW_STATUS_META[item.status];
        const score = item.latestQualityCheck?.score ?? item.audio?.qualityScore;
        const actionPending = actionLoadingItemId === item.id;
        const canResolve = item.status === "pending";

        return (
          <Card key={item.id} className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 p-4 !pt-4">
              <div className="flex flex-wrap items-center gap-2">
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
                  disabled={!canResolve || actionPending}
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
                  disabled={!canResolve || actionPending}
                  onClick={() => onResolve(item, "reject")}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  驳回
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  disabled={!canResolve || actionPending}
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

interface ReviewPaginationBarProps {
  pagination: ReviewPagination;
  onPageChange: (page: number) => void;
}

export function ReviewPaginationBar({
  pagination,
  onPageChange,
}: ReviewPaginationBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        第 {pagination.page}/{Math.max(1, pagination.totalPages)} 页，共 {pagination.total} 条
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          disabled={!pagination.hasPrev}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          上一页
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
