"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, BookOpen, FolderOpen, Folder, FileText } from "lucide-react";
import { ChapterTreeNode, ScriptNavigationNode } from "./types";

interface DocumentTreeProps {
  bookId: string;
  bookTitle: string;
  bookStats: {
    totalChapters: number;
    totalSegments: number;
    scriptSegments: number;
    audioSegments: number;
  };
  chapters: ChapterTreeNode[];
  selectedNode: ScriptNavigationNode;
  onSelect: (node: ScriptNavigationNode) => void;
}

export function DocumentTree({
  bookId,
  bookTitle,
  bookStats,
  chapters,
  selectedNode,
  onSelect,
}: DocumentTreeProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Auto-expand chapter when segment is selected
  useEffect(() => {
    if (selectedNode.type === "segment") {
      // Find which chapter contains this segment
      for (const chapter of chapters) {
        if (chapter.segments.some(seg => seg.id === selectedNode.id)) {
          setExpandedChapters(prev => new Set(prev).add(chapter.id));
          break;
        }
      }
    }
  }, [selectedNode, chapters]);

  const toggleChapter = (chapterId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedChapters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-base">内容结构</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0 flex-1 overflow-y-auto">
        {/* Book Root Node */}
        <div
          onClick={() => onSelect({ type: "book", id: bookId })}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
            selectedNode.type === "book"
              ? "bg-blue-50 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">{bookTitle}</span>
          <Badge variant="outline" className="text-xs">
            {bookStats.totalChapters}
          </Badge>
        </div>

        {/* Chapters Tree */}
        <div className="ml-2">
          {chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.id);
            const isSelected = selectedNode.type === "chapter" && selectedNode.id === chapter.id;

            return (
              <div key={chapter.id}>
                {/* Chapter Node */}
                <div
                  onClick={() => onSelect({ type: "chapter", id: chapter.id })}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <button
                    onClick={(e) => toggleChapter(chapter.id, e)}
                    className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  ) : (
                    <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  )}
                  <span className="text-sm flex-1 truncate" title={chapter.title}>
                    {chapter.title}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {chapter.totalSegments}
                  </Badge>
                </div>

                {/* Segments under Chapter */}
                {isExpanded && (
                  <div className="ml-5 border-l border-gray-200">
                    {chapter.segments.map((segment) => {
                      const isSegmentSelected =
                        selectedNode.type === "segment" && selectedNode.id === segment.id;

                      return (
                        <div
                          key={segment.id}
                          onClick={() => onSelect({ type: "segment", id: segment.id })}
                          className={`flex items-center gap-2 pl-3 pr-2 py-1.5 cursor-pointer transition ${
                            isSegmentSelected
                              ? "bg-blue-50 text-blue-700"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                          <span className="text-xs flex-1 truncate" title={segment.label}>
                            {segment.label}
                          </span>
                          <div className="flex gap-1">
                            {segment.hasScript && (
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="已有台本" />
                            )}
                            {segment.hasAudio && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="已有音频" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {chapters.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-8 border border-dashed rounded-lg mt-4">
            暂无章节数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
