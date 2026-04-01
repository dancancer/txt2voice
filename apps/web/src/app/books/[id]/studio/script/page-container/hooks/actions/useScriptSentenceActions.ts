// 一旦我被更新，请更新我的开头注释
// input: 台词操作依赖与状态 setter
// output: 台词编辑/删除/音频动作
// pos: 页面容器 Hook
"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { updateScriptSentences } from "@/lib/book-api";
import { ScriptSentence } from "@/lib/types";
import type { CharacterProfileSummary } from "@/types/book";
import type { Dispatch, SetStateAction } from "react";
import type { ConfirmDialogConfig } from "../useConfirmDialog";

type UseScriptSentenceActionsParams = {
  bookId: string;
  characters: CharacterProfileSummary[];
  scriptSentences: ScriptSentence[];
  setScriptSentences: Dispatch<SetStateAction<ScriptSentence[]>>;
  setEditingSentence: Dispatch<SetStateAction<ScriptSentence | null>>;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
};

export function useScriptSentenceActions({
  bookId,
  characters,
  scriptSentences,
  setScriptSentences,
  setEditingSentence,
  requestConfirmation,
}: UseScriptSentenceActionsParams) {
  const handleSentenceEdit = useCallback(
    async (
      sentenceId: string,
      updates: {
        text: string;
        tone?: string;
        characterId?: string | null;
        rawSpeaker?: string | null;
        roleType?: string;
      }
    ) => {
      try {
        const payload = {
          id: sentenceId,
          text: updates.text,
          tone: updates.tone,
          characterId: updates.characterId ?? null,
          rawSpeaker: updates.rawSpeaker,
          roleType: updates.roleType,
        };

        await updateScriptSentences(bookId, [payload]);

        const selectedCharacter = characters.find(
          (character) => character.id === payload.characterId
        );
        const nextCharacter = payload.characterId
          ? ({
              id: payload.characterId,
              canonicalName: selectedCharacter?.canonicalName || "未知角色",
            } as ScriptSentence["character"])
          : null;

        setScriptSentences((prev) =>
          prev.map((sentence) =>
            sentence.id === sentenceId
              ? {
                  ...sentence,
                  text: payload.text,
                  tone: payload.tone ?? undefined,
                  characterId: payload.characterId ?? null,
                  rawSpeaker: payload.rawSpeaker ?? undefined,
                  roleType: payload.roleType ?? sentence.roleType,
                  character: nextCharacter,
                }
              : sentence
          )
        );

        setEditingSentence(null);
      } catch (error) {
        console.error("Failed to edit sentence:", error);
        toast.error("编辑句子失败");
      }
    },
    [bookId, characters, setEditingSentence, setScriptSentences]
  );

  const handleSentenceDelete = useCallback(
    async (sentenceId: string) => {
      const confirmed = await requestConfirmation({
        title: "删除台词",
        description: "确定要删除这句台词吗？该操作无法撤销。",
        confirmText: "删除",
        destructive: true,
      });
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `/api/books/${bookId}/scripts?ids=${encodeURIComponent(sentenceId)}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error?.message || "删除句子失败");
        }

        setScriptSentences((prev) =>
          prev.filter((sentence) => sentence.id !== sentenceId)
        );
        toast.success("台词已删除");
      } catch (error) {
        console.error("Failed to delete sentence:", error);
        toast.error(error instanceof Error ? error.message : "删除句子失败");
      }
    },
    [bookId, requestConfirmation, setScriptSentences]
  );

  const handleSentenceAudioGeneration = useCallback(
    async (sentenceId: string) => {
      try {
        const targetSentence = scriptSentences.find(
          (sentence) => sentence.id === sentenceId
        );
        const hasCharacter =
          targetSentence?.characterId || targetSentence?.character?.id;

        if (!hasCharacter) {
          toast.error("请先为台词分配角色");
          return;
        }

        const response = await fetch(`/api/books/${bookId}/audio/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "single",
            scriptSentenceIds: [sentenceId],
          }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error?.message || "音频生成失败");
        }

        toast.success("单句音频生成任务已启动");
      } catch (error) {
        console.error("Failed to generate sentence audio:", error);
        toast.error(
          error instanceof Error ? error.message : "音频生成失败，请稍后重试"
        );
      }
    },
    [bookId, scriptSentences]
  );

  return {
    handleSentenceEdit,
    handleSentenceDelete,
    handleSentenceAudioGeneration,
  };
}
