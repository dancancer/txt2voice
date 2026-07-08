// 一旦我被更新，请更新我的开头注释
// input: 章节节点/段落行/失败任务映射
// output: 章节级工作台
// pos: 页面组件
"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Download,
  FileAudio,
  FileText,
  ListTree,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ChapterDetailPanel } from "./ChapterDetailPanel";
import { ChapterSegmentsTable } from "./ChapterSegmentsTable";
import type {
  ChapterSegmentRow,
  ChapterSegmentsTableTitleAction,
} from "./ChapterSegmentsTable";
import type { ChapterTreeNode, SegmentFailedReviewTaskLink } from "./types";

interface ChapterWorkbenchProps {
  bookId: string;
  chapter: ChapterTreeNode;
  segments: ChapterSegmentRow[];
  failedReviewTaskBySegment?: Map<string, SegmentFailedReviewTaskLink>;
  onSelectSegment: (segmentId: string) => void;
  onGenerateSegmentScript: (segmentId: string) => void;
  onGenerateSegmentAudio: (segmentId: string) => void;
  onGenerateChapterScript: () => void;
  onGenerateChapterAudio: () => void;
  titleAction: ChapterSegmentsTableTitleAction;
}

type ChapterAudioItem = {
  id: string;
  type: string;
  filename?: string | null;
  duration?: number | null;
  createdAt: string;
  audioUrl: string;
  scriptSentence?: {
    id: string;
    text: string;
    orderInSegment: number;
    character?: {
      id: string;
      canonicalName: string;
    } | null;
  } | null;
};

const formatChapterIndex = (value?: number) =>
  typeof value === "number" ? `第 ${value + 1} 章` : "章节";

const formatDuration = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value.toFixed(value >= 10 ? 0 : 1)} 秒`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes} 分 ${seconds} 秒`;
};

export function ChapterWorkbench({
  bookId,
  chapter,
  segments,
  failedReviewTaskBySegment,
  onSelectSegment,
  onGenerateSegmentScript,
  onGenerateSegmentAudio,
  onGenerateChapterScript,
  onGenerateChapterAudio,
  titleAction,
}: ChapterWorkbenchProps) {
  const [chapterAudios, setChapterAudios] = useState<ChapterAudioItem[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadChapterAudios = async () => {
      try {
        setAudioLoading(true);
        setAudioError(null);

        const response = await fetch(
          `/api/books/${bookId}/chapters/${chapter.id}/audios?limit=200`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "加载章节音频失败");
        }

        setChapterAudios(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to load chapter audios:", error);
        setAudioError(
          error instanceof Error ? error.message : "加载章节音频失败"
        );
        setChapterAudios([]);
      } finally {
        if (!controller.signal.aborted) {
          setAudioLoading(false);
        }
      }
    };

    void loadChapterAudios();

    return () => controller.abort();
  }, [bookId, chapter.id]);

  const chapterContent = segments
    .map((segment) => segment.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");

  const failedSegments = segments
    .map((segment) => ({
      segment,
      failure: failedReviewTaskBySegment?.get(segment.id) || null,
    }))
    .filter(
      (
        item
      ): item is {
        segment: ChapterSegmentRow;
        failure: SegmentFailedReviewTaskLink;
      } => item.failure !== null
    );
  const segmentsWithoutScript = useMemo(
    () => segments.filter((segment) => !segment.hasScript),
    [segments]
  );
  const segmentsWithoutAudio = useMemo(
    () => segments.filter((segment) => segment.hasScript && !segment.hasAudio),
    [segments]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatChapterIndex(chapter.chapterIndex)}</Badge>
              <Badge variant="outline">段落 {chapter.totalSegments}</Badge>
              <Badge variant="outline">台本 {chapter.scriptSegments}</Badge>
              <Badge variant="outline">音频 {chapter.audioSegments}</Badge>
              {failedSegments.length > 0 ? (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  异常 {failedSegments.length}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{chapter.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                章节详情能力已经并入工作台：在这里查看原文、管理段落、处理异常并直接进入段级台词操作。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">{titleAction}</div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">
            总览
          </TabsTrigger>
          <TabsTrigger value="content" className="min-h-11">
            原文
          </TabsTrigger>
          <TabsTrigger value="segments" className="min-h-11">
            段落
          </TabsTrigger>
          <TabsTrigger value="audio" className="min-h-11">
            章节音频
          </TabsTrigger>
          <TabsTrigger value="issues" className="min-h-11">
            异常
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <ChapterDetailPanel
            chapter={chapter}
            onGenerateScript={onGenerateChapterScript}
            onGenerateAudio={onGenerateChapterAudio}
            onSelectSegment={onSelectSegment}
          />
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                章节原文
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chapterContent ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {chapterContent}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">当前章节还没有原文内容。</p>
              )}
              {segments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {segments.map((segment) => (
                    <Button
                      key={segment.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectSegment(segment.id)}
                    >
                      打开 {segment.chapterOrderIndex !== undefined ? segment.chapterOrderIndex + 1 : segment.orderIndex + 1} 段
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="mt-4">
          <ChapterSegmentsTable
            chapterTitle={chapter.title}
            titleAction={titleAction}
            failedReviewTaskBySegment={failedReviewTaskBySegment}
            segments={segments}
            onSegmentClick={onSelectSegment}
            onGenerateScript={onGenerateSegmentScript}
            onGenerateAudio={onGenerateSegmentAudio}
          />
        </TabsContent>

        <TabsContent value="audio" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileAudio className="h-5 w-5 text-primary" />
                章节音频
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {audioLoading ? (
                <div className="rounded-md border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" />
                  正在加载章节音频...
                </div>
              ) : null}

              {!audioLoading && audioError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                  {audioError}
                </div>
              ) : null}

              {!audioLoading && !audioError && chapterAudios.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  当前章节还没有可用音频，可先生成章节音频或进入段落生成单段音频。
                </div>
              ) : null}

              {!audioLoading && !audioError
                ? chapterAudios.map((audio) => (
                    <div
                      key={audio.id}
                      className="rounded-lg border border-border bg-card px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {audio.type === "line" ? "单句音频" : "章节音频"}
                            </Badge>
                            {formatDuration(audio.duration) ? (
                              <Badge variant="outline">
                                {formatDuration(audio.duration)}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {audio.scriptSentence?.character?.canonicalName
                              ? `${audio.scriptSentence.character.canonicalName}：`
                              : ""}
                            {audio.scriptSentence?.text?.slice(0, 72) ||
                              audio.filename ||
                              "章节合并音频"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            生成时间 {new Date(audio.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <a
                          href={audio.audioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          打开音频
                        </a>
                      </div>
                      <audio controls className="mt-3 w-full">
                        <source src={audio.audioUrl} />
                        当前浏览器不支持音频播放。
                      </audio>
                    </div>
                  ))
                : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">失败段落</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {failedSegments.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    已进入人工复核链路的台本失败段落。
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">待生成台本</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {segmentsWithoutScript.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    还没有句级台本的段落。
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">待生成音频</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {segmentsWithoutAudio.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    已有台本但仍未生成音频的段落。
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  章节异常明细
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {failedSegments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    当前章节没有待处理的台本失败段落。
                  </div>
                ) : (
                  failedSegments.map(({ segment, failure }) => (
                    <div
                      key={segment.id}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-orange-900">
                            {segment.chapterOrderIndex !== undefined
                              ? `段落 ${segment.chapterOrderIndex + 1}`
                              : `段落 ${segment.orderIndex + 1}`}
                          </p>
                          <p className="line-clamp-2 text-sm text-orange-800">
                            {segment.content || "无内容"}
                          </p>
                          <p className="text-xs text-orange-700">
                            最近失败时间 {new Date(failure.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectSegment(segment.id)}
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            打开段落
                          </Button>
                          <a
                            href={failure.reviewUrl}
                            className="inline-flex min-h-9 items-center justify-center rounded-md border border-orange-300 px-3 text-sm font-medium text-orange-900 transition-colors hover:bg-orange-100"
                          >
                            <ListTree className="mr-1 h-3 w-3" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
