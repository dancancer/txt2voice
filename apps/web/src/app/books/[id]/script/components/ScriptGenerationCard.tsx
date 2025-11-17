import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  AlertCircle,
  Zap,
  Loader2,
  CheckCircle,
  Eye,
  Download,
  RefreshCw,
  SkipForward,
  Headphones,
  Combine,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ScriptGenerationCardProps {
  bookId: string;
  hasTextSegments: boolean;
  hasScriptSentences: boolean;
  isGenerating: boolean;
  segmentsCount: number;
  scriptSentencesCount: number;
  onGenerate: () => void;
  onRegenerate: () => void;
  onExport: () => void;
  onShowPreview: () => void;
  onShowIncremental: () => void;
  onShowRegenerate: () => void;
  onGenerateAudio?: () => void;
  onMergeAudio?: () => void;
}

export function ScriptGenerationCard({
  bookId,
  hasTextSegments,
  hasScriptSentences,
  isGenerating,
  segmentsCount,
  scriptSentencesCount,
  onGenerate,
  onRegenerate,
  onExport,
  onShowPreview,
  onShowIncremental,
  onShowRegenerate,
  onGenerateAudio,
  onMergeAudio,
}: ScriptGenerationCardProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          台本生成
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasTextSegments ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              需要先处理文本段落
            </h3>
            <p className="text-gray-600 mb-4">请先在文本段落页面处理书籍内容</p>
            <Button
              onClick={() => router.push(`/books/${bookId}/segments`)}
              variant="outline"
            >
              查看文本段落
            </Button>
          </div>
        ) : !hasScriptSentences ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">生成台本</h3>
            <p className="text-gray-600 mb-6">
              从前两个段落中提取对话内容，生成用于音频录制的台本
            </p>
            <Button onClick={onGenerate} disabled={isGenerating} size="lg">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  生成前两段台本
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">台本已生成</p>
                  <p className="text-sm text-green-700">
                    从 {segmentsCount} 个段落中提取了 {scriptSentencesCount}{" "}
                    句台词
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={onShowPreview}>
                  <Eye className="w-4 h-4 mr-2" />
                  预览
                </Button>
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRegenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
                {onGenerateAudio && (
                  <Button
                    size="sm"
                    onClick={onGenerateAudio}
                    disabled={isGenerating}
                  >
                    <Headphones className="w-4 h-4 mr-2" />
                    整书音频
                  </Button>
                )}
                {onMergeAudio && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onMergeAudio}
                    disabled={isGenerating}
                  >
                    <Combine className="w-4 h-4 mr-2" />
                    合并音频
                  </Button>
                )}
              </div>
            </div>

            {/* Incremental Processing Actions */}
            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600 w-full mb-2">
                高级选项 (从特定段落开始处理或重新生成指定段落):
              </div>

              <Button
                onClick={onShowIncremental}
                variant="outline"
                size="sm"
                disabled={isGenerating}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                增量处理
              </Button>

              <Button
                onClick={onShowRegenerate}
                variant="outline"
                size="sm"
                disabled={isGenerating}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新生成段落
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
