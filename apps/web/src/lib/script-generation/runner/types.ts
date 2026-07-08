import type {
  ScriptGenerationOptions,
  SegmentFailureDetail,
} from "@/lib/agent-runtime/runtime/script-production/types";

export interface ScriptGenerationExtraParams {
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  regenerateSegments?: boolean;
  segmentIds?: string[];
  limitToSegments?: number;
}

export interface ScriptGenerationRunParams {
  bookId: string;
  taskId: string;
  options: Partial<ScriptGenerationOptions>;
  extraParams?: ScriptGenerationExtraParams;
}

export interface ScriptGenerationLLMProviderMetrics {
  provider: string;
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageLatencyMs: number;
  averageWaitMs: number;
}

export interface ScriptGenerationLLMMetrics {
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageLatencyMs: number;
  averageWaitMs: number;
  providers: ScriptGenerationLLMProviderMetrics[];
}

export interface ScriptGenerationRuntimeEvent {
  seq: number;
  kind: string;
  title: string;
  detail?: string;
  status: "info" | "success" | "warning" | "error";
  progress: number;
  createdAt: string;
  stage?: string;
  stageLabel?: string;
  source?: string;
  provider?: string;
  model?: string;
  segmentId?: string;
  attempt?: number;
  retriesUsed?: number;
  retryable?: boolean;
  latencyMs?: number;
  waitMs?: number;
}

export interface AgentRuntimeMetadata {
  workflowRunId: string;
  workflowId?: string;
  status: string;
  mode?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  traceEventCount?: number;
  stageRunCount?: number;
  summary?: Record<string, unknown>;
}

export interface RuntimeManualReviewSync {
  issueType: string;
  created: number;
  updated: number;
  pending: number;
  resolved: number;
}

export type { SegmentFailureDetail };
