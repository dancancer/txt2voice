import type { RuntimeToolContract } from "./contracts";

export const UPDATE_TASK_PROGRESS_TOOL: RuntimeToolContract = {
  name: "update-task-progress",
  kind: "task",
  sideEffect: true,
  inputSchemaRef: "tool.update-task-progress.input.v1",
  outputSchemaRef: "tool.update-task-progress.output.v1",
};

export interface UpdateTaskProgressInput {
  taskId: string;
  progress: number;
  message: string;
}

export const updateTaskProgress = (input: UpdateTaskProgressInput) => {
  return {
    accepted: true,
    taskId: input.taskId,
    progress: input.progress,
    message: input.message,
  };
};
