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

interface SegmentData {
  id: string;
  orderIndex: number;
  chapterOrderIndex?: number;
  content: string;
  wordCount?: number;
  hasScript: boolean;
  hasAudio: boolean;
}

interface ChapterSegmentsTableProps {
  chapterTitle: string;
  segments: SegmentData[];
  titleAction: ReactNode;
  onSegmentClick: (segmentId: string) => void;
  onGenerateScript?: (segmentId: string) => void;
  onGenerateAudio?: (segmentId: string) => void;
}

export function ChapterSegmentsTable({
  chapterTitle,
  titleAction,
  segments,
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
    <div className="border rounded-lg bg-white h-full flex flex-col">
      <div className="px-6 py-4 border-b flex ">
        <h2 className="text-lg font-semibold">{chapterTitle}</h2>
        <p className="ml-2 text-sm text-gray-500 mt-1">
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
                  className="text-center py-8 text-gray-500"
                >
                  该章节暂无段落
                </TableCell>
              </TableRow>
            ) : (
              segments.map((segment, index) => {
                const isExpanded = expandedSegments.has(segment.id);
                return (
                  <TableRow key={segment.id} className="hover:bg-gray-50">
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
                          <p className="text-sm line-clamp-2 text-gray-700">
                            {segment.content || "无内容"}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="text-sm text-gray-600">
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
