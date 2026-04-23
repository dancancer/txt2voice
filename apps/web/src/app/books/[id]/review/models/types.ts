// 一旦我被更新，请更新我的开头注释
// input: 复核工作台 API 返回值
// output: 页面展示类型与常量
// pos: 质检复核页面共享类型
import type { ScriptValidationRecommendedAction } from "@/lib/script-validation-detail";
import type { BookSloMetricsResult } from "@/lib/slo-metrics/types";
import type { ProcessingTaskStatus } from "@/lib/view-models/tasks";

export type ManualReviewStatus = "pending" | "reprocessing" | "resolved" | "rejected";
export type ManualReviewStatusFilter = ManualReviewStatus | "all";
export type ManualReviewResolveAction = "approve" | "reject" | "regenerate";
export type ReviewRecommendedActionFilter =
  | ScriptValidationRecommendedAction
  | "all";

export interface ManualReviewSentenceSummary {
  id: string;
  text: string;
  roleType: string | null;
  emotionLabel: string | null;
  priority: string | null;
}

export interface ManualReviewAudioSummary {
  id: string;
  fileName: string | null;
  duration: number | null;
  status: string;
  qualityScore: number | null;
  qualityVerdict: string | null;
  qualityStatus: string | null;
}

export interface ManualReviewLatestQualityCheck {
  id: string;
  verdict: string;
  score: number | null;
  hardFail: boolean;
  reasons: unknown;
  detail: unknown;
  createdAt: string;
}

export interface ManualReviewItem {
  id: string;
  bookId: string;
  chapterId: string | null;
  segmentId: string | null;
  sentenceId: string | null;
  audioFileId: string | null;
  issueType: string;
  issueSubtype: string | null;
  recommendedAction: ScriptValidationRecommendedAction | null;
  recommendedActionLabel: string;
  priority: string;
  status: ManualReviewStatus;
  issueDetail: unknown;
  assignedTo: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sentence: ManualReviewSentenceSummary | null;
  audio: ManualReviewAudioSummary | null;
  latestQualityCheck: ManualReviewLatestQualityCheck | null;
}

export interface ReviewPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ReviewSummary {
  pendingCount: number;
  reprocessingCount: number;
  resolvedCount: number;
  rejectedCount: number;
  total: number;
}

export interface ReviewListResult {
  data: ManualReviewItem[];
  pagination: ReviewPagination;
  summary: ReviewSummary;
}

export interface ReviewListResponse {
  success: boolean;
  data: ReviewListResult;
  error?: {
    message?: string;
  };
}

export interface ReviewBatchResolveResult {
  action: ManualReviewResolveAction;
  processedCount: number;
  retryTask: {
    taskId: string;
    taskType: "AUDIO_GENERATION" | "SCRIPT_GENERATION";
    status: string;
  } | null;
}

export interface ReviewBatchResolveResponse {
  success: boolean;
  data: ReviewBatchResolveResult;
  error?: {
    message?: string;
  };
}

export interface ReviewRegenerateAllPendingResult {
  reviewItemCount: number;
  processedCount: number;
  scriptTask: {
    taskId: string;
    taskType: "SCRIPT_GENERATION";
    status: string;
  } | null;
  audioTask: {
    taskId: string;
    taskType: "AUDIO_GENERATION";
    status: string;
  } | null;
  warnings?: string[];
}

export interface ReviewRegenerateAllPendingResponse {
  success: boolean;
  data: ReviewRegenerateAllPendingResult;
  error?: {
    message?: string;
  };
}

export interface ReviewScriptSaveResponse {
  success: boolean;
  data: {
    item: ManualReviewItem;
    retryTask: null;
  };
  error?: {
    message?: string;
  };
}

export type ReviewRegenerateTaskSource =
  | "manual_review"
  | "manual_review_batch"
  | "manual_review_bulk_pending";

export type ReviewRegenerateTaskCategory =
  | "manual_review_regenerate"
  | "script_failure";

export interface ReviewRegenerateTaskFailureSummary {
  segmentId: string | null;
  orderIndex: number | null;
  stage: string | null;
  errorCode: string | null;
  message: string | null;
}

export interface ReviewRegenerateTask {
  id: string;
  taskType: string;
  status: ProcessingTaskStatus;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  source: ReviewRegenerateTaskSource | null;
  category: ReviewRegenerateTaskCategory;
  targetCount: number;
  segmentIds: string[];
  failureSummary: ReviewRegenerateTaskFailureSummary | null;
}

export interface ReviewTaskListResponse {
  success: boolean;
  data: Array<{
    id: string;
    bookId: string;
    bookTitle?: string | null;
    taskType: string;
    status: ProcessingTaskStatus;
    progress: number;
    message?: string | null;
    metadata?: Record<string, unknown> | null;
    errorMessage?: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
  }>;
  pagination?: ReviewPagination;
  error?: {
    message?: string;
  };
}

export interface DispatchMetricBase {
  autoRejectedEventCount: number;
  autoRejectedAccumulatedCount: number;
  thresholdBlockedCount: number;
  secondaryPendingCount: number;
}

export interface DispatchMetricByIssueType extends DispatchMetricBase {
  issueType: string;
}

export interface DispatchMetricBySource extends DispatchMetricBase {
  source: string;
}

export interface DispatchMetricsResult {
  window: {
    days: number;
    since: string;
    until: string;
  };
  filter: {
    source: string | null;
    issueType: string | null;
  };
  totals: DispatchMetricBase;
  byIssueType: DispatchMetricByIssueType[];
  bySource: DispatchMetricBySource[];
  qualityTaskSummary: {
    taskCount: number;
    secondaryDispatchCount: number;
    secondaryDispatchSkippedByThresholdCount: number;
    bySource: Array<{
      source: string;
      taskCount: number;
      secondaryDispatchCount: number;
      secondaryDispatchSkippedByThresholdCount: number;
    }>;
  };
  signalBreakdown: {
    cer: DispatchMetricBase;
    speaker: DispatchMetricBase;
  };
}

export interface DispatchMetricsResponse {
  success: boolean;
  data: DispatchMetricsResult;
  error?: {
    message?: string;
  };
}

export interface DispatchAlertItem {
  code: string;
  severity: "warning" | "critical";
  message: string;
  recommendedAction: string;
  values: Record<string, number>;
}

export interface DispatchAlertResult {
  window: {
    days: number;
    since: string;
    until: string;
  };
  thresholds: {
    thresholdBlockedSpikeDelta: number;
    thresholdBlockedGrowthRate: number;
    thresholdBlockedCurrentFloor: number;
    secondaryPendingLimit: number;
    autoRejectedAccumulatedLimit: number;
  };
  snapshot: {
    windowTotals: DispatchMetricBase;
    thresholdBlockedCurrent24h: number;
    thresholdBlockedPrevious24h: number;
  };
  alerts: DispatchAlertItem[];
}

export interface DispatchAlertResponse {
  success: boolean;
  data: DispatchAlertResult;
  error?: {
    message?: string;
  };
}

export type DispatchEventStatus = "open" | "acked" | "resolved";

export interface DispatchAlertEvent {
  id: string;
  source: string | null;
  issueType: string | null;
  alertCode: string;
  severity: "warning" | "critical";
  status: DispatchEventStatus;
  message: string;
  recommendedAction: string | null;
  triggerCount: number;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  ackedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface DispatchAlertEventListResponse {
  success: boolean;
  data: DispatchAlertEvent[];
  pagination: ReviewPagination;
  summary: {
    openCount: number;
    ackedCount: number;
    resolvedCount: number;
    totalCount: number;
  };
  error?: {
    message?: string;
  };
}

export interface BookSloMetricsResponse {
  success: boolean;
  data: BookSloMetricsResult;
  error?: {
    message?: string;
  };
}

export interface PipelineStatusResponse {
  success: boolean;
  data: {
    pendingReviewCount: number;
    qualitySummary: unknown;
  };
  error?: {
    message?: string;
  };
}

export interface QualitySummary {
  checked: number;
  passCount: number;
  repairCount: number;
  manualReviewCount: number;
  deepGateOverrideCount: number;
  falsePositiveCandidateCount: number;
}

export interface ReviewWorkbenchFilters {
  status: ManualReviewStatusFilter;
  issueType: string;
  scriptSubtype: string;
  recommendedAction: ReviewRecommendedActionFilter;
  priority: string;
}

export const REVIEW_PAGE_LIMIT = 20;

export const REVIEW_STATUS_OPTIONS: Array<{
  value: ManualReviewStatusFilter;
  label: string;
}> = [
  { value: "pending", label: "待复核" },
  { value: "reprocessing", label: "重生中" },
  { value: "resolved", label: "已通过" },
  { value: "rejected", label: "已驳回" },
  { value: "all", label: "全部状态" },
];

export const SLO_WINDOW_OPTIONS = [
  { value: 1, label: "近 24 小时" },
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" },
] as const;

export const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "全部来源" },
  { value: "auto_pipeline", label: "auto_pipeline" },
  { value: "final_assembly", label: "final_assembly" },
  { value: "manual_review_sync", label: "manual_review_sync" },
  { value: "qc_retry", label: "qc_retry" },
  { value: "manual_review", label: "manual_review" },
  { value: "manual_review_batch", label: "manual_review_batch" },
  { value: "manual_review_bulk_pending", label: "manual_review_bulk_pending" },
  { value: "unknown", label: "unknown" },
] as const;
