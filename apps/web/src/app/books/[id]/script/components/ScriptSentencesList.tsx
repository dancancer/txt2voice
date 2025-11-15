"use client";
import { useEffect, useMemo, useState } from "react";
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
}

export function ScriptSentencesList({
  bookId,
  scriptSentences,
  onEdit,
  onDelete,
  onAudioGenerated,
}: ScriptSentencesListProps) {
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil((scriptSentences?.length || 0) / PAGE_SIZE)
  );

  useEffect(() => {
    // Reset to first page when data changes or clamp if current page exceeds the last one
    setCurrentPage((prevPage) =>
      Math.min(prevPage, totalPages === 0 ? 1 : totalPages)
    );
  }, [totalPages, scriptSentences]);

  const paginatedSentences = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return scriptSentences.slice(startIndex, startIndex + PAGE_SIZE);
  }, [scriptSentences, currentPage]);

  const startItem = scriptSentences.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, scriptSentences.length);

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
        <CardTitle>台词列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paginatedSentences.map((sentence, index) => (
            <ScriptSentenceCard
              key={sentence.id}
              sentence={sentence}
              bookId={bookId}
              index={(currentPage - 1) * PAGE_SIZE + index}
              onEdit={onEdit}
              onDelete={onDelete}
              onAudioGenerated={onAudioGenerated}
            />
          ))}
        </div>

        {scriptSentences.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            暂无台词，请先生成台本。
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
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-600">
                第 {currentPage} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange("next")}
                disabled={currentPage === totalPages}
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
