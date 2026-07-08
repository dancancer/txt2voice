// 一旦我被更新，请更新我的开头注释
// input: 书级统计/章节树/失败映射/动作
// output: 书级工作台
// pos: 页面组件
"use client";

import { AlertCircle, BookOpen, FileText, Mic2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ChapterTreeNode,
  ScriptNavigationNode,
  SegmentFailedReviewTaskLink,
} from "./types";

interface LLMModelOption {
  id: string;
  label: string;
  model: string;
}

interface BookWorkbenchProps {
  bookTitle: string;
  bookStats: {
    totalChapters: number;
    totalSegments: number;
    scriptSegments: number;
    audioSegments: number;
  };
  chapters: ChapterTreeNode[];
  failedReviewTaskBySegment: Map<string, SegmentFailedReviewTaskLink>;
  llmModels: LLMModelOption[];
  selectedLLMModelId: string;
  llmModelsLoading: boolean;
  llmModelsError: string;
  isGenerating: boolean;
  hasTextSegments: boolean;
  hasScriptSentences: boolean;
  canGenerateScript: boolean;
  onSelectNode: (node: ScriptNavigationNode) => void;
  onSelectLLMModelId: (value: string) => void;
  onGenerateBookScript: () => void;
  onGenerateBookAudio: () => void;
}

type PendingChapter = ChapterTreeNode & {
  reason: "missing_script" | "missing_audio";
};

const percent = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
};

export function BookWorkbench({
  bookTitle,
  bookStats,
  chapters,
  failedReviewTaskBySegment,
  llmModels,
  selectedLLMModelId,
  llmModelsLoading,
  llmModelsError,
  isGenerating,
  hasTextSegments,
  hasScriptSentences,
  canGenerateScript,
  onSelectNode,
  onSelectLLMModelId,
  onGenerateBookScript,
  onGenerateBookAudio,
}: BookWorkbenchProps) {
  const scriptCoverage = percent(bookStats.scriptSegments, bookStats.totalSegments);
  const audioCoverage = percent(bookStats.audioSegments, bookStats.totalSegments);

  const pendingChapters: PendingChapter[] = chapters
    .filter((chapter) => {
      if (chapter.scriptSegments < chapter.totalSegments) {
        return true;
      }
      return chapter.audioSegments < chapter.scriptSegments;
    })
    .map((chapter) => ({
      ...chapter,
      reason:
        chapter.scriptSegments < chapter.totalSegments
          ? "missing_script"
          : "missing_audio",
    }));

  const failedSegments = chapters.flatMap((chapter) =>
    chapter.segments
      .map((segment) => ({
        chapter,
        segment,
        failure: failedReviewTaskBySegment.get(segment.id) || null,
      }))
      .filter(
        (
          item
        ): item is {
          chapter: ChapterTreeNode;
          segment: ChapterTreeNode["segments"][number];
          failure: SegmentFailedReviewTaskLink;
        } => item.failure !== null
      )
  ).sort(
    (left, right) =>
      new Date(right.failure.updatedAt).getTime() -
      new Date(left.failure.updatedAt).getTime()
  );

  const mostUrgentChapter = pendingChapters[0] || null;
  const firstChapter = chapters[0] || null;
  const mostRecentFailedSegment = failedSegments[0] || null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">书级工作台</Badge>
              <Badge variant="outline">{bookStats.totalChapters} 章节</Badge>
              <Badge variant="outline">{bookStats.totalSegments} 段落</Badge>
              {failedSegments.length > 0 ? (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  异常 {failedSegments.length}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{bookTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                这里是整本书的生产面板。先看覆盖率和异常，再进入待处理章节继续深入到段级操作。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onGenerateBookScript}
              disabled={isGenerating || !hasTextSegments || !canGenerateScript}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              全书台本生成
            </Button>
            <Button
              variant="outline"
              onClick={onGenerateBookAudio}
              disabled={isGenerating || !hasScriptSentences}
            >
              <Mic2 className="mr-2 h-4 w-4" />
              全书音频生成
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">章节数量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{bookStats.totalChapters}</p>
            <p className="mt-1 text-sm text-muted-foreground">当前工作台可见章节数</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">台本覆盖率</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{scriptCoverage}%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              已完成台本段落 {bookStats.scriptSegments}/{bookStats.totalSegments}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">音频覆盖率</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{audioCoverage}%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              已完成音频段落 {bookStats.audioSegments}/{bookStats.totalSegments}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">异常段落</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{failedSegments.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">最近台本失败并进入复核的段落数</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" />
                待处理章节
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingChapters.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  当前所有章节都已经进入完整生产状态，可以直接检查异常或继续复核。
                </div>
              ) : (
                pendingChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="rounded-lg border border-border bg-card px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {typeof chapter.chapterIndex === "number"
                              ? `第 ${chapter.chapterIndex + 1} 章`
                              : "章节"}
                          </Badge>
                          <Badge variant="outline">段落 {chapter.totalSegments}</Badge>
                          <Badge variant="outline">台本 {chapter.scriptSegments}</Badge>
                          <Badge variant="outline">音频 {chapter.audioSegments}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">{chapter.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {chapter.reason === "missing_script"
                            ? "这章还有段落未生成台本，建议先补齐台本覆盖。"
                            : "这章台本已经齐了，适合继续补齐章节音频。"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectNode({ type: "chapter", id: chapter.id })}
                        >
                          打开章节
                        </Button>
                        {chapter.segments[0] ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              onSelectNode({ type: "segment", id: chapter.segments[0].id })
                            }
                          >
                            打开首段
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-primary" />
                最近异常
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {failedSegments.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  当前没有需要优先处理的台本失败段落。
                </div>
              ) : (
                failedSegments.slice(0, 6).map(({ chapter, segment, failure }) => (
                  <div
                    key={segment.id}
                    className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {typeof chapter.chapterIndex === "number"
                              ? `第 ${chapter.chapterIndex + 1} 章`
                              : "章节"}
                          </Badge>
                          <Badge variant="outline">{segment.label}</Badge>
                        </div>
                        <p className="text-sm font-medium text-orange-900">{chapter.title}</p>
                        <p className="line-clamp-2 text-sm text-orange-800">{segment.preview}</p>
                        <p className="text-xs text-orange-700">
                          最近失败时间 {new Date(failure.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectNode({ type: "segment", id: segment.id })}
                        >
                          打开段落
                        </Button>
                        <a
                          href={failure.reviewUrl}
                          className="inline-flex min-h-9 items-center justify-center rounded-md border border-orange-300 px-3 text-sm font-medium text-orange-900 transition-colors hover:bg-orange-100"
                        >
                          前往复核
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">台本模型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="script-llm-model"
              >
                当前工作台默认模型
              </label>
              <select
                id="script-llm-model"
                aria-label="台本模型"
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                value={selectedLLMModelId}
                onChange={(event) => onSelectLLMModelId(event.target.value)}
                disabled={llmModelsLoading || llmModels.length === 0}
              >
                {llmModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} ({model.model})
                  </option>
                ))}
              </select>
              {llmModelsError ? (
                <p className="text-sm text-destructive">{llmModelsError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  当前模型会用于整书、章节、段落与增量重生成。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">建议下一步</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mostUrgentChapter ? (
                <>
                  <p className="text-sm text-foreground">
                    当前最值得先处理的是 <span className="font-medium">{mostUrgentChapter.title}</span>。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mostUrgentChapter.reason === "missing_script"
                      ? "这章还有段落没有台本，优先补齐台本覆盖会更顺手。"
                      : "这章台本已经齐了，适合继续补齐章节音频。"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        onSelectNode({ type: "chapter", id: mostUrgentChapter.id })
                      }
                    >
                      打开章节
                    </Button>
                    {mostUrgentChapter.segments[0] ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          onSelectNode({
                            type: "segment",
                            id: mostUrgentChapter.segments[0].id,
                          })
                        }
                      >
                        打开首段
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  当前整书已经没有明显待处理章节，可以转去复核异常或补充角色配置。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">快速入口</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                disabled={!firstChapter}
                onClick={() => {
                  if (firstChapter) {
                    onSelectNode({ type: "chapter", id: firstChapter.id });
                  }
                }}
              >
                <span>进入第一章</span>
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                disabled={!mostRecentFailedSegment}
                onClick={() => {
                  if (mostRecentFailedSegment) {
                    onSelectNode({
                      type: "segment",
                      id: mostRecentFailedSegment.segment.id,
                    });
                  }
                }}
              >
                <span>打开最近失败段落</span>
                <AlertCircle className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
