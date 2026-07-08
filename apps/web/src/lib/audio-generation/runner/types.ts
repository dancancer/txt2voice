import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { Prisma } from "@/lib/prisma";

export type AudioGenerationTaskType = "single" | "batch" | "book" | "chapter";

export interface AudioGenerationRunParams {
  bookId: string;
  taskId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

export interface ManualReviewTaskContext {
  manualReviewItemId: string;
}

export interface ManualReviewBatchTaskContext {
  selectedReviewItemIds: string[];
}

export interface QcRetryIssueTypePolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
}

export interface QcRetryDispatchPolicy {
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number;
  issueTypePolicies: Record<string, QcRetryIssueTypePolicy>;
}

export interface QcRetryTaskContext {
  selectedReviewItemIds: string[];
  dispatchPolicy: QcRetryDispatchPolicy;
}

export interface RouterDecisionSummary {
  totalResults: number;
  decisionCount: number;
  fallbackCount: number;
  byEngine: Array<{
    engine: string;
    total: number;
    success: number;
    failed: number;
    fallbackCount: number;
  }>;
  bySource: Array<{
    source: string;
    total: number;
    success: number;
    failed: number;
  }>;
  byPolicyVersion: Array<{
    policyVersion: string;
    total: number;
  }>;
}

export interface AudioChildJobProviderMetrics {
  provider: string;
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageWaitMs: number;
  averageLatencyMs: number;
}

export interface AudioChildJobMetrics {
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageWaitMs: number;
  averageLatencyMs: number;
  providers: AudioChildJobProviderMetrics[];
}

export interface GeneratedAudioSummary {
  results: any[];
  totalSentences: number;
  audioReliability: Record<string, unknown> | null;
}

export interface FollowupQcResult {
  taskId: string;
  status: "processing" | "failed";
  error?: string;
}

export type JsonValue = Prisma.JsonValue | null | undefined;
