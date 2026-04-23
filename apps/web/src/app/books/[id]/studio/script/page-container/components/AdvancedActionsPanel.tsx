// 一旦我被更新，请更新我的开头注释
// input: 高级台本动作参数
// output: 高级台本功能面板
// pos: 页面容器展示组件
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScriptStudioAdvancedActionsPanelProps {
  hasTextSegments: boolean;
  isGenerating: boolean;
  canGenerateScript: boolean;
  currentSegmentLabel: string | null;
  onOpenIncrementalOptions: () => void;
  onOpenRegenerateOptions: () => void;
  onRegenerateCurrentSegment?: () => void;
}

export function ScriptStudioAdvancedActionsPanel({
  hasTextSegments,
  isGenerating,
  canGenerateScript,
  currentSegmentLabel,
  onOpenIncrementalOptions,
  onOpenRegenerateOptions,
  onRegenerateCurrentSegment,
}: ScriptStudioAdvancedActionsPanelProps) {
  if (!hasTextSegments) {
    return null;
  }

  const canRegenerateCurrentSegment =
    Boolean(onRegenerateCurrentSegment) && canGenerateScript && !isGenerating;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">高级台本功能</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          增量处理、指定段落重生，以及针对当前上下文的一键段落重生都在这里。
        </p>
        <p className="text-xs text-muted-foreground">
          {currentSegmentLabel
            ? `当前段落：${currentSegmentLabel}`
            : "当前未选中段落，重生当前段落按钮将保持禁用。"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenIncrementalOptions}
            disabled={isGenerating}
          >
            增量处理
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenRegenerateOptions}
            disabled={isGenerating}
          >
            重生指定段落
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onRegenerateCurrentSegment}
            disabled={!canRegenerateCurrentSegment}
          >
            重生当前段落
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
