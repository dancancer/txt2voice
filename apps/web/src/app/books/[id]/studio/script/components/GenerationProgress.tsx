// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ScriptGenerationRuntimeEvent } from "@/lib/script-generation/runner/runtime-events";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Eye,
} from "lucide-react";

interface GenerationProgressProps {
  isGenerating: boolean;
  generationStatus: string;
  generationProgress: number;
  generationEvents: ScriptGenerationRuntimeEvent[];
  onShowPreview: () => void;
}

export function GenerationProgress({
  isGenerating,
  generationStatus,
  generationProgress,
  generationEvents,
  onShowPreview,
}: GenerationProgressProps) {
  if (!isGenerating && !generationStatus) {
    return null;
  }

  const getIcon = () => {
    if (isGenerating) {
      return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
    }
    if (generationStatus.includes("完成")) {
      return <CheckCircle className="h-6 w-6 text-primary" />;
    }
    if (generationStatus.includes("失败")) {
      return <AlertCircle className="h-6 w-6 text-destructive" />;
    }
    return <FileText className="h-6 w-6 text-primary" />;
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6 !pt-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {getIcon()}
            <div className="flex-1">
              <p className="font-medium text-foreground">{generationStatus}</p>
              {isGenerating && (
                <Progress value={generationProgress} className="mt-2" />
              )}
            </div>
            {!isGenerating && generationStatus.includes("完成") && (
              <Button onClick={onShowPreview} size="sm">
                <Eye className="w-4 h-4 mr-2" />
                查看台本
              </Button>
            )}
          </div>

          {generationEvents.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>最近进展</span>
                <span>{generationEvents.length} 条事件</span>
              </div>
              <div className="space-y-2">
                {generationEvents
                  .slice()
                  .reverse()
                  .map((event) => (
                    <div
                      key={event.seq}
                      className="rounded-md border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {event.title}
                        </p>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.detail ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
