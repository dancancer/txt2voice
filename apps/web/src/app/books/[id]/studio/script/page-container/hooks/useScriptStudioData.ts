// 一旦我被更新，请更新我的开头注释
// input: 书籍标识与数据依赖
// output: 台本工作台数据状态
// pos: 页面容器 Hook
"use client";

import { useCallback, useMemo, useState } from "react";
import { booksApi } from "@/lib/api";
import { getBookScripts, getBookSegments } from "@/lib/book-api";
import {
  isFetchInterruptedError,
  isRequestCanceled,
} from "@/lib/request-guards";
import { ScriptSentence } from "@/lib/types";
import type { CharacterProfileSummary } from "@/types/book";
import type {
  ChapterTreeNode,
  ScriptNavigationNode,
} from "../../components";

const SCRIPT_FETCH_PAGE_SIZE = 100;
const SEGMENT_FETCH_PAGE_SIZE = 200;

type SegmentModel = {
  id: string;
  chapterId?: string | null;
  segmentIndex?: number;
  chapterOrderIndex?: number | null;
  orderIndex?: number | null;
  content?: string;
  wordCount?: number | null;
};

type BookModel = {
  id: string;
  title: string;
  chapters?: Array<{
    id: string;
    title: string;
    chapterIndex?: number;
    status?: string;
  }>;
  characterProfiles?: CharacterProfileSummary[];
};

export function useScriptStudioData(bookId: string) {
  const [book, setBook] = useState<BookModel | null>(null);
  const [segments, setSegments] = useState<SegmentModel[]>([]);
  const [characters, setCharacters] = useState<CharacterProfileSummary[]>([]);
  const [scriptSentences, setScriptSentences] = useState<ScriptSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllScriptSentences = useCallback(async (signal?: AbortSignal) => {
    const sentences: ScriptSentence[] = [];
    let page = 1;

    while (true) {
      const result = await getBookScripts(bookId, {
        page,
        limit: SCRIPT_FETCH_PAGE_SIZE,
      }, { signal });

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

  const fetchAllSegments = useCallback(async (signal?: AbortSignal) => {
    const allSegments: SegmentModel[] = [];
    let page = 1;

    while (true) {
      const result = await getBookSegments(bookId, {
        page,
        limit: SEGMENT_FETCH_PAGE_SIZE,
      }, { signal });

      if (!result.success) {
        throw new Error("获取段落列表失败");
      }

      const pageData = (result.data?.data || []) as SegmentModel[];
      allSegments.push(...pageData);

      const pagination = result.data?.pagination;
      if (!pagination || page >= Math.max(1, pagination.totalPages)) {
        break;
      }

      page += 1;
    }

    return allSegments;
  }, [bookId]);

  const loadBookAndData = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) {
        return;
      }
      setLoading(true);
      setError(null);

      const [response, segmentsList, scripts] = await Promise.all([
        booksApi.getBook(bookId, ["characters", "chapters"], { signal }),
        fetchAllSegments(signal),
        fetchAllScriptSentences(signal),
      ]);

      if (signal?.aborted) {
        return;
      }
      setBook(response.data as BookModel);
      setSegments(segmentsList);
      setCharacters((response.data.characterProfiles || []) as CharacterProfileSummary[]);
      setScriptSentences(scripts);
    } catch (err) {
      if (isRequestCanceled(err, signal)) {
        return;
      }
      if (isFetchInterruptedError(err)) {
        setError("加载台本数据失败");
        return;
      }
      console.error("Failed to load book and script data:", err);
      setError("加载台本数据失败");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [bookId, fetchAllScriptSentences, fetchAllSegments]);

  const hasTextSegments = segments.length > 0;
  const hasScriptSentences = scriptSentences.length > 0;
  const hasCharacters = characters.some((character) => character.isActive);

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
    const map = new Map<string, SegmentModel[]>();
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
    if (!book) {
      return [];
    }

    const buildChapterNode = (
      chapter: {
        id: string;
        title: string;
        chapterIndex?: number;
        status?: string;
      },
      chapterSegments: SegmentModel[],
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
        segments: chapterSegments.map((segment, index) => {
          const labelOrder =
            segment.chapterOrderIndex ?? index ?? segment.segmentIndex ?? 0;
          const previewSource = segment.content || "";
          const preview = previewSource.replace(/\s+/g, " ").slice(0, 60).trim();

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
      (a, b) => (a.chapterIndex ?? 0) - (b.chapterIndex ?? 0)
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
  }, [audioSegments, book, segmentsByChapter, sentencesBySegment]);

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

  const bookStats = useMemo(
    () => ({
      totalChapters: chapterNodes.length,
      totalSegments: segments.length,
      scriptSegments: sentencesBySegment.size,
      audioSegments: audioSegments.size,
    }),
    [audioSegments.size, chapterNodes.length, segments.length, sentencesBySegment.size]
  );

  const getSelectedState = useCallback(
    (selectedNode: ScriptNavigationNode) => {
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

      return {
        selectedChapterNode,
        selectedSegment,
        selectedSegmentSentences,
        selectedSegmentMeta,
      };
    },
    [chapterNodes, segmentMetaMap, segments, sentencesBySegment, scriptSentences]
  );

  return {
    book,
    segments,
    characters,
    scriptSentences,
    loading,
    error,
    setScriptSentences,
    setCharacters,
    loadBookAndData,
    hasTextSegments,
    hasScriptSentences,
    hasCharacters,
    sentencesBySegment,
    chapterNodes,
    chapterSegmentIds,
    segmentMetaMap,
    bookStats,
    getSelectedState,
  };
}
