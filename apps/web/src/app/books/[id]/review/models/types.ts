// 一旦我被更新，请更新我的开头注释
// input: 复核工作台 API 返回值
// output: 页面展示类型与常量
// pos: 质检复核页面共享类型

export type ManualReviewStatus = "pending" | "reprocessing" | "resolved" | "rejected";
export type ManualReviewStatusFilter = ManualReviewStatus | "all";
export type ManualReviewResolveAction = "approve" | "reject" | "regenerate";

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
  { value: "qc_retry", label: "qc_retry" },
  { value: "manual_review", label: "manual_review" },
  { value: "unknown", label: "unknown" },
] as const;
