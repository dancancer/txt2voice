// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 音频生成状态卡片
// pos: 共享组件
"use client";

import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Play,
  Volume2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GenerationState } from "@/hooks/useAudioGeneration";

type GenerationStatusProps = {
  state: GenerationState;
  isGenerating: boolean;
  onGoPlay?: () => void;
};

export function GenerationStatusCard({
  state,
  isGenerating,
  onGoPlay,
}: GenerationStatusProps) {
  const icon = isGenerating ? (
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  ) : state.status === "failed" ? (
    <AlertCircle className="h-6 w-6 text-destructive" />
  ) : state.status === "completed" ? (
    <CheckCircle className="h-6 w-6 text-primary" />
  ) : (
    <Volume2 className="h-6 w-6 text-primary" />
  );

  return (
    <Card className="mb-6">
      <CardContent className="p-6 !pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="shrink-0">{icon}</div>
          <div className="flex-1 w-full">
            <p className="font-medium text-foreground">{state.message || "音频生成状态"}</p>
            {(isGenerating ||
              state.status === "processing" ||
              state.status === "in_progress") && (
              <Progress value={state.progress} className="mt-2" />
            )}
          </div>
          {!isGenerating && state.status === "completed" && onGoPlay && (
            <Button onClick={onGoPlay} size="sm" className="min-h-11 sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              立即播放
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type SidebarStatusProps = {
  textSegments: number;
  activeCharacters: number;
  audioFiles: number;
};

export function SidebarStatusCard({
  textSegments,
  activeCharacters,
  audioFiles,
}: SidebarStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>生成状态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">文本段落</span>
            <Badge variant="outline">{textSegments}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">角色配置</span>
            <Badge variant="outline">{activeCharacters}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">已生成音频</span>
            <Badge variant="outline">{audioFiles}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SidebarActionsProps = {
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  canGenerate: boolean;
  onGoPlay: () => void;
  onGoBook: () => void;
  onGoCharacters: () => void;
  hasAudio: boolean;
};

export function SidebarActionsCard({
  onGenerate,
  isGenerating,
  canGenerate,
  onGoPlay,
  onGoBook,
  onGoCharacters,
  hasAudio,
}: SidebarActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>快速操作</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={onGenerate} disabled={!canGenerate}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              开始批量生成
            </>
          )}
        </Button>

        <Button variant="outline" className="w-full" onClick={onGoCharacters}>
          <FileText className="mr-2 h-4 w-4" />
          角色配置
        </Button>

        <Button variant="outline" className="w-full" onClick={onGoBook}>
          <FileText className="mr-2 h-4 w-4" />
          返回书籍
        </Button>

        {hasAudio && (
          <Button variant="outline" className="w-full" onClick={onGoPlay}>
            <Play className="mr-2 h-4 w-4" />
            播放音频
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function TipsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>提示</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 建议先完成角色语音配置再批量生成音频。</p>
          <p>• 批次过大可能导致请求压力增高，建议逐步调整。</p>
          <p>• 可先用“跳过已有音频”避免重复生成。</p>
        </div>
      </CardContent>
    </Card>
  );
}
