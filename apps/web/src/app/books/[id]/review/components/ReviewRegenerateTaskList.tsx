// 一旦我被更新，请更新我的开头注释
// input: review 重生任务列表 props
// output: 最近重生任务卡片
// pos: 质检复核页面子组件

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getTaskStatusMeta, getTaskTypeLabel } from "@/lib/view-models/tasks";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { ReviewRegenerateTask } from "../models/types";

interface ReviewRegenerateTaskListProps {
  tasks: ReviewRegenerateTask[];
  loading: boolean;
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toSourceLabel = (source: ReviewRegenerateTask["source"]): string => {
  if (source === "manual_review_batch") {
    return "批量重生";
  }
  if (source === "manual_review_bulk_pending") {
    return "全量待复核重生";
  }
  return "单条重生";
};

const toStatusIcon = (status: ReviewRegenerateTask["status"]) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (status === "processing") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  return <Clock3 className="h-4 w-4 text-muted-foreground" />;
};

export function ReviewRegenerateTaskList({
  tasks,
  loading,
}: ReviewRegenerateTaskListProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <RotateCcw className="h-5 w-5 text-primary" />
          最近重生任务
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          展示当前书籍由人工复核触发的单条/批量重生任务；有运行中任务时，页面会自动刷新。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
            正在加载最近重生任务...
          </div>
        ) : null}

        {!loading && tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            当前还没有人工复核触发的重生任务。
          </div>
        ) : null}

        {!loading
          ? tasks.map((task) => {
              const statusMeta = getTaskStatusMeta(task.status);
              const isProcessing = task.status === "processing";

              return (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getTaskTypeLabel(task.taskType)}</Badge>
                    <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                    <Badge variant="outline">{toSourceLabel(task.source)}</Badge>
                    <Badge variant="outline">目标 {task.targetCount} 条</Badge>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                    {toStatusIcon(task.status)}
                    <p className="leading-6">{task.message || "任务已创建，等待执行。"}</p>
                  </div>

                  {isProcessing ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>当前进度</span>
                        <span>{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} />
                    </div>
                  ) : null}

                  {task.errorMessage ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <p className="leading-6">{task.errorMessage}</p>
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <p>任务ID: {task.id.slice(0, 8)}</p>
                    <p>创建: {formatDateTime(task.createdAt)}</p>
                    <p>
                      {task.status === "completed" ? "完成" : "更新"}:{" "}
                      {formatDateTime(task.completedAt || task.updatedAt)}
                    </p>
                  </div>
                </div>
              );
            })
          : null}
      </CardContent>
    </Card>
  );
}
