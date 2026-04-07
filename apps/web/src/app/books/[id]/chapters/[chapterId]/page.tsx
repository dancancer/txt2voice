// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  Music,
  Download,
  Sparkles,
} from "lucide-react";

type ChapterDetail = {
  id: string;
  chapterIndex: number;
  title: string;
  status: string;
};

type SegmentRecord = {
  id: string;
  content: string;
  chapterOrderIndex?: number | null;
};

type ScriptRecord = {
  id: string;
  text: string;
  rawSpeaker?: string | null;
  tone?: string | null;
  orderInSegment: number;
  character?: {
    id: string;
    canonicalName: string;
  } | null;
  segment?: {
    id: string;
    chapterOrderIndex?: number | null;
  } | null;
  audio?: {
    id: string;
    url: string;
    duration?: number | null;
  } | null;
};

type AudioRecord = {
  id: string;
  type: string;
  duration?: number | null;
  createdAt: string;
  audioUrl: string;
  scriptSentence?: {
    text: string;
    character?: {
      canonicalName: string;
    } | null;
  } | null;
};

export default function ChapterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [segments, setSegments] = useState<SegmentRecord[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [audios, setAudios] = useState<AudioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);

  const loadChapterData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [detailRes, scriptsRes, audiosRes] = await Promise.all([
        fetch(`/api/books/${bookId}/chapters/${chapterId}`),
        fetch(`/api/books/${bookId}/chapters/${chapterId}/scripts?limit=200`),
        fetch(`/api/books/${bookId}/chapters/${chapterId}/audios?limit=200`),
      ]);

      if (!detailRes.ok || !scriptsRes.ok || !audiosRes.ok) {
        throw new Error("加载章节数据失败");
      }

      const detailResult = await detailRes.json();
      const scriptsResult = await scriptsRes.json();
      const audiosResult = await audiosRes.json();

      setChapter(detailResult.data.chapter);
      setSegments(detailResult.data.segments || []);
      setScripts(scriptsResult.data || []);
      setAudios(audiosResult.data || []);
    } catch (err) {
      console.error("Failed to load chapter details:", err);
      setError(err instanceof Error ? err.message : "加载章节数据失败");
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId]);

  useEffect(() => {
    loadChapterData();
  }, [loadChapterData]);

  const handleGenerateChapterAudio = async () => {
    try {
      setGeneratingAudio(true);
      const response = await fetch(
        `/api/books/${bookId}/chapters/${chapterId}/audio/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            autoMerge: true,
            skipExisting: true,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error?.message || "章节音频任务启动失败");
      }

      toast.success("章节音频生成任务已启动，请在任务中心查看进度");
    } catch (err) {
      console.error("Failed to generate chapter audio:", err);
      toast.error(err instanceof Error ? err.message : "章节音频任务启动失败");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const chapterContent = useMemo(
    () => segments.map((segment) => segment.content).join("\n\n"),
    [segments]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载章节中...</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="mb-4 text-destructive">{error || "章节不存在"}</p>
          <Button onClick={() => router.push(`/books/${bookId}`)}>返回书籍详情</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button
              variant="ghost"
              onClick={() => router.push(`/books/${bookId}`)}
              className="min-h-11 min-w-11 px-2 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回书籍详情
            </Button>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
              第 {chapter.chapterIndex + 1} 章 · {chapter.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">段落 {segments.length}</Badge>
              <Badge variant="outline">台本 {scripts.length}</Badge>
              <Badge variant="outline">音频 {audios.length}</Badge>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(`/books/${bookId}/studio/script`)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              高级台本
            </Button>
            <Button
              className="min-h-11"
              disabled={generatingAudio || scripts.length === 0}
              onClick={handleGenerateChapterAudio}
            >
              {generatingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  启动中...
                </>
              ) : (
                <>
                  <Music className="w-4 h-4 mr-2" />
                  生成章节音频
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="content" className="min-h-11">原文内容</TabsTrigger>
            <TabsTrigger value="scripts" className="min-h-11">台本 ({scripts.length})</TabsTrigger>
            <TabsTrigger value="audios" className="min-h-11">音频 ({audios.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">章节原文</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-base leading-7 text-muted-foreground">
                  {chapterContent || "暂无内容"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scripts" className="mt-4">
            {scripts.length === 0 ? (
              <Card>
                <CardContent className="py-10 !pt-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  暂无台本，请先执行台本生成。
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {scripts.map((script) => (
                  <Card key={script.id} className="shadow-sm">
                    <CardContent className="p-4 !pt-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          段落 {((script.segment?.chapterOrderIndex ?? 0) + 1).toString()}
                        </Badge>
                        <Badge variant="outline">序号 {script.orderInSegment + 1}</Badge>
                        {script.character?.canonicalName ? (
                          <Badge variant="outline">{script.character.canonicalName}</Badge>
                        ) : null}
                        {script.tone ? <Badge variant="outline">{script.tone}</Badge> : null}
                      </div>
                      <p className="leading-7 text-foreground">{script.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audios" className="mt-4">
            {audios.length === 0 ? (
              <Card>
                <CardContent className="py-10 !pt-10 text-center text-muted-foreground">
                  <Music className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  暂无音频，请先生成章节音频。
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {audios.map((audio) => (
                  <Card key={audio.id} className="shadow-sm">
                    <CardContent className="p-4 !pt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {audio.type === "line" ? "单句音频" : "章节音频"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {audio.scriptSentence?.character?.canonicalName
                              ? `${audio.scriptSentence.character.canonicalName}：`
                              : ""}
                            {audio.scriptSentence?.text?.slice(0, 48) || "章节合并音频"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => window.open(audio.audioUrl, "_blank")}
                          aria-label="下载音频"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                      <audio controls className="w-full">
                        <source src={audio.audioUrl} type="audio/mpeg" />
                        当前浏览器不支持音频播放。
                      </audio>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
