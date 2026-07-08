// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTaskChildJobSummaries,
  getTaskRecentRuntimeEvents,
  getTaskStatusMeta,
  getTaskTypeLabel,
  type ProcessingTaskStatus,
  type TaskChildJobSummary,
} from "@/lib/view-models/tasks";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

type TaskItem = {
  id: string;
  bookId: string;
  bookTitle?: string | null;
  taskType: string;
  status: ProcessingTaskStatus;
  progress: number;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

const formatDurationMs = (value: number): string => {
  if (value < 1000) {
    return `${value}ms`;
  }
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
};

const renderChildJobSummary = (summary: TaskChildJobSummary) => {
  return (
    <div
      key={summary.key}
      className="rounded-md border border-border bg-muted/50 px-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{summary.label}</Badge>
        <Badge variant="outline">已提交 {summary.submitted}</Badge>
        <Badge variant="outline">完成 {summary.completed}</Badge>
        <Badge variant="outline">失败 {summary.failed}</Badge>
        <Badge variant="outline">重试 {summary.retried}</Badge>
        <Badge variant="outline">处理中 {summary.inFlight}</Badge>
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        平均等待 {formatDurationMs(summary.averageWaitMs)} · 平均耗时{" "}
        {formatDurationMs(summary.averageLatencyMs)}
      </div>
      {summary.providers.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {summary.providers.map((provider) => (
            <span key={`${summary.key}-${provider.provider}`}>
              {provider.provider} · 完成 {provider.completed} · 失败 {provider.failed} ·
              重试 {provider.retried}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("txt2voice:taskRetryToken") || "";
    setRetryToken(token);
  }, []);

  const fetchTasks = useCallback(async (mode: "initial" | "manual" | "background" = "background") => {
    try {
      const shouldShowInitialLoading = mode === "initial" || !hasLoadedOnce;
      if (shouldShowInitialLoading) {
        setLoading(true);
      } else if (mode === "manual") {
        setRefreshing(true);
      }
      const response = await fetch("/api/tasks?limit=50");
      if (!response.ok) {
        throw new Error("获取任务列表失败");
      }

      const result = await response.json();
      setTasks(result.data || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error(error instanceof Error ? error.message : "获取任务列表失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [hasLoadedOnce]);

  useEffect(() => {
    fetchTasks("initial");
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void fetchTasks("background");
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchTasks]);

  const handleSaveRetryToken = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("txt2voice:taskRetryToken", retryToken.trim());
    }
    toast.success("任务重试凭证已保存");
  };

  const handleRetryTask = async (taskId: string) => {
    const token = retryToken.trim();
    if (!token) {
      toast.error("请先填写任务重试凭证");
      return;
    }

    try {
      setRetryingId(taskId);
      const response = await fetch(`/api/tasks/${taskId}/retry`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-txt2voice-replay-token": token,
        },
        body: JSON.stringify({ force: true }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "重试任务失败");
      }

      toast.success("任务已重新提交");
      await fetchTasks("manual");
    } catch (error) {
      console.error("Failed to retry task:", error);
      toast.error(error instanceof Error ? error.message : "重试任务失败");
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    const token = retryToken.trim();
    if (!token) {
      toast.error("请先填写任务重试凭证");
      return;
    }

    try {
      setCancelingId(taskId);
      const response = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-txt2voice-replay-token": token,
        },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "取消任务失败");
      }

      toast.success("任务已取消");
      await fetchTasks("manual");
    } catch (error) {
      console.error("Failed to cancel task:", error);
      toast.error(error instanceof Error ? error.message : "取消任务失败");
    } finally {
      setCancelingId(null);
    }
  };

  const inProgressCount = useMemo(
    () => tasks.filter((task) => task.status === "processing").length,
    [tasks]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载任务中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card className="shadow-sm">
          <CardContent className="p-6 !pt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">任务中心</h1>
              <p className="mt-1 leading-7 text-muted-foreground">
                实时观察文本处理、台本生成和音频生成任务，支持失败任务重试。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">总任务 {tasks.length}</Badge>
                <Badge variant="outline">运行中 {inProgressCount}</Badge>
                <Badge variant="outline">自动刷新 5s</Badge>
              </div>
            </div>
            <Button
              onClick={() => fetchTasks("manual")}
              disabled={refreshing}
              className="min-h-11 min-w-11"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">任务重试凭证</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              任务重试与取消需要服务端配置的 <code>TASK_REPLAY_API_TOKEN</code>。
            </p>
            <Label htmlFor="task-retry-token" className="block">
              任务操作 token
            </Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="task-retry-token"
                value={retryToken}
                onChange={(event) => setRetryToken(event.target.value)}
                placeholder="输入任务重试 token"
                className="min-h-11"
              />
              <Button type="button" variant="outline" className="min-h-11" onClick={handleSaveRetryToken}>
                保存凭证
              </Button>
            </div>
          </CardContent>
        </Card>

        {tasks.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 !pt-12 text-center text-muted-foreground">
              <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              当前暂无任务记录。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isProcessing = task.status === "processing";
              const canRetry = task.status === "failed";
              const canCancel = task.status === "processing";
              const statusMeta = getTaskStatusMeta(task.status);
              const childJobSummaries = getTaskChildJobSummaries(task.metadata);
              const recentRuntimeEvents = getTaskRecentRuntimeEvents(task.metadata)
                .slice()
                .reverse();
              return (
                <Card key={task.id} className="shadow-sm">
                  <CardContent className="space-y-4 p-4 !pt-4 sm:p-5 sm:!pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-medium text-foreground">
                            {getTaskTypeLabel(task.taskType)}
                          </p>
                          <Badge className={statusMeta.className}>
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          书籍：{task.bookTitle || "未知书籍"} · 任务ID：{task.id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canRetry ? (
                          <Button
                            variant="outline"
                            className="min-h-11"
                            disabled={retryingId === task.id || !retryToken.trim()}
                            onClick={() => handleRetryTask(task.id)}
                          >
                            {retryingId === task.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                重试中...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                重试
                              </>
                            )}
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            variant="outline"
                            className="min-h-11 text-amber-700"
                            disabled={cancelingId === task.id || !retryToken.trim()}
                            onClick={() => handleCancelTask(task.id)}
                          >
                            {cancelingId === task.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                取消中...
                              </>
                            ) : (
                              "取消任务"
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {isProcessing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>进度</span>
                          <span>{task.progress || 0}%</span>
                        </div>
                        <Progress value={task.progress || 0} />
                      </div>
                    ) : null}

                    {task.message ? (
                      <div className="flex items-start gap-2 text-sm text-foreground">
                        {task.status === "completed" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        ) : task.status === "failed" ? (
                          <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                        ) : task.status === "canceled" ? (
                          <XCircle className="mt-0.5 h-4 w-4 text-amber-700" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                        )}
                        <p className="leading-6">{task.message}</p>
                      </div>
                    ) : null}

                    {task.errorMessage ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive">
                        {task.errorMessage}
                      </div>
                    ) : null}

                    {childJobSummaries.length > 0 ? (
                      <div className="space-y-2">
                        {childJobSummaries.map((summary) => renderChildJobSummary(summary))}
                      </div>
                    ) : null}

                    {recentRuntimeEvents.length > 0 ? (
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-3">
                        <p className="text-sm font-medium text-foreground">最近进展</p>
                        <div className="mt-2 space-y-2">
                          {recentRuntimeEvents.map((event) => (
                            <div
                              key={`${task.id}-${event.seq}`}
                              className="rounded-md border border-border/60 bg-background/80 px-3 py-2"
                            >
                              <p className="text-sm text-foreground">{event.title}</p>
                              {event.detail ? (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {event.detail}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <p>创建：{new Date(task.createdAt).toLocaleString()}</p>
                      <p>更新：{new Date(task.updatedAt).toLocaleString()}</p>
                      <p>完成：{task.completedAt ? new Date(task.completedAt).toLocaleString() : "-"}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
