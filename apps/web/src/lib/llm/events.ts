import type {
  LLMExecutionJobResult,
} from "@/lib/task-queue";

export type LLMExecutionEvent =
  | {
      status: "submitted";
      provider: string;
      model: string;
    }
  | ({
      status: "completed";
    } & LLMExecutionJobResult)
  | {
      status: "failed";
      provider: string;
      retryable: boolean;
      attempt: number;
      retriesUsed: number;
      message: string;
    };

export type LLMExecutionObserver = (event: LLMExecutionEvent) => void;
