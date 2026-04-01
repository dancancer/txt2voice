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
import {
  getTaskChildJobSummaries,
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
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{summary.label}</Badge>
        <Badge variant="outline">已提交 {summary.submitted}</Badge>
        <Badge variant="outline">完成 {summary.completed}</Badge>
        <Badge variant="outline">失败 {summary.failed}</Badge>
        <Badge variant="outline">重试 {summary.retried}</Badge>
        <Badge variant="outline">处理中 {summary.inFlight}</Badge>
      </div>
      <div className="mt-2 text-sm text-slate-600 leading-6">
        平均等待 {formatDurationMs(summary.averageWaitMs)} · 平均耗时{" "}
        {formatDurationMs(summary.averageLatencyMs)}
      </div>
      {summary.providers.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
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
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("txt2voice:taskRetryToken") || "";
    setRetryToken(token);
  }, []);

  const fetchTasks = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
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
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const timer = setInterval(() => {
      fetchTasks();
    }, 5000);
    return () => clearInterval(timer);
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
      await fetchTasks(true);
    } catch (error) {
      console.error("Failed to retry task:", error);
      toast.error(error instanceof Error ? error.message : "重试任务失败");
    } finally {
      setRetryingId(null);
    }
  };

  const inProgressCount = useMemo(
    () => tasks.filter((task) => task.status === "processing").length,
    [tasks]
  );

  if (loading) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-slate-600">加载任务中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 !pt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">任务中心</h1>
              <p className="text-slate-600 leading-7 mt-1">
                实时观察文本处理、台本生成和音频生成任务，支持失败任务重试。
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">总任务 {tasks.length}</Badge>
                <Badge variant="outline">运行中 {inProgressCount}</Badge>
              </div>
            </div>
            <Button
              onClick={() => fetchTasks(true)}
              disabled={refreshing}
              className="min-h-11 min-w-11"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">任务重试凭证</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600 leading-6">
              失败任务重试需要服务端配置的 <code>TASK_REPLAY_API_TOKEN</code>。
            </p>
            <label
              htmlFor="task-retry-token"
              className="block text-sm font-medium text-slate-700"
            >
              任务重试 token
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
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
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-12 !pt-12 text-center text-slate-600">
              <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              当前暂无任务记录。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isProcessing = task.status === "processing";
              const canRetry = task.status === "failed";
              const statusMeta = getTaskStatusMeta(task.status);
              const childJobSummaries = getTaskChildJobSummaries(task.metadata);
              return (
                <Card key={task.id} className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 !pt-4 sm:p-5 sm:!pt-5 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-medium text-slate-900">
                            {getTaskTypeLabel(task.taskType)}
                          </p>
                          <Badge className={statusMeta.className}>
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          书籍：{task.bookTitle || "未知书籍"} · 任务ID：{task.id.slice(0, 8)}
                        </p>
                      </div>
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
                    </div>

                    {isProcessing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>进度</span>
                          <span>{task.progress || 0}%</span>
                        </div>
                        <Progress value={task.progress || 0} />
                      </div>
                    ) : null}

                    {task.message ? (
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        {task.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
                        ) : task.status === "failed" ? (
                          <XCircle className="w-4 h-4 mt-0.5 text-red-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600" />
                        )}
                        <p className="leading-6">{task.message}</p>
                      </div>
                    ) : null}

                    {task.errorMessage ? (
                      <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700 leading-6">
                        {task.errorMessage}
                      </div>
                    ) : null}

                    {childJobSummaries.length > 0 ? (
                      <div className="space-y-2">
                        {childJobSummaries.map((summary) => renderChildJobSummary(summary))}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500">
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
