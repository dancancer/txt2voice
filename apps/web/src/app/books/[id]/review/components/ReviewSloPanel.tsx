// 一旦我被更新，请更新我的开头注释
// input: 统一 SLO 指标/告警事件数据
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
import { buildReviewSloMetricViews } from "../models/slo";
import type { BookSloMetricsResponse, DispatchAlertEvent } from "../models/types";

const METRIC_STATUS_META = {
  healthy: {
    label: "healthy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    valueClassName: "text-emerald-700",
  },
  breached: {
    label: "breached",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    valueClassName: "text-rose-700",
  },
  unknown: {
    label: "unknown",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    valueClassName: "text-slate-700",
  },
} as const;

const EVENT_SEVERITY_META = {
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

interface SloCardSectionProps {
  sloMetrics: BookSloMetricsResponse["data"] | null;
}

export function SloCardSection({ sloMetrics }: SloCardSectionProps) {
  if (!sloMetrics) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 !pt-4">
              <p className="text-xs text-slate-500">核心指标</p>
              <p className="mt-2 text-2xl font-semibold text-slate-400">--</p>
              <p className="mt-2 text-xs text-slate-400">等待加载</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricViews = buildReviewSloMetricViews(sloMetrics.metrics);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {metricViews.map((metric) => {
        const meta = METRIC_STATUS_META[metric.status];
        return (
          <Card key={metric.key} className="border-slate-200 shadow-sm">
            <CardContent className="p-4 !pt-4">
              <p className="text-xs text-slate-500">{metric.shortLabel}</p>
              <p className={`mt-2 text-2xl font-semibold ${meta.valueClassName}`}>
                {metric.valueText}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>target {metric.targetText}</span>
                <Badge className={meta.className}>{meta.label}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">样本 {metric.detailText}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface SloPanelProps {
  sloMetrics: BookSloMetricsResponse["data"] | null;
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
  sloMetrics,
  dispatchEvents,
  dispatchEventSummary,
  dispatchEventActionId,
  onResolveDispatchEvent,
  loading,
}: SloPanelProps) {
  const metricViews = sloMetrics ? buildReviewSloMetricViews(sloMetrics.metrics) : [];
  const reviewBacklog = sloMetrics
    ? sloMetrics.manualReviewSummary.pendingCount +
      sloMetrics.manualReviewSummary.reprocessingCount
    : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">核心 SLO 指标</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-slate-600">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
              正在计算核心指标...
            </div>
          ) : !sloMetrics ? (
            <p className="text-sm text-slate-600">暂无 SLO 指标数据。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>metric</TableHead>
                  <TableHead>current</TableHead>
                  <TableHead>target</TableHead>
                  <TableHead>sample</TableHead>
                  <TableHead>status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricViews.map((metric) => {
                  const meta = METRIC_STATUS_META[metric.status];
                  return (
                    <TableRow key={metric.key}>
                      <TableCell className="font-medium">{metric.label}</TableCell>
                      <TableCell>{metric.valueText}</TableCell>
                      <TableCell>{metric.targetText}</TableCell>
                      <TableCell>{metric.detailText}</TableCell>
                      <TableCell>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">交付摘要与告警事件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-slate-600">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
              正在加载事件...
            </div>
          ) : !sloMetrics ? (
            <p className="text-sm text-slate-600">暂无交付摘要。</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">delivery terminal</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {sloMetrics.workflowSummary.deliverySuccessCount}/
                    {sloMetrics.workflowSummary.deliveryTerminalCount}
                  </p>
                  <p className="mt-1">success / terminal</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">review backlog</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{reviewBacklog}</p>
                  <p className="mt-1">pending + reprocessing</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">workflow</p>
                  <p className="mt-2 leading-6">
                    auto {sloMetrics.workflowSummary.autoPipeline.completed}/
                    {sloMetrics.workflowSummary.autoPipeline.total}
                  </p>
                  <p className="leading-6">
                    assembly {sloMetrics.workflowSummary.finalAssembly.completed}/
                    {sloMetrics.workflowSummary.finalAssembly.total}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">latest quality task</p>
                  <p className="mt-2 text-sm text-slate-900">
                    {sloMetrics.latestQualityTask?.source || "--"}
                  </p>
                  <p className="mt-1">
                    checked {sloMetrics.latestQualityTask?.checked ?? 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">事件生命周期</span>
                  <Badge variant="outline">open {dispatchEventSummary.openCount}</Badge>
                  <Badge variant="outline">acked {dispatchEventSummary.ackedCount}</Badge>
                  <Badge variant="outline">resolved {dispatchEventSummary.resolvedCount}</Badge>
                </div>
                {dispatchEvents.length === 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    当前窗口无核心 SLO 告警事件。
                  </div>
                ) : (
                  dispatchEvents.map((event) => {
                    const severityMeta = EVENT_SEVERITY_META[event.severity];
                    const statusMeta = EVENT_STATUS_META[event.status];
                    const Icon = severityMeta.icon;
                    const actionPending = dispatchEventActionId === event.id;

                    return (
                      <div
                        key={event.id}
                        className={`rounded-md border p-3 text-xs ${severityMeta.className}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                          <Badge variant="outline" className="bg-white/70 text-inherit">
                            {event.alertCode}
                          </Badge>
                          <span className="flex items-center gap-1 font-medium">
                            <Icon className="h-3.5 w-3.5" />
                            {severityMeta.label}
                          </span>
                          <span className="text-slate-500">触发 {event.triggerCount} 次</span>
                        </div>
                        <p className="text-sm leading-6 text-slate-700">{event.message}</p>
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
            </>
          )}
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
