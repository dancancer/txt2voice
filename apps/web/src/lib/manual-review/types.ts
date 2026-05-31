import type { Prisma } from "@/lib/prisma";
import type { ScriptValidationRecommendedAction } from "@/lib/script-validation-detail";

export type ManualReviewStatus = "pending" | "reprocessing" | "resolved" | "rejected";
export type ManualReviewResolveAction = "approve" | "reject" | "regenerate";

export interface ManualReviewListQuery {
  page: number;
  limit: number;
  offset: number;
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
  chapterId?: string;
  sentenceId?: string;
}

export interface ManualReviewResolvePayload {
  action: ManualReviewResolveAction;
  note?: string;
  assignedTo?: string;
  voiceProfileId?: string;
  preferredProvider?: "voxcpm" | "qwen3voice";
  autoMerge: boolean;
}

export interface ManualReviewBatchResolvePayload extends ManualReviewResolvePayload {
  itemIds: string[];
}

export interface ManualReviewExportQuery {
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
  chapterId?: string;
  sentenceId?: string;
}

export interface ManualReviewFilterOptions {
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
  chapterId?: string;
  sentenceId?: string;
}

export interface FormattedManualReviewItem {
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
  status: string;
  issueDetail: Prisma.JsonValue;
  assignedTo: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sentence: {
    id: string;
    text: string;
    roleType: string | null;
    emotionLabel: string | null;
    priority: string | null;
  } | null;
  audio: {
    id: string;
    fileName: string | null;
    duration: number | null;
    status: string;
    qualityScore: number | null;
    qualityVerdict: string | null;
    qualityStatus: string | null;
  } | null;
  latestQualityCheck: {
    id: string;
    verdict: string;
    score: number | null;
    hardFail: boolean;
    reasons: Prisma.JsonValue;
    detail: Prisma.JsonValue;
    createdAt: Date;
  } | null;
}

export interface ManualReviewRetryTask {
  taskId: string;
  taskType: "AUDIO_GENERATION" | "SCRIPT_GENERATION";
  status: string;
}

export interface ManualReviewResolveResult {
  item: FormattedManualReviewItem;
  retryTask: ManualReviewRetryTask | null;
}

export interface ManualReviewBatchResolveResult {
  action: ManualReviewResolveAction;
  processedCount: number;
  items: FormattedManualReviewItem[];
  retryTask: ManualReviewRetryTask | null;
}

export interface RegenerateAllPendingManualReviewResult {
  reviewItemCount: number;
  processedCount: number;
  scriptTask: ManualReviewRetryTask | null;
  audioTask: ManualReviewRetryTask | null;
  warnings?: string[];
}

export interface ResolveManualReviewInput {
  bookId: string;
  itemId: string;
  payload: ManualReviewResolvePayload;
}

export interface ResolveManualReviewBatchInput {
  bookId: string;
  payload: ManualReviewBatchResolvePayload;
}

export interface RegenerateAllPendingManualReviewInput {
  bookId: string;
}

export interface SaveManualReviewScriptEditInput {
  bookId: string;
  itemId: string;
  payload: {
    structuredResult: Record<string, unknown>;
  };
}
