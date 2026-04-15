import type {
  LLMExecutionJobResult,
} from "@/lib/task-queue";

export type LLMExecutionEvent =
  | {
      status: "submitted";
      provider: string;
      model: string;
      source?: string;
      stageId?: string;
      segmentId?: string;
      attempt?: number;
      retriesUsed?: number;
    }
  | ({
      status: "completed";
      source?: string;
      stageId?: string;
      segmentId?: string;
    } & LLMExecutionJobResult)
  | {
      status: "failed";
      provider: string;
      retryable: boolean;
      attempt: number;
      retriesUsed: number;
      message: string;
      model: string;
      source?: string;
      stageId?: string;
      segmentId?: string;
    };

export type LLMExecutionObserver = (event: LLMExecutionEvent) => void;
