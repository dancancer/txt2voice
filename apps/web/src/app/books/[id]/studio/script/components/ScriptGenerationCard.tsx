// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
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
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              需要先完成文本处理
            </h3>
            <p className="mb-4 text-muted-foreground">请先在书籍概览处理文件内容，完成分段</p>
            <Button onClick={() => router.push(`/books/${bookId}`)} variant="outline">
              返回书籍概览
            </Button>
          </div>
        ) : !hasScriptSentences ? (
          <div className="text-center py-8">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-foreground">生成台本</h3>
            <p className="mb-6 text-muted-foreground">
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
            <div className="flex items-center justify-between rounded-lg border border-border bg-accent/60 p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">台本已生成</p>
                  <p className="text-sm text-muted-foreground">
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
            <div className="flex flex-wrap gap-3 border-t border-border pt-3">
              <div className="mb-2 w-full text-sm text-muted-foreground">
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
