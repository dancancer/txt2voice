// 一旦我被更新，请更新我的开头注释
// input: 核心 SLO 指标契约定义
// output: 服务与路由共享类型
// pos: S32 指标模型
export type SloMetricStatus = "healthy" | "breached" | "unknown";
export type SloMetricDirection = "higher_is_better" | "lower_is_better";
import type { ScriptGenerationRuntimeEvent } from "@/lib/script-generation/runner/runtime-events";

export interface BookSloMetricsQuery {
  windowDays: number;
  source?: string;
}

interface BaseSloMetric {
  key: string;
  label: string;
  status: SloMetricStatus;
  direction: SloMetricDirection;
  target: number | null;
}

export interface RatioSloMetric extends BaseSloMetric {
  kind: "ratio";
  value: number | null;
  percentage: number | null;
  numerator: number;
  denominator: number;
}

export interface AverageSloMetric extends BaseSloMetric {
  kind: "average";
  value: number | null;
  total: number;
  denominator: number;
}

export interface TaskTypeSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface BookSloMetricsResult {
  window: {
    days: number;
    since: string;
    until: string;
  };
  filter: {
    source: string | null;
  };
  metrics: {
    pipelineSuccessRate: RatioSloMetric;
    sentencePassRateFirstTry: RatioSloMetric;
    avgRetryPerSentence: AverageSloMetric;
    manualReviewRatio: RatioSloMetric;
    chapterConsistencyFailRate: RatioSloMetric;
  };
  workflowSummary: {
    autoPipeline: TaskTypeSummary & {
      pendingReviewHandOffCount: number;
      directDeliveryCount: number;
    };
    finalAssembly: TaskTypeSummary;
    manualReviewSync: TaskTypeSummary;
    deliveryTerminalCount: number;
    deliverySuccessCount: number;
    deliveryFailureCount: number;
  };
  qualitySummary: {
    sentenceCount: number;
    firstPassCount: number;
    manualReviewSentenceCount: number;
    totalRetryCount: number;
  };
  manualReviewSummary: {
    createdCount: number;
    uniqueSentenceCount: number;
    pendingCount: number;
    reprocessingCount: number;
    resolvedCount: number;
    rejectedCount: number;
  };
  chapterAuditSummary: {
    total: number;
    failedCount: number;
    repairCount: number;
    manualReviewCount: number;
  };
  latestQualityTask: {
    taskId: string;
    source: string | null;
    completedAt: string | null;
    checked: number;
    passCount: number;
    repairCount: number;
    manualReviewCount: number;
    hardFailCount: number;
    recentRuntimeEvents: ScriptGenerationRuntimeEvent[];
  } | null;
}
