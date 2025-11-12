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
      return <Loader2 className="w-6 h-6 animate-spin text-blue-600" />;
    }
    if (generationStatus.includes("完成")) {
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
    if (generationStatus.includes("失败")) {
      return <AlertCircle className="w-6 h-6 text-red-600" />;
    }
    return <FileText className="w-6 h-6 text-blue-600" />;
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          {getIcon()}
          <div className="flex-1">
            <p className="font-medium text-gray-900">{generationStatus}</p>
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
