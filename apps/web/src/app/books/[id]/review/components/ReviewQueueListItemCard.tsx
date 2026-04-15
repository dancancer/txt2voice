// 一旦我被更新，请更新我的开头注释
// input: 单条复核项/处置回调
// output: 复核项卡片渲染
// pos: 质检复核页面子组件

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getScriptValidationSubtypeLabel,
  SCRIPT_VALIDATION_ISSUE_TYPE,
} from "@/lib/script-validation-review";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import type {
  ManualReviewItem,
  ManualReviewResolveAction,
  ManualReviewStatus,
} from "../models/types";
import { buildScriptValidationDetailView } from "../models/script-validation-detail";

const REVIEW_STATUS_META: Record<
  ManualReviewStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "待复核",
    className: "border-border bg-accent/60 text-foreground",
  },
  reprocessing: {
    label: "重生中",
    className: "border-border bg-accent text-accent-foreground",
  },
  resolved: {
    label: "已通过",
    className: "border-border bg-accent/70 text-foreground",
  },
  rejected: {
    label: "已驳回",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toIssueLabel = (issueType: string): string => {
  const normalized = issueType.trim().toUpperCase();
  if (normalized === "CER") return "文本准确率";
  if (normalized === "SPEAKER") return "说话人一致性";
  if (normalized === "EMOTION") return "情绪匹配";
  if (normalized === "CONTINUITY") return "章节一致性";
  if (normalized === "AUDIO") return "音频质量";
  if (normalized === SCRIPT_VALIDATION_ISSUE_TYPE) return "台本校验";
  return normalized;
};

const toActionLabel = (
  action: ManualReviewResolveAction,
  recommendedAction: string | null
) => {
  if (action !== recommendedAction) {
    if (action === "approve") return "通过";
    if (action === "reject") return "驳回";
    return "重生";
  }
  if (action === "approve") return "通过（推荐）";
  if (action === "reject") return "驳回（推荐）";
  return "重生（推荐）";
};

const toRecommendedActionClassName = (
  action: ManualReviewResolveAction,
  recommendedAction: string | null
) => (action === recommendedAction ? "ring-2 ring-ring ring-offset-2" : "");

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const resolveGeneratedPreview = (structuredResult: Record<string, unknown> | null) => {
  if (!structuredResult) return null;
  const entries = Array.isArray(structuredResult.dialogues)
    ? structuredResult.dialogues
    : Array.isArray(structuredResult.lines)
      ? structuredResult.lines
      : [];

  for (const entry of entries) {
    const record = asRecord(entry);
    const text = typeof record?.text === "string" ? record.text.trim() : "";
    if (text) return text;
  }

  return null;
};

const rawResponseFallback = (rawResponse: string | undefined): string =>
  rawResponse ? rawResponse.slice(0, 160) : "暂无原始生成结果";

export function ReviewQueueListItemCard(props: {
  item: ManualReviewItem;
  checked: boolean;
  canResolve: boolean;
  actionPending: boolean;
  batchActionLoading: boolean;
  onToggleSelection: (checked: boolean) => void;
  onOpenEdit: () => void;
  onResolve: (action: ManualReviewResolveAction) => void;
}) {
  const { item } = props;
  const statusMeta = REVIEW_STATUS_META[item.status];
  const score = item.latestQualityCheck?.score ?? item.audio?.qualityScore;
  const scriptDetail =
    item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
      ? buildScriptValidationDetailView({
          issueSubtype: item.issueSubtype,
          issueDetail: item.issueDetail,
        })
      : null;
  const primaryText =
    item.sentence?.text || scriptDetail?.segmentPreview || "当前条目缺少句子文本";
  const generatedPreview = resolveGeneratedPreview(
    scriptDetail?.structuredResult || null
  );

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 !pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {props.canResolve ? (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={props.checked}
                disabled={props.batchActionLoading || props.actionPending}
                onChange={(event) => props.onToggleSelection(event.target.checked)}
              />
              选中
            </label>
          ) : null}
          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
          <Badge variant="outline">{toIssueLabel(item.issueType)}</Badge>
          {item.issueSubtype ? (
            <Badge variant="outline">
              {getScriptValidationSubtypeLabel(item.issueSubtype)}
            </Badge>
          ) : null}
          <Badge variant="outline">priority: {item.priority}</Badge>
          {score !== null && score !== undefined ? (
            <Badge variant="outline">score: {score.toFixed(2)}</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            创建于 {formatDateTime(item.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {primaryText}
        </p>
        {item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
                段落原文
              </p>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {scriptDetail?.segmentContent || scriptDetail?.segmentPreview || "暂无完整原文"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
                当前生成结果预览
              </p>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {generatedPreview || rawResponseFallback(scriptDetail?.rawResponse)}
              </p>
            </div>
          </div>
        ) : null}
        {scriptDetail?.summary ? (
          <div className="rounded-md border border-border bg-accent/60 p-3 text-sm text-foreground">
            {scriptDetail.summary}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>chapter: {item.chapterId || "-"}</span>
          <span>segment: {item.segmentId || "-"}</span>
          <span>sentence: {item.sentenceId || "-"}</span>
          <span>emotion: {item.sentence?.emotionLabel || "-"}</span>
          <span>更新时间: {formatDateTime(item.updatedAt)}</span>
        </div>
        {scriptDetail?.hasDetails ? (
          <details className="rounded-md border border-border bg-muted/50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              查看脚本失败详情
            </summary>
            <div className="mt-3 space-y-3 text-sm text-foreground">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {scriptDetail.stage ? <span>stage: {scriptDetail.stage}</span> : null}
                {scriptDetail.errorCode ? <span>errorCode: {scriptDetail.errorCode}</span> : null}
                {scriptDetail.coverageLabel ? <span>coverage: {scriptDetail.coverageLabel}</span> : null}
              </div>
              {scriptDetail.issueMessages.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">
                    完整问题列表
                  </p>
                  <div className="space-y-2">
                    {scriptDetail.issueMessages.map((message) => (
                      <p
                        key={message}
                        className="rounded border border-border bg-card px-3 py-2 text-xs leading-5 text-foreground"
                      >
                        {message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {scriptDetail.issueCodes.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    问题代码
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scriptDetail.issueCodes.map((code) => (
                      <Badge key={code} variant="outline">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {scriptDetail.issuePreviews.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    问题原文预览
                  </p>
                  <div className="space-y-2">
                    {scriptDetail.issuePreviews.map((preview) => (
                      <p
                        key={preview}
                        className="rounded border border-border bg-card px-3 py-2 text-xs leading-5 text-foreground"
                      >
                        {preview}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {scriptDetail.actionHints.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">
                    建议动作
                  </p>
                  <ol className="space-y-2">
                    {scriptDetail.actionHints.map((hint) => (
                      <li
                        key={hint}
                        className="rounded border border-border bg-card px-3 py-2 text-xs leading-5 text-foreground"
                      >
                        {hint}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {scriptDetail.segmentPreview ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    段落原文预览
                  </p>
                  <p className="rounded border border-border bg-card px-3 py-2 text-xs leading-5 text-foreground">
                    {scriptDetail.segmentPreview}
                  </p>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
        {scriptDetail?.recommendedActionLabel ? (
          <div className="rounded-md border border-border bg-accent/60 px-3 py-2 text-xs text-foreground">
            推荐动作：{scriptDetail.recommendedActionLabel}
          </div>
        ) : null}
        {item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE &&
        (scriptDetail?.segmentContent || scriptDetail?.rawResponse || scriptDetail?.structuredResult) ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={props.actionPending || props.batchActionLoading}
              onClick={props.onOpenEdit}
            >
              打开修订工作台
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`min-h-10 ${toRecommendedActionClassName(
              "approve",
              scriptDetail?.recommendedAction || null
            )}`}
            disabled={!props.canResolve || props.actionPending || props.batchActionLoading}
            onClick={() => props.onResolve("approve")}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {toActionLabel("approve", scriptDetail?.recommendedAction || null)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`min-h-10 ${toRecommendedActionClassName(
              "reject",
              scriptDetail?.recommendedAction || null
            )}`}
            disabled={!props.canResolve || props.actionPending || props.batchActionLoading}
            onClick={() => props.onResolve("reject")}
          >
            <XCircle className="mr-1 h-4 w-4" />
            {toActionLabel("reject", scriptDetail?.recommendedAction || null)}
          </Button>
          <Button
            type="button"
            size="sm"
            className={`min-h-10 ${toRecommendedActionClassName(
              "regenerate",
              scriptDetail?.recommendedAction || null
            )}`}
            disabled={!props.canResolve || props.actionPending || props.batchActionLoading}
            onClick={() => props.onResolve("regenerate")}
          >
            {props.actionPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1 h-4 w-4" />
            )}
            {toActionLabel("regenerate", scriptDetail?.recommendedAction || null)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
