// 一旦我被更新，请更新我的开头注释
// input: 质量摘要/派单指标/告警数据
// output: SLO 看板展示
// pos: 质检复核页面子组件

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Loader2, Waves } from "lucide-react";
import type {
  DispatchAlertItem,
  DispatchAlertEvent,
  DispatchMetricsResult,
  QualitySummary,
  ReviewSummary,
} from "../models/types";

const ALERT_SEVERITY_META = {
  critical: {
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: AlertTriangle,
    label: "严重",
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
    label: "预警",
  },
} as const;

const EVENT_STATUS_META = {
  open: {
    label: "open",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  acked: {
    label: "acked",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  resolved: {
    label: "resolved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
} as const;

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const toIssueLabel = (issueType: string): string => {
  const normalized = issueType.trim().toUpperCase();
  if (normalized === "CER") {
    return "文本准确率";
  }
  if (normalized === "SPEAKER") {
    return "说话人一致性";
  }
  if (normalized === "EMOTION") {
    return "情绪匹配";
  }
  if (normalized === "CONTINUITY") {
    return "章节一致性";
  }
  if (normalized === "AUDIO") {
    return "音频质量";
  }
  return normalized;
};

interface SloCardSectionProps {
  reviewSummary: ReviewSummary;
  qualitySummary: QualitySummary;
  metrics: DispatchMetricsResult | null;
}

export function SloCardSection({
  reviewSummary,
  qualitySummary,
  metrics,
}: SloCardSectionProps) {
  const backlog = reviewSummary.pendingCount + reviewSummary.reprocessingCount;
  const passRate =
    qualitySummary.checked > 0
      ? (qualitySummary.passCount / qualitySummary.checked) * 100
      : 0;
  const retryCount = qualitySummary.repairCount + qualitySummary.manualReviewCount;
  const falsePositive = qualitySummary.falsePositiveCandidateCount;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 !pt-4">
          <p className="text-xs text-slate-500">当前 backlog</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{backlog}</p>
          <p className="mt-2 text-xs text-slate-500">pending + reprocessing</p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 !pt-4">
          <p className="text-xs text-slate-500">最新质检通过率</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatPercent(passRate)}</p>
          <p className="mt-2 text-xs text-slate-500">pass {qualitySummary.passCount} / checked {qualitySummary.checked}</p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 !pt-4">
          <p className="text-xs text-slate-500">重试压力</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{retryCount}</p>
          <p className="mt-2 text-xs text-slate-500">
            repair + manual review
            {metrics ? `（窗口 autoRejected ${metrics.totals.autoRejectedEventCount}）` : ""}
          </p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 !pt-4">
          <p className="text-xs text-slate-500">误报候选</p>
          <p className="mt-2 text-2xl font-semibold text-indigo-700">{falsePositive}</p>
          <p className="mt-2 text-xs text-slate-500">override {qualitySummary.deepGateOverrideCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface SloPanelProps {
  metrics: DispatchMetricsResult | null;
  alerts: DispatchAlertItem[];
  dispatchEvents: DispatchAlertEvent[];
  dispatchEventSummary: {
    openCount: number;
    ackedCount: number;
    resolvedCount: number;
    totalCount: number;
  };
  dispatchEventActionId: string | null;
  onResolveDispatchEvent: (eventId: string, action: "ack" | "resolve") => void;
  loading: boolean;
}

export function SloPanel({
  metrics,
  alerts,
  dispatchEvents,
  dispatchEventSummary,
  dispatchEventActionId,
  onResolveDispatchEvent,
  loading,
}: SloPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">运营指标拆分</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-slate-600">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
              正在计算窗口指标...
            </div>
          ) : !metrics ? (
            <p className="text-sm text-slate-600">暂无指标数据。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>issueType</TableHead>
                  <TableHead>autoRejected</TableHead>
                  <TableHead>secondaryPending</TableHead>
                  <TableHead>thresholdBlocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.byIssueType.slice(0, 6).map((row) => (
                  <TableRow key={row.issueType}>
                    <TableCell className="font-medium">{toIssueLabel(row.issueType)}</TableCell>
                    <TableCell>{row.autoRejectedEventCount}</TableCell>
                    <TableCell>{row.secondaryPendingCount}</TableCell>
                    <TableCell>{row.thresholdBlockedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">当前告警与事件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-slate-600">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
              正在加载告警...
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              当前窗口无派单告警。
            </div>
          ) : (
            alerts.map((alert) => {
              const meta = ALERT_SEVERITY_META[alert.severity];
              const Icon = meta.icon;
              return (
                <div
                  key={alert.code}
                  className={`rounded-md border p-3 text-sm ${meta.className}`}
                >
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4" />
                    <span>{meta.label}</span>
                    <Badge variant="outline" className="bg-white/70 text-inherit">
                      {alert.code}
                    </Badge>
                  </div>
                  <p className="leading-6">{alert.message}</p>
                  <p className="mt-1 text-xs leading-5">建议：{alert.recommendedAction}</p>
                </div>
              );
            })
          )}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">事件生命周期</span>
              <Badge variant="outline">open {dispatchEventSummary.openCount}</Badge>
              <Badge variant="outline">acked {dispatchEventSummary.ackedCount}</Badge>
              <Badge variant="outline">resolved {dispatchEventSummary.resolvedCount}</Badge>
            </div>
            {dispatchEvents.length === 0 ? (
              <p className="text-xs text-slate-500">暂无告警事件。</p>
            ) : (
              dispatchEvents.map((event) => {
                const statusMeta = EVENT_STATUS_META[event.status];
                const actionPending = dispatchEventActionId === event.id;
                return (
                  <div key={event.id} className="rounded-md border border-slate-200 bg-white p-3 text-xs">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                      <Badge variant="outline">{event.alertCode}</Badge>
                      <Badge variant="outline">{event.issueType || "ALL"}</Badge>
                      <span className="text-slate-500">触发 {event.triggerCount} 次</span>
                    </div>
                    <p className="text-sm text-slate-700">{event.message}</p>
                    <p className="mt-1 text-slate-500">
                      最近触发: {new Date(event.lastTriggeredAt).toLocaleString("zh-CN")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-9"
                        disabled={actionPending || event.status !== "open"}
                        onClick={() => onResolveDispatchEvent(event.id, "ack")}
                      >
                        {actionPending ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                        )}
                        Ack
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9"
                        disabled={actionPending || event.status === "resolved"}
                        onClick={() => onResolveDispatchEvent(event.id, "resolve")}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {metrics ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700">窗口统计</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <span>autoRejected: {metrics.totals.autoRejectedEventCount}</span>
                <span>secondaryPending: {metrics.totals.secondaryPendingCount}</span>
                <span>thresholdBlocked: {metrics.totals.thresholdBlockedCount}</span>
                <span>qualityTask: {metrics.qualityTaskSummary.taskCount}</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReviewWindowIndicator({ days }: { days: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
      <Waves className="h-3.5 w-3.5" />
      SLO 窗口：最近 {days} 天
    </div>
  );
}
