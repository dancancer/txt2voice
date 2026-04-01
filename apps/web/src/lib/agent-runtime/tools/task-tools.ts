import type { RuntimeToolContract } from "./contracts";

export const UPDATE_TASK_PROGRESS_TOOL: RuntimeToolContract = {
  name: "update-task-progress",
  kind: "task",
  sideEffect: true,
  inputSchemaRef: "tool.update-task-progress.input.v1",
  outputSchemaRef: "tool.update-task-progress.output.v1",
};

export const CREATE_MANUAL_REVIEW_ITEM_TOOL: RuntimeToolContract = {
  name: "create-manual-review-item",
  kind: "task",
  sideEffect: true,
  inputSchemaRef: "tool.create-manual-review-item.input.v1",
  outputSchemaRef: "tool.create-manual-review-item.output.v1",
};

export const ESTIMATE_TOKEN_BUDGET_TOOL: RuntimeToolContract = {
  name: "estimate-token-budget",
  kind: "task",
  sideEffect: false,
  inputSchemaRef: "tool.estimate-token-budget.input.v1",
  outputSchemaRef: "tool.estimate-token-budget.output.v1",
};

export interface UpdateTaskProgressInput {
  taskId: string;
  progress: number;
  message: string;
}

export interface CreateManualReviewItemInput {
  bookId: string;
  segmentId: string;
  issueType: string;
}

export interface EstimateTokenBudgetInput {
  charCount: number;
  reservedOutputChars?: number;
}

export const updateTaskProgress = (input: UpdateTaskProgressInput) => {
  return {
    accepted: true,
    taskId: input.taskId,
    progress: input.progress,
    message: input.message,
  };
};

export const createManualReviewItem = (input: CreateManualReviewItemInput) => {
  return {
    created: true,
    bookId: input.bookId,
    segmentId: input.segmentId,
    issueType: input.issueType,
  };
};

export const estimateTokenBudget = (input: EstimateTokenBudgetInput) => {
  const reservedOutputChars = input.reservedOutputChars || 0;
  const estimatedTokens = Math.max(
    Math.ceil((input.charCount + reservedOutputChars) / 4),
    0
  );

  return {
    estimatedTokens,
    withinBudget: estimatedTokens <= 8000,
  };
};
