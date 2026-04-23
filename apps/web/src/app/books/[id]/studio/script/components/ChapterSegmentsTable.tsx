// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
"use client";

import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Play, Eye } from "lucide-react";
import type { SegmentFailedReviewTaskLink } from "./types";

export interface ChapterSegmentRow {
  id: string;
  orderIndex: number;
  chapterOrderIndex?: number;
  content: string;
  wordCount?: number;
  hasScript: boolean;
  hasAudio: boolean;
}

export type ChapterSegmentsTableTitleAction = ReactNode;

interface ChapterSegmentsTableProps {
  chapterTitle: string;
  segments: ChapterSegmentRow[];
  failedReviewTaskBySegment?: Map<string, SegmentFailedReviewTaskLink>;
  titleAction: ChapterSegmentsTableTitleAction;
  onSegmentClick: (segmentId: string) => void;
  onGenerateScript?: (segmentId: string) => void;
  onGenerateAudio?: (segmentId: string) => void;
}

export function ChapterSegmentsTable({
  chapterTitle,
  titleAction,
  segments,
  failedReviewTaskBySegment,
  onSegmentClick,
  onGenerateScript,
  onGenerateAudio,
}: ChapterSegmentsTableProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = (segmentId: string) => {
    setExpandedSegments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="flex border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">{chapterTitle}</h2>
        <p className="ml-2 mt-1 text-sm text-muted-foreground">
          共 {segments.length} 个段落
        </p>
        <div className="flex-1"></div>
        {titleAction}
      </div>

      <div className="overflow-x-auto flex-1 min-h-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">序号</TableHead>
              <TableHead>内容</TableHead>
              <TableHead className="w-24">字数</TableHead>
              <TableHead className="w-56">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  该章节暂无段落
                </TableCell>
              </TableRow>
            ) : (
              segments.map((segment, index) => {
                const isExpanded = expandedSegments.has(segment.id);
                const failedReviewTask =
                  failedReviewTaskBySegment?.get(segment.id) || null;
                return (
                  <TableRow key={segment.id} className="hover:bg-muted/60">
                    <TableCell className="font-medium align-top">
                      {segment.chapterOrderIndex !== undefined
                        ? segment.chapterOrderIndex + 1
                        : index + 1}
                    </TableCell>
                    <TableCell
                      onClick={() => toggleExpanded(segment.id)}
                      className="cursor-pointer"
                    >
                      <div className="max-w-3xl">
                        {isExpanded ? (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {segment.content || "无内容"}
                          </p>
                        ) : (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {segment.content || "无内容"}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="text-sm text-muted-foreground">
                        {segment.wordCount || segment.content?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 未生成台本时显示生成按钮 */}
                        {!segment.hasScript && onGenerateScript && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onGenerateScript(segment.id)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            生成台本
                          </Button>
                        )}

                        {/* 已生成台本时显示查看按钮 */}
                        {segment.hasScript && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onSegmentClick(segment.id)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            查看台本
                          </Button>
                        )}

                        {/* 已生成台本但未生成音频时显示生成音频按钮 */}
                        {segment.hasScript &&
                          !segment.hasAudio &&
                          onGenerateAudio && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onGenerateAudio(segment.id)}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              生成音频
                            </Button>
                          )}

                        {/* 已生成音频时显示查看音频按钮 */}
                        {segment.hasAudio && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSegmentClick(segment.id)}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            查看音频
                          </Button>
                        )}

                        {failedReviewTask ? (
                          <a
                            href={failedReviewTask.reviewUrl}
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            查看质检失败
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
