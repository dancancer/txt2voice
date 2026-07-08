// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
"use client";

import { useMemo, useState } from "react";
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
  const [manualExpandedChapters, setManualExpandedChapters] = useState<Set<string>>(new Set());
  const [autoCollapsedChapters, setAutoCollapsedChapters] = useState<Set<string>>(new Set());

  const autoExpandedChapterId = useMemo(() => {
    if (selectedNode.type !== "segment") {
      return null;
    }
    const chapter = chapters.find((chap) =>
      chap.segments.some((seg) => seg.id === selectedNode.id)
    );
    return chapter?.id ?? null;
  }, [selectedNode, chapters]);

  const toggleChapter = (
    chapterId: string,
    event: React.MouseEvent,
    options: { isManuallyExpanded: boolean; isAutoOnlyExpanded: boolean }
  ) => {
    event.stopPropagation();
    setManualExpandedChapters((prev) => {
      const next = new Set(prev);
      if (options.isManuallyExpanded) {
        next.delete(chapterId);
        return next;
      }
      if (options.isAutoOnlyExpanded) {
        return next;
      }
      next.add(chapterId);
      return next;
    });
    if (chapterId === autoExpandedChapterId) {
      setAutoCollapsedChapters((prev) => {
        const next = new Set(prev);
        if (options.isAutoOnlyExpanded) {
          next.add(chapterId);
        } else {
          next.delete(chapterId);
        }
        return next;
      });
    }
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
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
            const isManuallyExpanded = manualExpandedChapters.has(chapter.id);
            const isAutoExpanded =
              chapter.id === autoExpandedChapterId &&
              !autoCollapsedChapters.has(chapter.id);
            const isExpanded = isManuallyExpanded || isAutoExpanded;
            const isAutoOnlyExpanded = !isManuallyExpanded && isAutoExpanded;
            const isSelected = selectedNode.type === "chapter" && selectedNode.id === chapter.id;

            return (
              <div key={chapter.id}>
                {/* Chapter Node */}
                <div
                  onClick={() => onSelect({ type: "chapter", id: chapter.id })}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition ${
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <button
                    onClick={(e) =>
                      toggleChapter(chapter.id, e, {
                        isManuallyExpanded,
                        isAutoOnlyExpanded,
                      })
                    }
                    className="rounded p-0.5 transition-colors hover:bg-accent"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
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
                  <div className="ml-5 border-l border-border">
                    {chapter.segments.map((segment) => {
                      const isSegmentSelected =
                        selectedNode.type === "segment" && selectedNode.id === segment.id;

                      return (
                        <div
                          key={segment.id}
                          onClick={() => onSelect({ type: "segment", id: segment.id })}
                          className={`flex items-center gap-2 pl-3 pr-2 py-1.5 cursor-pointer transition ${
                            isSegmentSelected
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="text-xs flex-1 truncate" title={segment.label}>
                            {segment.label}
                          </span>
                          <div className="flex gap-1">
                            {segment.hasScript && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" title="已有台本" />
                            )}
                            {segment.hasAudio && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" title="已有音频" />
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
          <div className="mt-4 rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            暂无章节数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
