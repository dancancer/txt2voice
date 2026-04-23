// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { SegmentStatus } from "./types";

interface RegenerateSegmentsModalProps {
  segmentStatus: SegmentStatus[];
  selectedSegments: string[];
  isGenerating: boolean;
  segmentStatusLoading: boolean;
  onClose: () => void;
  onToggleSegment: (segmentId: string) => void;
  onSelectAllProcessed: () => void;
  onClearSelection: () => void;
  onStartRegeneration: (segmentIds: string[]) => void;
}

export function RegenerateSegmentsModal({
  segmentStatus,
  selectedSegments,
  isGenerating,
  segmentStatusLoading,
  onClose,
  onToggleSegment,
  onSelectAllProcessed,
  onClearSelection,
  onStartRegeneration,
}: RegenerateSegmentsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>重新生成段落台本</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                选择要重新生成的段落，系统将删除这些段落的现有台词并重新生成。
              </p>
              <div className="flex items-center space-x-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSelectAllProcessed}
                >
                  选择所有已处理
                </Button>
                <Button variant="outline" size="sm" onClick={onClearSelection}>
                  清除选择
                </Button>
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedSegments.length} 个段落
                </span>
              </div>
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
                      selectedSegments.includes(segment.id)
                        ? "border-border bg-accent"
                        : segment.processed
                        ? "border-border bg-muted/60 hover:bg-accent/70"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      if (segment.processed) {
                        onToggleSegment(segment.id);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          段落 {segment.orderIndex + 1}
                        </span>
                        {segment.processed && (
                          <Badge
                            variant="outline"
                            className="text-primary border-border"
                          >
                            已处理
                          </Badge>
                        )}
                        {!segment.processed && (
                          <Badge variant="secondary" className="text-muted-foreground">
                            未处理
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
                      {selectedSegments.includes(segment.id) ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : segment.processed ? (
                        <div className="h-5 w-5 rounded-full border-2 border-border transition-colors hover:border-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-border bg-muted" />
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
                  selectedSegments.length > 0 &&
                  onStartRegeneration(selectedSegments)
                }
                disabled={selectedSegments.length === 0 || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    重新生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新生成 {selectedSegments.length} 个段落
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
