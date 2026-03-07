// 一旦我被更新，请更新我的开头注释
// input: 核心 SLO 告警契约定义
// output: 服务与扫描共享类型
// pos: S32 告警模型
import type { BookSloMetricsQuery, BookSloMetricsResult } from "@/lib/slo-metrics/types";

export type SloAlertCode =
  | "slo_pipeline_success_rate_breach"
  | "slo_sentence_pass_rate_first_try_breach"
  | "slo_avg_retry_per_sentence_breach"
  | "slo_manual_review_ratio_breach"
  | "slo_chapter_consistency_fail_rate_breach";

export type SloAlertSeverity = "warning" | "critical";

export interface SloAlertQuery extends BookSloMetricsQuery {
  pipelineSuccessRateMin: number;
  sentencePassRateFirstTryMin: number | null;
  avgRetryPerSentenceMax: number | null;
  manualReviewRatioMax: number | null;
  chapterConsistencyFailRateMax: number;
}

export interface SloAlertScanQuery extends SloAlertQuery {
  autoResolveStale: boolean;
}

export interface SloAlertScheduleQuery extends SloAlertScanQuery {
  maxBooks: number;
}

export interface SloAlertItem {
  code: SloAlertCode;
  severity: SloAlertSeverity;
  metricKey: keyof BookSloMetricsResult["metrics"];
  message: string;
  recommendedAction: string;
  values: Record<string, number>;
}

export interface SloAlertResult {
  window: BookSloMetricsResult["window"];
  filter: BookSloMetricsResult["filter"];
  thresholds: {
    pipelineSuccessRateMin: number;
    sentencePassRateFirstTryMin: number | null;
    avgRetryPerSentenceMax: number | null;
    manualReviewRatioMax: number | null;
    chapterConsistencyFailRateMax: number;
  };
  snapshot: {
    metrics: BookSloMetricsResult["metrics"];
    workflowSummary: BookSloMetricsResult["workflowSummary"];
    qualitySummary: BookSloMetricsResult["qualitySummary"];
    manualReviewSummary: BookSloMetricsResult["manualReviewSummary"];
    chapterAuditSummary: BookSloMetricsResult["chapterAuditSummary"];
    latestQualityTask: BookSloMetricsResult["latestQualityTask"];
  };
  alerts: SloAlertItem[];
}

export interface SloAlertNotificationEvent {
  id: string;
  code: string;
  severity: string;
  status: string;
  triggerCount: number;
}

export interface SloAlertNotificationResult {
  enabled: boolean;
  delivered: boolean;
  channel: "webhook" | "none";
  reason: string;
}

export interface SloAlertScanResult {
  bookId: string;
  scanAt: string;
  window: SloAlertResult["window"];
  filter: SloAlertResult["filter"];
  thresholds: SloAlertResult["thresholds"];
  snapshot: SloAlertResult["snapshot"];
  alerts: SloAlertResult["alerts"];
  mutation: {
    created: number;
    reopened: number;
    updated: number;
    autoResolved: number;
    activeCount: number;
  };
  notification: SloAlertNotificationResult;
}
