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
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, RefreshCcw } from "lucide-react";
import type { ManualReviewStatusFilter, ReviewPagination } from "../models/types";

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
  priority: string;
  issueTypeOptions: string[];
  scriptSubtypeOptions: Array<{ value: string; label: string }>;
  showScriptSubtypeFilter: boolean;
  onStatusChange: (value: ManualReviewStatusFilter) => void;
  onIssueTypeChange: (value: string) => void;
  onScriptSubtypeChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  refreshing: boolean;
}

export function ReviewFilterBar({
  status,
  issueType,
  scriptSubtype,
  priority,
  issueTypeOptions,
  scriptSubtypeOptions,
  showScriptSubtypeFilter,
  onStatusChange,
  onIssueTypeChange,
  onScriptSubtypeChange,
  onPriorityChange,
  onRefresh,
  onExport,
  refreshing,
}: ReviewFilterBarProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 !pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
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

          {showScriptSubtypeFilter ? (
            <Select value={scriptSubtype} onValueChange={onScriptSubtypeChange}>
              <SelectTrigger className="min-h-11 bg-white">
                <SelectValue placeholder="脚本问题子类型" />
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

export { ReviewQueueList } from "./ReviewQueueList";
