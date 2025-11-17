"use client";
import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScriptSentence } from "@/lib/types";
import { ScriptSentenceCard } from "./ScriptSentenceCard";

interface ScriptSentencesListProps {
  bookId: string;
  scriptSentences: ScriptSentence[];
  onEdit: (sentence: ScriptSentence) => void;
  onDelete: (sentenceId: string) => void;
  onAudioGenerated: (
    sentenceId: string,
    audio: { audioFileId?: string; playbackUrl?: string }
  ) => void;
  title?: string;
  emptyMessage?: string;
}

export function ScriptSentencesList({
  bookId,
  scriptSentences,
  onEdit,
  onDelete,
  onAudioGenerated,
  title,
  emptyMessage,
}: ScriptSentencesListProps) {
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil((scriptSentences?.length || 0) / PAGE_SIZE)
  );

  const effectivePage = Math.min(currentPage, totalPages || 1);

  const paginatedSentences = useMemo(() => {
    const startIndex = (effectivePage - 1) * PAGE_SIZE;
    return scriptSentences.slice(startIndex, startIndex + PAGE_SIZE);
  }, [scriptSentences, effectivePage]);

  const startItem =
    scriptSentences.length === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(effectivePage * PAGE_SIZE, scriptSentences.length);

  const handlePageChange = (direction: "prev" | "next") => {
    setCurrentPage((prev) => {
      if (direction === "prev") {
        return Math.max(1, prev - 1);
      }
      return Math.min(totalPages, prev + 1);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || "台词列表"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paginatedSentences.map((sentence, index) => (
            <ScriptSentenceCard
              key={sentence.id}
              sentence={sentence}
              bookId={bookId}
              index={(effectivePage - 1) * PAGE_SIZE + index}
              onEdit={onEdit}
              onDelete={onDelete}
              onAudioGenerated={onAudioGenerated}
            />
          ))}
        </div>

        {scriptSentences.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            {emptyMessage || "暂无台词，请先生成台本。"}
          </div>
        )}

        {scriptSentences.length > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-gray-600">
              显示第 {startItem}-{endItem} 句，共 {scriptSentences.length} 句
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange("prev")}
                disabled={effectivePage === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-600">
                第 {effectivePage} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange("next")}
                disabled={effectivePage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
