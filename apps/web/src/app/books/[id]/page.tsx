// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { booksApi } from "@/lib/api";
import { getBookStatusMeta } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
  UserCircle,
  Music,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import { buildScriptStudioHref } from "./studio/script/page-container/node-query";

type ChapterSummary = {
  id: string;
  chapterIndex: number;
  title: string;
  status: string;
  totalSegments: number;
  wordCount?: number | null;
  characterCount?: number | null;
  counts: {
    segments: number;
    scripts: number;
    audioFiles: number;
  };
  preview?: string;
};

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  const loadBookData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [bookResponse, chaptersResponse] = await Promise.all([
        booksApi.getBook(bookId),
        fetch(`/api/books/${bookId}/chapters`),
      ]);

      if (!chaptersResponse.ok) {
        throw new Error("加载章节失败");
      }

      const chaptersResult = await chaptersResponse.json();
      setBook(bookResponse.data);
      setChapters(chaptersResult.data || []);
    } catch (err) {
      console.error("Failed to load book detail:", err);
      setError(err instanceof Error ? err.message : "加载书籍详情失败");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBookData();
  }, [loadBookData]);

  const handleGenerateScript = async () => {
    try {
      setGeneratingScript(true);
      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          options: {
            includeNarration: true,
            emotionDetection: true,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error?.message || "启动台本生成失败");
      }

      toast.success("台本生成任务已启动，请在任务中心查看进度");
      await loadBookData();
    } catch (err) {
      console.error("Failed to generate scripts:", err);
      toast.error(err instanceof Error ? err.message : "启动台本生成失败");
    } finally {
      setGeneratingScript(false);
    }
  };

  const counts = {
    segments: book?.counts?.segments ?? 0,
    chapters: book?.counts?.chapters ?? 0,
    scripts: book?.counts?.scripts ?? 0,
    characters: book?.counts?.characters ?? 0,
    audioFiles: book?.counts?.audioFiles ?? 0,
  };

  const statusMeta = useMemo(
    () => (book ? getBookStatusMeta(book.status) : null),
    [book]
  );

  const chapterCompletion =
    counts.chapters > 0
      ? Math.round((chapters.filter((chapter) => chapter.counts.scripts > 0).length / counts.chapters) * 100)
      : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book || !statusMeta) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="mb-4 text-destructive">{error || "书籍不存在"}</p>
          <Button onClick={() => router.push("/")}>返回书籍管理</Button>
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
              onClick={() => router.push("/")}
              className="min-h-11 min-w-11 px-2 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回书籍管理
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                {book.title}
              </h1>
              <p className="text-muted-foreground leading-7">
                {book.author ? `作者：${book.author}` : "未填写作者信息"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
              <Badge variant="outline">{counts.chapters} 章节</Badge>
              <Badge variant="outline">{counts.segments} 段落</Badge>
              <Badge variant="outline">{counts.audioFiles} 音频</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(`/books/${bookId}/characters`)}
            >
              <UserCircle className="w-4 h-4 mr-2" />
              角色配置
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(buildScriptStudioHref(bookId))}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              高级台本
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(`/books/${bookId}/studio/audio`)}
            >
              <Music className="w-4 h-4 mr-2" />
              高级音频
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(`/books/${bookId}/review`)}
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              质检复核
            </Button>
            <Button className="min-h-11" onClick={handleGenerateScript} disabled={generatingScript || counts.segments === 0}>
              {generatingScript ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  启动中...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  全书生成台本
                </>
              )}
            </Button>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">流程进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>章节台本覆盖率</span>
              <span className="font-medium text-foreground">{chapterCompletion}%</span>
            </div>
            <Progress value={chapterCompletion} />
            <p className="text-sm text-muted-foreground leading-6">
              建议先进入高级台本工作台检查章节与段落状态，再按章节批量生成音频。
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="chapters" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="chapters" className="min-h-11">章节列表</TabsTrigger>
            <TabsTrigger value="info" className="min-h-11">基本信息</TabsTrigger>
          </TabsList>

          <TabsContent value="chapters" className="mt-4">
            {chapters.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 !pt-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  当前还没有章节，请先完成文本处理。
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        buildScriptStudioHref(bookId, {
                          type: "chapter",
                          id: chapter.id,
                        })
                      )
                    }
                    className="cursor-pointer rounded-lg border border-border bg-card p-4 text-left transition-colors duration-200 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">第 {chapter.chapterIndex + 1} 章</p>
                        <h3 className="mt-1 line-clamp-1 text-base font-medium text-foreground">{chapter.title}</h3>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{chapter.preview || "暂无预览"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">段落 {chapter.counts.segments}</Badge>
                      <Badge variant="outline">台本 {chapter.counts.scripts}</Badge>
                      <Badge variant="outline">音频 {chapter.counts.audioFiles}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-6 !pt-6 space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">书名</p>
                  <p className="mt-1 text-foreground">{book.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">作者</p>
                  <p className="mt-1 text-foreground">{book.author || "未填写"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">源文件</p>
                  <p className="mt-1 text-foreground">{book.originalFilename || "尚未上传"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="mt-1 text-foreground">{new Date(book.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">更新时间</p>
                  <p className="mt-1 text-foreground">{new Date(book.updatedAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
