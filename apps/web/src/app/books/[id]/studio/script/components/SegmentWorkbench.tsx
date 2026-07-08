// 一旦我被更新，请更新我的开头注释
// input: 段落/台词/角色/失败任务/动作
// output: 段级工作台
// pos: 页面组件
"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Headphones, Sparkles, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScriptSentence } from "@/lib/types";
import { ScriptSentencesTable } from "./ScriptSentencesTable";
import type { SegmentFailedReviewTaskLink } from "./types";
import type { CharacterProfileSummary } from "@/types/book";

interface SegmentWorkbenchProps {
  bookId: string;
  title: string;
  segment: {
    id: string;
    content?: string;
    wordCount?: number | null;
    segmentIndex?: number;
  };
  sentences: ScriptSentence[];
  characters: CharacterProfileSummary[];
  failedReviewTask?: SegmentFailedReviewTaskLink | null;
  onRegenerateScript: () => void;
  onGenerateAudio: () => void;
  onEditSentence: (sentence: ScriptSentence) => void;
  onDeleteSentence: (sentenceId: string) => void;
  onGenerateSentenceAudio: (sentenceId: string) => void;
}

const getSentenceAudioUrl = (sentence: ScriptSentence): string | null => {
  const completedAudio = sentence.audioFiles?.find(
    (audioFile) => audioFile.status === "completed"
  );

  return completedAudio?.id ? `/api/audio/${completedAudio.id}` : null;
};

export function SegmentWorkbench({
  bookId,
  title,
  segment,
  sentences,
  characters,
  failedReviewTask,
  onRegenerateScript,
  onGenerateAudio,
  onEditSentence,
  onDeleteSentence,
  onGenerateSentenceAudio,
}: SegmentWorkbenchProps) {
  const [previewSentenceId, setPreviewSentenceId] = useState<string | null>(null);

  const previewSentence = useMemo(
    () => sentences.find((sentence) => sentence.id === previewSentenceId) || null,
    [previewSentenceId, sentences]
  );
  const previewAudioUrl = previewSentence ? getSentenceAudioUrl(previewSentence) : null;
  const unassignedSentences = useMemo(
    () =>
      sentences.filter(
        (sentence) =>
          !sentence.characterId && !sentence.character?.id && sentence.roleType !== "narration"
      ),
    [sentences]
  );
  const audioReadyCount = useMemo(
    () =>
      sentences.filter((sentence) =>
        sentence.audioFiles?.some((audioFile) => audioFile.status === "completed")
      ).length,
    [sentences]
  );
  const activeCharacters = useMemo(
    () => characters.filter((character) => character.isActive !== false).length,
    [characters]
  );

  const handlePlayAudio = (sentence: ScriptSentence) => {
    setPreviewSentenceId(sentence.id);
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-lg border border-border bg-card px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{title}</Badge>
              <Badge variant="outline">字数 {segment.wordCount ?? segment.content?.length ?? 0}</Badge>
              <Badge variant="outline">台词 {sentences.length}</Badge>
              <Badge variant="outline">已生成音频 {audioReadyCount}</Badge>
              <Badge variant="outline">可用角色 {activeCharacters}</Badge>
              {unassignedSentences.length > 0 ? (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  未分配角色 {unassignedSentences.length}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                在这里查看段落原文、逐句试听、修订台词，并快速跳到角色配置处理未分配角色。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {failedReviewTask ? (
              <a
                href={failedReviewTask.reviewUrl}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-orange-300 px-3 text-sm font-medium text-orange-900 transition-colors hover:bg-orange-100"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                查看质检失败
              </a>
            ) : null}
            {unassignedSentences.length > 0 ? (
              <a
                href={`/books/${bookId}/characters`}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <UserCircle2 className="mr-2 h-4 w-4" />
                处理角色配置
              </a>
            ) : null}
            <Button onClick={onRegenerateScript}>
              <Sparkles className="mr-2 h-4 w-4" />
              重生成台本
            </Button>
            <Button variant="outline" onClick={onGenerateAudio} disabled={sentences.length === 0}>
              <Headphones className="mr-2 h-4 w-4" />
              生成语音
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">段落原文</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {segment.content?.trim() || "当前段落没有可展示的原文。"}
          </p>
        </CardContent>
      </Card>

      {previewSentence && previewAudioUrl ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">当前试听</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {previewSentence.character?.canonicalName
                  ? `${previewSentence.character.canonicalName}：`
                  : ""}
                {previewSentence.text}
              </p>
              <p className="text-xs text-muted-foreground">
                第 {previewSentence.orderInSegment + 1} 句
              </p>
            </div>
            <audio key={previewAudioUrl} controls className="w-full">
              <source src={previewAudioUrl} />
              当前浏览器不支持音频播放。
            </audio>
          </CardContent>
        </Card>
      ) : null}

      <ScriptSentencesTable
        segmentTitle={title}
        sentences={sentences}
        onEdit={onEditSentence}
        onDelete={onDeleteSentence}
        onPlayAudio={handlePlayAudio}
        onGenerateAudio={onGenerateSentenceAudio}
      />
    </div>
  );
}
