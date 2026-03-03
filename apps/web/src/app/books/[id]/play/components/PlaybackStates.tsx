// 一旦我被更新，请更新我的开头注释
// input: 状态渲染参数
// output: 播放页状态占位
// pos: 页面组件
"use client";

import { AlertCircle, Loader2, Volume2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PlaybackLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  );
}

interface PlaybackErrorStateProps {
  message: string;
  onBack: () => void;
}

export function PlaybackErrorState({ message, onBack }: PlaybackErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-red-500" />
        <p className="mb-4 text-red-600">{message}</p>
        <Button onClick={onBack}>返回</Button>
      </div>
    </div>
  );
}

interface PlaybackEmptyStateProps {
  onGenerate: () => void;
  onBackBook: () => void;
}

export function PlaybackEmptyState({ onGenerate, onBackBook }: PlaybackEmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-12 !pt-12 text-center">
        <Volume2 className="mx-auto mb-6 h-16 w-16 text-gray-400" />
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">暂无音频文件</h2>
        <p className="mx-auto mb-8 max-w-md text-gray-600">
          这本书还没有生成音频文件。请先前往音频生成页面创建音频。
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button onClick={onGenerate} size="lg" className="min-h-11">
            <Volume2 className="mr-2 h-5 w-5" />
            生成音频
          </Button>
          <Button variant="outline" onClick={onBackBook} size="lg" className="min-h-11">
            <FileText className="mr-2 h-5 w-5" />
            返回书籍
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
