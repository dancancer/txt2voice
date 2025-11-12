import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface ScriptHeaderProps {
  bookId: string;
  bookTitle: string;
  scriptSentencesCount: number;
  hasScriptSentences: boolean;
}

export function ScriptHeader({
  bookId,
  bookTitle,
  scriptSentencesCount,
  hasScriptSentences,
}: ScriptHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/books/${bookId}`)}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">台本生成</h1>
              <p className="text-sm text-gray-500">{bookTitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">{scriptSentencesCount} 句台词</Badge>
            <Button
              variant="outline"
              onClick={() => router.push(`/books/${bookId}/audio`)}
              disabled={!hasScriptSentences}
            >
              <Zap className="w-4 h-4 mr-2" />
              生成音频
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
