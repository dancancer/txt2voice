// 一旦我被更新，请更新我的开头注释
// input: 复核筛选器/分页回调
// output: 人工复核过滤条与分页条
// pos: 质检复核页面子组件

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getScriptValidationSubtypeLabel,
  SCRIPT_VALIDATION_ISSUE_TYPE,
} from "@/lib/script-validation-review";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Download, Loader2, RefreshCcw, RotateCcw } from "lucide-react";
import type {
  ManualReviewStatusFilter,
  ReviewPagination,
  ReviewRecommendedActionFilter,
} from "../models/types";

const REVIEW_STATUS_LABELS: Record<ManualReviewStatusFilter, string> = {
  pending: "待复核",
  reprocessing: "重生中",
  resolved: "已通过",
  rejected: "已驳回",
  all: "全部状态",
};

const PRIORITY_LABELS: Record<string, string> = {
  all: "全部优先级",
  high: "高优先级",
  normal: "普通优先级",
  low: "低优先级",
};

const findOptionLabel = (
  options: Array<{ value: string; label: string }>,
  value: string,
  fallback: string
) => {
  return options.find((option) => option.value === value)?.label || fallback;
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

interface ReviewFilterBarProps {
  status: ManualReviewStatusFilter;
  issueType: string;
  scriptSubtype: string;
  recommendedAction: ReviewRecommendedActionFilter;
  priority: string;
  pendingCount: number;
  allPendingRegenerateLoading: boolean;
  issueTypeOptions: string[];
  scriptSubtypeOptions: Array<{ value: string; label: string }>;
  recommendedActionOptions: Array<{ value: string; label: string }>;
  showScriptSubtypeFilter: boolean;
  showRecommendedActionFilter: boolean;
  onStatusChange: (value: ManualReviewStatusFilter) => void;
  onIssueTypeChange: (value: string) => void;
  onScriptSubtypeChange: (value: string) => void;
  onRecommendedActionChange: (value: ReviewRecommendedActionFilter) => void;
  onPriorityChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onRegenerateAllPending: () => void;
  refreshing: boolean;
}

export function ReviewFilterBar({
  status,
  issueType,
  scriptSubtype,
  recommendedAction,
  priority,
  pendingCount,
  allPendingRegenerateLoading,
  issueTypeOptions,
  scriptSubtypeOptions,
  recommendedActionOptions,
  showScriptSubtypeFilter,
  showRecommendedActionFilter,
  onStatusChange,
  onIssueTypeChange,
  onScriptSubtypeChange,
  onRecommendedActionChange,
  onPriorityChange,
  onRefresh,
  onExport,
  onRegenerateAllPending,
  refreshing,
}: ReviewFilterBarProps) {
  const statusLabel = REVIEW_STATUS_LABELS[status] || "状态";
  const issueTypeLabel = issueType === "all" ? "全部问题类型" : toIssueLabel(issueType);
  const scriptSubtypeLabel =
    scriptSubtype === "all"
      ? "全部脚本问题"
      : findOptionLabel(scriptSubtypeOptions, scriptSubtype, scriptSubtype);
  const recommendedActionLabel =
    recommendedAction === "all"
      ? "全部推荐动作"
      : findOptionLabel(
          recommendedActionOptions,
          recommendedAction,
          recommendedAction
        );
  const priorityLabel = PRIORITY_LABELS[priority] || priority;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 !pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
          <Select value={status} onValueChange={(value) => onStatusChange(value as ManualReviewStatusFilter)}>
            <SelectTrigger className="min-h-11">
              <span className="block truncate">{statusLabel}</span>
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
            <SelectTrigger className="min-h-11">
              <span className="block truncate">{issueTypeLabel}</span>
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

          {showScriptSubtypeFilter ? (
            <Select value={scriptSubtype} onValueChange={onScriptSubtypeChange}>
              <SelectTrigger className="min-h-11">
                <span className="block truncate">{scriptSubtypeLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部脚本问题</SelectItem>
                {scriptSubtypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {getScriptValidationSubtypeLabel(option.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="hidden md:block" />
          )}

          {showRecommendedActionFilter ? (
            <Select
              value={recommendedAction}
              onValueChange={(value) =>
                onRecommendedActionChange(value as ReviewRecommendedActionFilter)
              }
            >
              <SelectTrigger className="min-h-11">
                <span className="block truncate">{recommendedActionLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部推荐动作</SelectItem>
                {recommendedActionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="hidden md:block" />
          )}

          <Select value={priority} onValueChange={onPriorityChange}>
            <SelectTrigger className="min-h-11">
              <span className="block truncate">{priorityLabel}</span>
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
            className="min-h-11"
            disabled={
              pendingCount === 0 || refreshing || allPendingRegenerateLoading
            }
            onClick={onRegenerateAllPending}
          >
            {allPendingRegenerateLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                全量重生中
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                {`重生全部待复核（${pendingCount}）`}
              </>
            )}
          </Button>
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
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onExport}
            disabled={refreshing}
          >
            <Download className="mr-2 h-4 w-4" />
            导出处置日志
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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

export { ReviewQueueList } from "./ReviewQueueList";
