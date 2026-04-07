// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  onShowPreview: () => void;
}

export function GenerationProgress({
  isGenerating,
  generationStatus,
  generationProgress,
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
      </CardContent>
    </Card>
  );
}
