// 一旦我被更新，请更新我的开头注释
// input: 侧栏展示参数
// output: 播放页信息与快捷操作
// pos: 页面组件
"use client";

import { FileText, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AudioFile, PlaybackBook } from "../models";
import { formatFileSize, formatTime } from "../models";

interface PlaybackSidebarProps {
  book: PlaybackBook;
  audioFiles: AudioFile[];
  totalDuration: number;
  totalFileSize: number;
  onGoGenerate: () => void;
  onGoBook: () => void;
  onGoCharacters: () => void;
}

export function PlaybackSidebar({
  book,
  audioFiles,
  totalDuration,
  totalFileSize,
  onGoGenerate,
  onGoBook,
  onGoCharacters,
}: PlaybackSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>书籍信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h3 className="mb-1 font-semibold text-foreground">{book.title}</h3>
              {book.author && <p className="text-sm text-muted-foreground">作者：{book.author}</p>}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">总时长</span>
              <span className="font-medium text-foreground">{totalDuration > 0 ? formatTime(totalDuration) : "--:--"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">文件数量</span>
              <span className="font-medium text-foreground">{audioFiles.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">总大小</span>
              <span className="font-medium text-foreground">{formatFileSize(totalFileSize)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full min-h-11" onClick={onGoGenerate}>
            <Settings className="mr-2 h-4 w-4" />
            重新生成
          </Button>
          <Button variant="outline" className="w-full min-h-11" onClick={onGoBook}>
            <FileText className="mr-2 h-4 w-4" />
            返回书籍
          </Button>
          <Button variant="outline" className="w-full min-h-11" onClick={onGoCharacters}>
            <User className="mr-2 h-4 w-4" />
            角色配置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>快捷键</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">播放/暂停</span>
              <kbd className="rounded bg-muted px-2 py-1 text-foreground">Space</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">上一首</span>
              <kbd className="rounded bg-muted px-2 py-1 text-foreground">←</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">下一首</span>
              <kbd className="rounded bg-muted px-2 py-1 text-foreground">→</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">静音</span>
              <kbd className="rounded bg-muted px-2 py-1 text-foreground">M</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
