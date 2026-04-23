// 一旦我被更新，请更新我的开头注释
// input: 路由参数/接口数据
// output: 复核工作台与 SLO 看板页面
// pos: 路由页面入口
"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import {
  ReviewFilterBar,
  ReviewPaginationBar,
  ReviewQueueList,
} from "./components/ReviewQueuePanel";
import { ReviewRegenerateTaskList } from "./components/ReviewRegenerateTaskList";
import {
  ReviewWindowIndicator,
  SloCardSection,
  SloPanel,
} from "./components/ReviewSloPanel";
import { useReviewWorkbenchData } from "./hooks/useReviewWorkbenchData";
import { SLO_WINDOW_OPTIONS, SOURCE_FILTER_OPTIONS } from "./models/types";

export default function ReviewWorkbenchPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const {
    bookTitle,
    items,
    pagination,
    summary,
    sloMetrics,
    dispatchEvents,
    dispatchEventSummary,
    recentRegenerateTasks,
    filters,
    page,
    windowDays,
    sourceFilter,
    reviewLoading,
    sloLoading,
    taskLoading,
    refreshing,
    actionLoadingItemId,
    batchActionLoading,
    dispatchEventActionId,
    scriptSaveLoadingItemId,
    allPendingRegenerateLoading,
    error,
    issueTypeOptions,
    recommendedActionOptions,
    scriptSubtypeOptions,
    showRecommendedActionFilter,
    showScriptSubtypeFilter,
    setPage,
    setWindowDays,
    setSourceFilter,
    loadReviewData,
    loadSloData,
    refreshAll,
    updateStatusFilter,
    updateIssueTypeFilter,
    updateRecommendedActionFilter,
    updateScriptSubtypeFilter,
    updatePriorityFilter,
    resolveItem,
    resolveItemsInBatch,
    regenerateAllPendingItems,
    resolveDispatchEvent,
    exportReviewLogs,
    saveScriptEdit,
  } = useReviewWorkbenchData(bookId);

  const backlog = summary.pendingCount + summary.reprocessingCount;
  const isInitialLoading = useMemo(
    () => reviewLoading && sloLoading && items.length === 0 && !sloMetrics,
    [items.length, reviewLoading, sloLoading, sloMetrics]
  );

  if (isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">正在加载复核工作台...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="min-h-11 min-w-11 px-2 text-muted-foreground"
              onClick={() => router.push(`/books/${bookId}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回书籍详情
            </Button>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{bookTitle}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">backlog {backlog}</Badge>
              <Badge variant="outline">pending {summary.pendingCount}</Badge>
              <Badge variant="outline">resolved {summary.resolvedCount}</Badge>
              <ReviewWindowIndicator days={windowDays} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => router.push(`/tasks`)}>
              前往任务中心
            </Button>
            <Button className="min-h-11" onClick={refreshAll} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  同步中...
                </>
              ) : (
                "同步复核与看板"
              )}
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/20 bg-destructive/10 shadow-sm">
            <CardContent className="flex items-center gap-2 p-4 !pt-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="queue" className="min-h-11">人工复核队列</TabsTrigger>
            <TabsTrigger value="slo" className="min-h-11">SLO 看板</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-4">
            <SloCardSection sloMetrics={sloMetrics} />
            <ReviewRegenerateTaskList
              tasks={recentRegenerateTasks}
              loading={taskLoading}
            />
            <ReviewFilterBar
              status={filters.status}
              issueType={filters.issueType}
              scriptSubtype={filters.scriptSubtype}
              recommendedAction={filters.recommendedAction}
              priority={filters.priority}
              pendingCount={summary.pendingCount}
              allPendingRegenerateLoading={allPendingRegenerateLoading}
              issueTypeOptions={issueTypeOptions}
              scriptSubtypeOptions={scriptSubtypeOptions}
              recommendedActionOptions={recommendedActionOptions}
              showScriptSubtypeFilter={showScriptSubtypeFilter}
              showRecommendedActionFilter={showRecommendedActionFilter}
              onStatusChange={updateStatusFilter}
              onIssueTypeChange={updateIssueTypeFilter}
              onScriptSubtypeChange={updateScriptSubtypeFilter}
              onRecommendedActionChange={updateRecommendedActionFilter}
              onPriorityChange={updatePriorityFilter}
              onRefresh={() => loadReviewData(true)}
              onExport={exportReviewLogs}
              onRegenerateAllPending={() =>
                regenerateAllPendingItems(summary.pendingCount)
              }
              refreshing={reviewLoading}
            />
            <ReviewQueueList
              items={items}
              loading={reviewLoading}
              actionLoadingItemId={actionLoadingItemId}
              batchActionLoading={batchActionLoading}
              scriptSaveLoadingItemId={scriptSaveLoadingItemId}
              onResolve={resolveItem}
              onBatchResolve={resolveItemsInBatch}
              onSaveScriptEdit={saveScriptEdit}
            />
            <ReviewPaginationBar
              pagination={pagination}
              onPageChange={(nextPage) => {
                if (nextPage !== page) {
                  setPage(nextPage);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="slo" className="mt-4 space-y-4">
            <SloCardSection sloMetrics={sloMetrics} />
            <Card className="shadow-sm">
              <CardContent className="p-4 !pt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Select value={String(windowDays)} onValueChange={(value) => setWindowDays(Number(value))}>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="SLO 窗口" />
                    </SelectTrigger>
                    <SelectContent>
                      {SLO_WINDOW_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="来源过滤" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => loadSloData(true)}
                    disabled={sloLoading}
                  >
                    {sloLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        计算中
                      </>
                    ) : (
                      "刷新 SLO 指标"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <SloPanel
              sloMetrics={sloMetrics}
              dispatchEvents={dispatchEvents}
              dispatchEventSummary={dispatchEventSummary}
              dispatchEventActionId={dispatchEventActionId}
              onResolveDispatchEvent={resolveDispatchEvent}
              loading={sloLoading}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
