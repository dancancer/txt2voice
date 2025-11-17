"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChapterTreeNode } from "./types";
import { Layers, Combine } from "lucide-react";

interface ChapterDetailPanelProps {
  chapter: ChapterTreeNode;
  onGenerateScript: () => void;
  onGenerateAudio: () => void;
  onMergeAudio?: () => void;
  onSelectSegment: (segmentId: string) => void;
}

export function ChapterDetailPanel({
  chapter,
  onGenerateScript,
  onGenerateAudio,
  onMergeAudio,
  onSelectSegment,
}: ChapterDetailPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg">
            {chapter.title}
            {chapter.chapterIndex !== undefined && (
              <span className="text-sm text-gray-500 ml-2">
                #{chapter.chapterIndex}
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            段落 {chapter.totalSegments} · 台本 {chapter.scriptSegments} · 音频{" "}
            {chapter.audioSegments}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onGenerateScript} size="sm">
            章节台本生成
          </Button>
          <Button
            onClick={onGenerateAudio}
            size="sm"
            variant="outline"
            disabled={chapter.scriptSegments === 0}
          >
            章节音频生成
          </Button>
          {onMergeAudio && (
            <Button
              onClick={onMergeAudio}
              size="sm"
              variant="secondary"
              disabled={chapter.audioSegments === 0}
            >
              <Combine className="w-4 h-4 mr-2" />
              合并音频
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chapter.segments.length === 0 ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500 py-6">
            <Layers className="w-4 h-4" />
            <span>该章节暂无段落，请先完成章节分段。</span>
          </div>
        ) : (
          <div className="space-y-2">
            {chapter.segments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => onSelectSegment(segment.id)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50/50 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{segment.label}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {segment.preview}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={segment.hasScript ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      台本
                    </Badge>
                    <Badge
                      variant={segment.hasAudio ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      音频
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
