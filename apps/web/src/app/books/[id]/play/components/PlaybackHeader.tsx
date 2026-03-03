// 一旦我被更新，请更新我的开头注释
// input: 头部展示参数
// output: 播放页顶部导航
// pos: 页面组件
"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlaybackHeaderProps {
  bookTitle: string;
  audioCount: number;
  showPlaylist: boolean;
  onBack: () => void;
  onTogglePlaylist: () => void;
}

export function PlaybackHeader({
  bookTitle,
  audioCount,
  showPlaylist,
  onBack,
  onTogglePlaylist,
}: PlaybackHeaderProps) {
  return (
    <div className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex w-full min-w-0 items-center">
            <Button variant="ghost" size="sm" onClick={onBack} className="mr-3 min-h-11 min-w-11 sm:mr-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">音频播放</h1>
              <p className="text-sm text-gray-500 truncate">{bookTitle}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <Badge variant="secondary" className="whitespace-nowrap">{audioCount} 个音频文件</Badge>
            <Button variant="outline" onClick={onTogglePlaylist} className="min-h-11">
              <FileText className="mr-2 h-4 w-4" />
              {showPlaylist ? "隐藏" : "显示"}列表
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
