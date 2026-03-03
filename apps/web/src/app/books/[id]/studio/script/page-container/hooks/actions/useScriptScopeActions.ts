// 一旦我被更新，请更新我的开头注释
// input: 作用域生成依赖与映射数据
// output: 书籍/章节/段落级生成动作
// pos: 页面容器 Hook
"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { ScriptSentence } from "@/lib/types";
import type { ConfirmDialogConfig } from "../useConfirmDialog";

type Scope = "book" | "chapter" | "segment";

type UseScriptScopeActionsParams = {
  bookId: string;
  hasScriptSentences: boolean;
  chapterSegmentIds: Map<string, string[]>;
  sentencesBySegment: Map<string, ScriptSentence[]>;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  generateScript: () => Promise<void>;
  handleSegmentRegeneration: (segmentIds: string[], contextLabel?: string) => Promise<void>;
};

export function useScriptScopeActions({
  bookId,
  hasScriptSentences,
  chapterSegmentIds,
  sentencesBySegment,
  requestConfirmation,
  generateScript,
  handleSegmentRegeneration,
}: UseScriptScopeActionsParams) {
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

  const handleScopeScriptGeneration = useCallback(
    async (scope: Scope, targetId?: string) => {
      if (scope === "book") {
        await generateScript();
        return;
      }

      if (!targetId) {
        return;
      }

      const segmentIds =
        scope === "chapter" ? chapterSegmentIds.get(targetId) || [] : [targetId];
      if (segmentIds.length === 0) {
        toast.info(scope === "chapter" ? "该章节暂无段落" : "未找到指定段落");
        return;
      }

      const confirmMessage =
        scope === "chapter"
          ? `确定要重新生成该章节下的 ${segmentIds.length} 个段落台本吗？`
          : "确定要重新生成该段落的台本吗？";
      const confirmed = await requestConfirmation({
        title: scope === "chapter" ? "章节台本生成" : "段落台本生成",
        description: confirmMessage,
        confirmText: "开始生成",
        destructive: true,
      });
      if (!confirmed) {
        return;
      }

      await handleSegmentRegeneration(
        segmentIds,
        scope === "chapter" ? "章节台本生成" : "段落台本生成"
      );
    },
    [chapterSegmentIds, generateScript, handleSegmentRegeneration, requestConfirmation]
  );

  const handleScopeAudioGeneration = useCallback(
    async (scope: Scope, targetId?: string) => {
      try {
        if (scope === "book") {
          if (!hasScriptSentences) {
            toast.error("请先生成台本后再尝试生成音频");
            return;
          }

          const confirmed = await requestConfirmation({
            title: "全书音频生成",
            description: "确定要为整本书生成音频吗？",
            confirmText: "开始生成",
          });
          if (!confirmed) {
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

          toast.success("整书音频生成任务已启动");
          return;
        }

        if (!targetId) {
          return;
        }

        const sentenceIds =
          scope === "chapter"
            ? getSentenceIdsForChapter(targetId)
            : getSentenceIdsForSegment(targetId);

        if (sentenceIds.length === 0) {
          toast.info("没有可生成音频的台词");
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

        toast.success(
          scope === "chapter" ? "章节音频生成任务已启动" : "段落音频生成任务已启动"
        );
      } catch (error) {
        console.error("Failed to start audio generation:", error);
        toast.error(
          error instanceof Error ? error.message : "音频生成失败，请稍后重试"
        );
      }
    },
    [
      bookId,
      getSentenceIdsForChapter,
      getSentenceIdsForSegment,
      hasScriptSentences,
      requestConfirmation,
    ]
  );

  return {
    handleScopeScriptGeneration,
    handleScopeAudioGeneration,
  };
}
