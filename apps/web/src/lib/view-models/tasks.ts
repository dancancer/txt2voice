// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 任务视图模型
// pos: 共享业务库
export type ProcessingTaskStatus = "pending" | "processing" | "completed" | "failed";

export type TaskStatusMeta = {
  label: string;
  className: string;
};

const TASK_TYPE_LABEL: Record<string, string> = {
  TEXT_PROCESSING: "文本处理",
  SCRIPT_GENERATION: "台本生成",
  AUDIO_GENERATION: "音频生成",
};

const TASK_STATUS_META: Record<ProcessingTaskStatus, TaskStatusMeta> = {
  pending: {
    label: "等待中",
    className: "bg-slate-100 text-slate-700",
  },
  processing: {
    label: "执行中",
    className: "bg-blue-100 text-blue-700",
  },
  completed: {
    label: "已完成",
    className: "bg-emerald-100 text-emerald-700",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-700",
  },
};

export const getTaskTypeLabel = (taskType: string) => {
  return TASK_TYPE_LABEL[taskType] || taskType;
};

export const getTaskStatusMeta = (status: string): TaskStatusMeta => {
  if (status in TASK_STATUS_META) {
    return TASK_STATUS_META[status as ProcessingTaskStatus];
  }

  return {
    label: status,
    className: "bg-slate-100 text-slate-700",
  };
};
