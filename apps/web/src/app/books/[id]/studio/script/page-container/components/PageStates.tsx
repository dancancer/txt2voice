// 一旦我被更新，请更新我的开头注释
// input: 页面状态参数
// output: 统一状态占位 UI
// pos: 页面容器展示组件
"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScriptStudioLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

interface ScriptStudioErrorStateProps {
  message: string;
  onBack: () => void;
}

export function ScriptStudioErrorState({
  message,
  onBack,
}: ScriptStudioErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center">
        <FileText className="mx-auto mb-4 h-8 w-8 text-destructive" />
        <p className="mb-4 text-destructive">{message}</p>
        <Button onClick={onBack}>返回</Button>
      </div>
    </div>
  );
}
