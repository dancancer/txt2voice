// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, SkipForward } from "lucide-react";
import { SegmentStatus } from "./types";

interface IncrementalProcessingModalProps {
  segmentStatus: SegmentStatus[];
  selectedStartSegment: string | null;
  isGenerating: boolean;
  segmentStatusLoading: boolean;
  onClose: () => void;
  onSelectSegment: (segmentId: string) => void;
  onStartProcessing: (segmentId: string) => void;
}

export function IncrementalProcessingModal({
  segmentStatus,
  selectedStartSegment,
  isGenerating,
  segmentStatusLoading,
  onClose,
  onSelectSegment,
  onStartProcessing,
}: IncrementalProcessingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>增量处理台本</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                选择开始段落，系统将从该段落开始继续生成台本，已生成的段落保持不变。
              </p>
            </div>

            {segmentStatusLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>加载段落状态中...</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {segmentStatus.map((segment) => (
                  <div
                    key={segment.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedStartSegment === segment.id
                        ? "border-border bg-accent"
                        : segment.processed
                        ? "border-border bg-muted/60 hover:bg-accent/70"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                    onClick={() => onSelectSegment(segment.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          段落 {segment.orderIndex + 1}
                        </span>
                        {segment.processed && (
                          <Badge
                            variant="outline"
                            className="border-border text-primary"
                          >
                            已处理
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {segment.content}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {segment.wordCount} 字符
                        {segment.processed && ` • ${segment.lineCount} 句台词`}
                      </p>
                    </div>
                    <div className="ml-4">
                      {selectedStartSegment === segment.id ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-border" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-3 border-t border-border pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button
                onClick={() =>
                  selectedStartSegment &&
                  onStartProcessing(selectedStartSegment)
                }
                disabled={!selectedStartSegment || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <SkipForward className="w-4 h-4 mr-2" />
                    开始增量处理
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
