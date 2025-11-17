"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { getBookScripts, getBookSegments } from "@/lib/book-api";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptSentence, CharacterProfile } from "@/lib/types";
import {
  SegmentStatus,
  ScriptNavigationNode,
  ChapterTreeNode,
  GenerationProgress,
  EditSentenceModal,
  IncrementalProcessingModal,
  RegenerateSegmentsModal,
  DocumentTree,
  ChapterSegmentsTable,
  ScriptSentencesTable,
  ScriptPreviewModal,
} from "./components";

export default function ScriptGenerationPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const SCRIPT_FETCH_PAGE_SIZE = 100;
  const SEGMENT_FETCH_PAGE_SIZE = 200;
  const [book, setBook] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [scriptSentences, setScriptSentences] = useState<ScriptSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Script generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

  // Incremental processing state
  const [showIncrementalOptions, setShowIncrementalOptions] = useState(false);
  const [selectedStartSegment, setSelectedStartSegment] = useState<
    string | null
  >(null);
  const [segmentStatus, setSegmentStatus] = useState<SegmentStatus[]>([]);

  // Segment regeneration state
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentStatusLoading, setSegmentStatusLoading] = useState(false);

  // Script editing state
  const [editingSentence, setEditingSentence] = useState<ScriptSentence | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<ScriptNavigationNode>({
    type: "book",
    id: bookId,
  });
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  const fetchAllScriptSentences = useCallback(async () => {
    const sentences: ScriptSentence[] = [];
    let page = 1;

    while (true) {
      const result = await getBookScripts(bookId, {
        page,
        limit: SCRIPT_FETCH_PAGE_SIZE,
      });

      if (!result.success) {
        throw new Error("获取台词列表失败");
      }

      const pageData = (result.data?.data || []) as unknown as ScriptSentence[];
      sentences.push(...pageData);

      const pagination = result.data?.pagination;
      if (!pagination || page >= Math.max(1, pagination.totalPages)) {
        break;
      }

      page += 1;
    }

    return sentences;
  }, [bookId]);

  const fetchAllSegments = useCallback(async () => {
    const allSegments: any[] = [];
    let page = 1;

    while (true) {
      const result = await getBookSegments(bookId, {
        page,
        limit: SEGMENT_FETCH_PAGE_SIZE,
      });

      if (!result.success) {
        throw new Error("获取段落列表失败");
      }

      const pageData = result.data?.data || [];
      allSegments.push(...pageData);

      const pagination = result.data?.pagination;
      if (!pagination || page >= Math.max(1, pagination.totalPages)) {
        break;
      }

      page += 1;
    }

    return allSegments;
  }, [bookId]);

  const hasTextSegments = segments.length > 0;
  const hasScriptSentences = scriptSentences.length > 0;
  const hasCharacters = characters.filter((c) => c.isActive).length > 0;

  const sentencesBySegment = useMemo(() => {
    const map = new Map<string, ScriptSentence[]>();
    scriptSentences.forEach((sentence) => {
      if (!map.has(sentence.segmentId)) {
        map.set(sentence.segmentId, []);
      }
      map.get(sentence.segmentId)!.push(sentence);
    });
    return map;
  }, [scriptSentences]);

  const audioSegments = useMemo(() => {
    const set = new Set<string>();
    scriptSentences.forEach((sentence) => {
      const hasCompletedAudio = sentence.audioFiles?.some(
        (file) => file.status === "completed"
      );
      if (hasCompletedAudio) {
        set.add(sentence.segmentId);
      }
    });
    return set;
  }, [scriptSentences]);

  const segmentsByChapter = useMemo(() => {
    const map = new Map<string, any[]>();
    segments.forEach((segment) => {
      const key = segment.chapterId ?? "unassigned";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(segment);
    });

    map.forEach((list) => {
      list.sort((a, b) => {
        const orderA =
          (a.chapterOrderIndex ?? a.orderIndex ?? a.segmentIndex ?? 0) || 0;
        const orderB =
          (b.chapterOrderIndex ?? b.orderIndex ?? b.segmentIndex ?? 0) || 0;
        return orderA - orderB;
      });
    });

    return map;
  }, [segments]);

  const chapterNodes: ChapterTreeNode[] = useMemo(() => {
    if (!book) return [];

    const buildChapterNode = (
      chapter: {
        id: string;
        title: string;
        chapterIndex?: number;
        status?: string;
      },
      chapterSegments: any[],
      isVirtual = false
    ): ChapterTreeNode => {
      const scriptSegments = chapterSegments.filter(
        (segment) => (sentencesBySegment.get(segment.id)?.length || 0) > 0
      ).length;

      const audioSegmentsCount = chapterSegments.filter((segment) =>
        audioSegments.has(segment.id)
      ).length;

      return {
        id: chapter.id,
        title: chapter.title,
        chapterIndex: chapter.chapterIndex,
        status: chapter.status,
        isVirtual,
        totalSegments: chapterSegments.length,
        scriptSegments,
        audioSegments: audioSegmentsCount,
        segments: chapterSegments.map((segment: any, index: number) => {
          const labelOrder =
            segment.chapterOrderIndex ?? index ?? segment.segmentIndex ?? 0;
          const previewSource = segment.content || "";
          const preview = previewSource
            .replace(/\s+/g, " ")
            .slice(0, 60)
            .trim();
          return {
            id: segment.id,
            label: `段落 ${labelOrder + 1}`,
            hasScript: (sentencesBySegment.get(segment.id)?.length || 0) > 0,
            hasAudio: audioSegments.has(segment.id),
            preview: previewSource.length > 60 ? `${preview}…` : preview,
          };
        }),
      };
    };

    const orderedChapters = [...(book.chapters || [])].sort(
      (a: any, b: any) => (a.chapterIndex ?? 0) - (b.chapterIndex ?? 0)
    );

    const nodes = orderedChapters.map((chapter) =>
      buildChapterNode(chapter, segmentsByChapter.get(chapter.id) || [], false)
    );

    const unassignedSegments = segmentsByChapter.get("unassigned") || [];
    if (unassignedSegments.length > 0) {
      nodes.push(
        buildChapterNode(
          {
            id: "unassigned",
            title: "未归类章节",
            status: "pending",
          },
          unassignedSegments,
          true
        )
      );
    }

    return nodes;
  }, [book, segmentsByChapter, sentencesBySegment, audioSegments]);

  const chapterSegmentIds = useMemo(() => {
    const map = new Map<string, string[]>();
    chapterNodes.forEach((chapter) => {
      map.set(
        chapter.id,
        chapter.segments.map((segment) => segment.id)
      );
    });
    return map;
  }, [chapterNodes]);

  const segmentMetaMap = useMemo(() => {
    const map = new Map<
      string,
      { chapterId: string; chapterTitle: string; label: string }
    >();
    chapterNodes.forEach((chapter) => {
      chapter.segments.forEach((segment) => {
        map.set(segment.id, {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          label: segment.label,
        });
      });
    });
    return map;
  }, [chapterNodes]);

  useEffect(() => {
    setSelectedNode((prev) => {
      if (prev.type === "segment" && !segmentMetaMap.has(prev.id)) {
        return { type: "book", id: bookId };
      }
      if (
        prev.type === "chapter" &&
        !chapterNodes.some((chapter) => chapter.id === prev.id)
      ) {
        return { type: "book", id: bookId };
      }
      return prev;
    });
  }, [chapterNodes, segmentMetaMap, bookId]);

  const bookStats = useMemo(
    () => ({
      totalChapters: chapterNodes.length,
      totalSegments: segments.length,
      scriptSegments: sentencesBySegment.size,
      audioSegments: audioSegments.size,
    }),
    [chapterNodes, segments.length, sentencesBySegment, audioSegments]
  );

  const selectedChapterNode =
    selectedNode.type === "chapter"
      ? chapterNodes.find((chapter) => chapter.id === selectedNode.id) || null
      : null;

  const selectedSegment =
    selectedNode.type === "segment"
      ? segments.find((segment) => segment.id === selectedNode.id) || null
      : null;

  const selectedSegmentSentences =
    selectedNode.type === "segment"
      ? sentencesBySegment.get(selectedNode.id) || []
      : scriptSentences;

  const selectedSegmentMeta =
    selectedNode.type === "segment"
      ? segmentMetaMap.get(selectedNode.id)
      : undefined;

  const loadBookAndData = useCallback(async () => {
    try {
      setLoading(true);
      const [response, segmentsList, scripts] = await Promise.all([
        booksApi.getBook(bookId, ["characters", "chapters"]),
        fetchAllSegments(),
        fetchAllScriptSentences(),
      ]);
      setBook(response.data);
      setSegments(segmentsList);
      setCharacters(response.data.characterProfiles || []);
      setScriptSentences(scripts);
    } catch (err) {
      console.error("Failed to load book and script data:", err);
      setError("加载台本数据失败");
    } finally {
      setLoading(false);
    }
  }, [bookId, fetchAllScriptSentences, fetchAllSegments]);

  useEffect(() => {
    setSelectedNode({ type: "book", id: bookId });
  }, [bookId]);

  useEffect(() => {
    loadBookAndData();
  }, [bookId, loadBookAndData]);

  const generateScript = async () => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始生成台本...");

      if (!hasTextSegments) {
        alert("没有文本段落，请先处理文本");
        setIsGenerating(false);
        return;
      }

      if (segments.length === 0) {
        alert("没有可处理的文本段落");
        setIsGenerating(false);
        return;
      }

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          options: {
            includeNarration: true,
            emotionDetection: true,
            contextAnalysis: true,
            minDialogueLength: 5,
            maxDialogueLength: 200,
            preserveOriginalBreaks: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "生成失败");
      }

      setGenerationStatus("台本生成任务已启动！");

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus("台本生成完成！");
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus("台本生成失败");
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("台本生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus("获取状态失败");
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to generate script:", error);
      setGenerationStatus("台本生成失败");
      alert(
        `台本生成失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      setIsGenerating(false);
    }
  };

  const handleSentenceEdit = async (sentenceId: string, newText: string) => {
    try {
      console.log("Editing sentence:", sentenceId, newText);
      setEditingSentence(null);
      await loadBookAndData();
    } catch (error) {
      console.error("Failed to edit sentence:", error);
      alert("编辑句子失败");
    }
  };

  const handleSentenceDelete = async (sentenceId: string) => {
    if (confirm("确定要删除这句台词吗？")) {
      try {
        console.log("Deleting sentence:", sentenceId);
        await loadBookAndData();
      } catch (error) {
        console.error("Failed to delete sentence:", error);
        alert("删除句子失败");
      }
    }
  };

  const regenerateScript = async () => {
    if (confirm("重新生成台本将覆盖现有内容，确定要继续吗？")) {
      await generateScript();
    }
  };

  const loadSegmentStatus = async () => {
    try {
      setSegmentStatusLoading(true);
      const response = await fetch(
        `/api/books/${bookId}/script/generate?includeSegmentStatus=true`
      );
      if (!response.ok) throw new Error("Failed to load segment status");

      const result = await response.json();
      setSegmentStatus(result.data.segments.items || []);
    } catch (error) {
      console.error("Failed to load segment status:", error);
      alert("加载段落状态失败");
    } finally {
      setSegmentStatusLoading(false);
    }
  };

  const handleIncrementalProcessing = async (startSegmentId: string) => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始增量生成台本...");

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startFromSegmentId: startSegmentId,
          options: {
            includeNarration: true,
            emotionDetection: true,
            contextAnalysis: true,
            minDialogueLength: 5,
            maxDialogueLength: 200,
            preserveOriginalBreaks: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "增量生成失败");
      }

      setGenerationStatus("增量台本生成任务已启动！");
      setShowIncrementalOptions(false);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus("增量台本生成完成！");
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus("增量台本生成失败");
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("增量台本生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus("获取状态失败");
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to start incremental processing:", error);
      setGenerationStatus("增量台本生成失败");
      alert(
        `增量台本生成失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      setIsGenerating(false);
    }
  };

  const handleSegmentRegeneration = async (
    segmentIds: string[],
    contextLabel?: string
  ) => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus(
        contextLabel ? `${contextLabel}任务启动...` : "开始重新生成段落台本..."
      );

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segmentIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "段落重新生成失败");
      }

      setGenerationStatus(
        contextLabel
          ? `${contextLabel}任务已启动！`
          : "段落重新生成任务已启动！"
      );
      setShowRegenerateOptions(false);
      setSelectedSegments([]);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus(
              contextLabel ? `${contextLabel}完成！` : "段落重新生成完成！"
            );
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus(
              contextLabel ? `${contextLabel}失败` : "段落重新生成失败"
            );
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("段落重新生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus(
            contextLabel ? `${contextLabel}失败` : "获取状态失败"
          );
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to start segment regeneration:", error);
      setGenerationStatus(
        contextLabel ? `${contextLabel}失败` : "段落重新生成失败"
      );
      alert(
        `段落重新生成失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      setIsGenerating(false);
    }
  };

  const getSentenceIdsForSegment = useCallback(
    (segmentId: string) =>
      (sentencesBySegment.get(segmentId) || []).map((sentence) => sentence.id),
    [sentencesBySegment]
  );

  const getSentenceIdsForChapter = useCallback(
    (chapterId: string) => {
      const segmentIds = chapterSegmentIds.get(chapterId) || [];
      return segmentIds.flatMap((segmentId) =>
        (sentencesBySegment.get(segmentId) || []).map((sentence) => sentence.id)
      );
    },
    [chapterSegmentIds, sentencesBySegment]
  );

  const handleScopeScriptGeneration = async (
    scope: "book" | "chapter" | "segment",
    targetId?: string
  ) => {
    if (scope === "book") {
      await generateScript();
      return;
    }

    if (!targetId) return;

    const segmentIds =
      scope === "chapter" ? chapterSegmentIds.get(targetId) || [] : [targetId];
    if (segmentIds.length === 0) {
      alert(scope === "chapter" ? "该章节暂无段落" : "未找到指定段落");
      return;
    }

    const confirmMessage =
      scope === "chapter"
        ? `确定要重新生成该章节下的 ${segmentIds.length} 个段落台本吗？`
        : "确定要重新生成该段落的台本吗？";
    if (!confirm(confirmMessage)) {
      return;
    }

    await handleSegmentRegeneration(
      segmentIds,
      scope === "chapter" ? "章节台本生成" : "段落台本生成"
    );
  };

  const handleScopeAudioGeneration = async (
    scope: "book" | "chapter" | "segment",
    targetId?: string
  ) => {
    try {
      if (scope === "book") {
        if (!hasScriptSentences) {
          alert("请先生成台本后再尝试生成音频");
          return;
        }

        if (!confirm("确定要为整本书生成音频吗？")) {
          return;
        }

        const response = await fetch(`/api/books/${bookId}/audio/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "book" }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error?.message || "音频生成失败");
        }

        alert("整书音频生成任务已启动");
        return;
      }

      if (!targetId) return;

      const sentenceIds =
        scope === "chapter"
          ? getSentenceIdsForChapter(targetId)
          : getSentenceIdsForSegment(targetId);

      if (sentenceIds.length === 0) {
        alert("没有可生成音频的台词");
        return;
      }

      const response = await fetch(`/api/books/${bookId}/audio/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type:
            scope === "chapter"
              ? "chapter"
              : sentenceIds.length === 1
              ? "single"
              : "batch",
          chapterId: scope === "chapter" ? targetId : undefined,
          scriptSentenceIds: scope === "segment" ? sentenceIds : undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error?.message || "音频生成失败");
      }

      alert(
        scope === "chapter"
          ? "章节音频生成任务已启动"
          : "段落音频生成任务已启动"
      );
    } catch (error) {
      console.error("Failed to start audio generation:", error);
      alert(
        error instanceof Error ? error.message : "音频生成失败，请稍后重试"
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "书籍不存在"}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
  }

  const titleAction = selectedChapterNode && (
    <div className="flex items-center gap-2">
      <Button
        onClick={() =>
          handleScopeScriptGeneration("chapter", selectedChapterNode.id)
        }
        disabled={isGenerating}
      >
        章节台本生成
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          handleScopeAudioGeneration("chapter", selectedChapterNode.id)
        }
        disabled={isGenerating || selectedChapterNode.scriptSegments === 0}
      >
        章节音频生成
      </Button>
    </div>
  );

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Progress Bar at Top */}
      {isGenerating && (
        <div className="flex-shrink-0">
          <GenerationProgress
            isGenerating={isGenerating}
            generationStatus={generationStatus}
            generationProgress={generationProgress}
            onShowPreview={() => setShowScriptPreview(true)}
          />
        </div>
      )}

      {/* Main Content Area - Full Height */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          {/* Left Sidebar - Document Tree with Scroll */}
          <div className="h-full overflow-hidden">
            <DocumentTree
              bookId={bookId}
              bookTitle={book.title}
              bookStats={bookStats}
              chapters={chapterNodes}
              selectedNode={selectedNode}
              onSelect={setSelectedNode}
            />
          </div>

          {/* Right Content - Table View with Scroll */}
          <div className="h-full overflow-auto">
            <div className="space-y-4 h-full ">
              {/* Chapter View - Show Segments Table */}
              {selectedNode.type === "chapter" && selectedChapterNode && (
                <>
                  <ChapterSegmentsTable
                    chapterTitle={selectedChapterNode.title}
                    titleAction={titleAction}
                    segments={selectedChapterNode.segments.map((seg) => {
                      const fullSegment = segments.find((s) => s.id === seg.id);
                      return {
                        id: seg.id,
                        orderIndex: fullSegment?.orderIndex ?? 0,
                        chapterOrderIndex: fullSegment?.chapterOrderIndex,
                        content: fullSegment?.content ?? "",
                        wordCount: fullSegment?.wordCount,
                        hasScript: seg.hasScript,
                        hasAudio: seg.hasAudio,
                      };
                    })}
                    onSegmentClick={(segmentId) =>
                      setSelectedNode({ type: "segment", id: segmentId })
                    }
                    onGenerateScript={(segmentId) =>
                      handleScopeScriptGeneration("segment", segmentId)
                    }
                    onGenerateAudio={(segmentId) =>
                      handleScopeAudioGeneration("segment", segmentId)
                    }
                  />
                </>
              )}

              {/* Segment View - Show Script Sentences Table */}
              {selectedNode.type === "segment" && selectedSegment && (
                <>
                  <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border sticky top-0 z-10">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedSegmentMeta
                          ? `${selectedSegmentMeta.chapterTitle} · ${selectedSegmentMeta.label}`
                          : `段落 #${selectedSegment.segmentIndex + 1}`}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        字数{" "}
                        {selectedSegment.wordCount ??
                          selectedSegment.content?.length ??
                          0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          handleScopeScriptGeneration(
                            "segment",
                            selectedSegment.id
                          )
                        }
                        disabled={isGenerating}
                      >
                        重生成台本
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleScopeAudioGeneration(
                            "segment",
                            selectedSegment.id
                          )
                        }
                        disabled={
                          isGenerating || selectedSegmentSentences.length === 0
                        }
                      >
                        生成语音
                      </Button>
                    </div>
                  </div>
                  <ScriptSentencesTable
                    segmentTitle={
                      selectedSegmentMeta?.label ??
                      `段落 #${selectedSegment.segmentIndex + 1}`
                    }
                    sentences={selectedSegmentSentences}
                    onEdit={setEditingSentence}
                    onDelete={handleSentenceDelete}
                    onGenerateAudio={(sentenceId) => {
                      handleScopeAudioGeneration("segment", selectedSegment.id);
                    }}
                  />
                </>
              )}

              {/* Book View - Show Instructions */}
              {selectedNode.type === "book" && (
                <div className="border border-dashed rounded-lg p-12 text-center bg-white">
                  <div className="max-w-md mx-auto">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      章节管理 & 台本生成
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      请在左侧选择一个章节查看段落列表，或选择段落查看台词详情。
                    </p>
                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        onClick={() => handleScopeScriptGeneration("book")}
                        disabled={isGenerating || !hasTextSegments}
                      >
                        全书台本生成
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleScopeAudioGeneration("book")}
                        disabled={isGenerating || !hasScriptSentences}
                      >
                        全书音频生成
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showScriptPreview && (
        <ScriptPreviewModal
          scriptSentences={scriptSentences}
          onClose={() => setShowScriptPreview(false)}
        />
      )}

      {editingSentence && (
        <EditSentenceModal
          sentence={editingSentence}
          onClose={() => setEditingSentence(null)}
          onSave={handleSentenceEdit}
        />
      )}

      {showIncrementalOptions && (
        <IncrementalProcessingModal
          segmentStatus={segmentStatus}
          selectedStartSegment={selectedStartSegment}
          isGenerating={isGenerating}
          segmentStatusLoading={segmentStatusLoading}
          onClose={() => setShowIncrementalOptions(false)}
          onSelectSegment={setSelectedStartSegment}
          onStartProcessing={handleIncrementalProcessing}
        />
      )}

      {showRegenerateOptions && (
        <RegenerateSegmentsModal
          segmentStatus={segmentStatus}
          selectedSegments={selectedSegments}
          isGenerating={isGenerating}
          segmentStatusLoading={segmentStatusLoading}
          onClose={() => setShowRegenerateOptions(false)}
          onToggleSegment={(segmentId) => {
            setSelectedSegments((prev) =>
              prev.includes(segmentId)
                ? prev.filter((id) => id !== segmentId)
                : [...prev, segmentId]
            );
          }}
          onSelectAllProcessed={() => {
            setSelectedSegments(
              segmentStatus.filter((s) => s.processed).map((s) => s.id)
            );
          }}
          onClearSelection={() => setSelectedSegments([])}
          onStartRegeneration={handleSegmentRegeneration}
        />
      )}
    </div>
  );
}
