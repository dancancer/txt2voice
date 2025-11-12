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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
              <p className="text-sm text-gray-600 mb-4">
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
                        ? "border-blue-500 bg-blue-50"
                        : segment.processed
                        ? "border-green-200 bg-green-50 hover:bg-green-100"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => onSelectSegment(segment.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          段落 {segment.orderIndex + 1}
                        </span>
                        {segment.processed && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-300"
                          >
                            已处理
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {segment.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {segment.wordCount} 字符
                        {segment.processed && ` • ${segment.lineCount} 句台词`}
                      </p>
                    </div>
                    <div className="ml-4">
                      {selectedStartSegment === segment.id ? (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-3 pt-4 border-t">
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
