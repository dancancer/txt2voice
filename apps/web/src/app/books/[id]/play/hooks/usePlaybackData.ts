// 一旦我被更新，请更新我的开头注释
// input: 书籍标识与 API 依赖
// output: 播放页数据状态
// pos: 页面 Hook
"use client";

import { useCallback, useEffect, useState } from "react";
import { booksApi } from "@/lib/api";
import {
  isFetchInterruptedError,
  isRequestCanceled,
} from "@/lib/request-guards";
import type { AudioFile, PlaybackBook } from "../models";

const normalizeAudioFiles = (book: PlaybackBook): AudioFile[] => {
  return (book.audioFiles || []).map((file: any) => ({
    ...file,
    scriptSentence: file.scriptSentence,
    character: file.scriptSentence?.character
      ? {
          canonicalName: file.scriptSentence.character.canonicalName,
        }
      : undefined,
  }));
};

export function usePlaybackData(bookId: string) {
  const [book, setBook] = useState<PlaybackBook | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) {
        return;
      }
      setLoading(true);
      setError(null);

      const response = await booksApi.getBook(bookId, ["audioFiles"], { signal });
      if (signal?.aborted) {
        return;
      }
      const nextBook = response.data as PlaybackBook;
      setBook(nextBook);
      setAudioFiles(normalizeAudioFiles(nextBook));
    } catch (err) {
      if (isRequestCanceled(err, signal) || isFetchInterruptedError(err)) {
        return;
      }
      console.error("Failed to load book and audio files:", err);
      setError("加载音频文件失败");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [bookId]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  return {
    book,
    audioFiles,
    loading,
    error,
    reload: () => reload(),
  };
}
