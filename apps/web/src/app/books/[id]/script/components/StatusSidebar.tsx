import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Zap, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface StatusSidebarProps {
  bookId: string;
  segmentsCount: number;
  scriptSentencesCount: number;
  charactersCount: number;
  assignedSentencesCount: number;
  hasTextSegments: boolean;
  hasScriptSentences: boolean;
  hasCharacters: boolean;
}

export function StatusSidebar({
  bookId,
  segmentsCount,
  scriptSentencesCount,
  charactersCount,
  assignedSentencesCount,
  hasTextSegments,
  hasScriptSentences,
  hasCharacters,
}: StatusSidebarProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>状态概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">文本段落</span>
              <Badge variant={hasTextSegments ? "default" : "secondary"}>
                {segmentsCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">台本句子</span>
              <Badge variant={hasScriptSentences ? "default" : "secondary"}>
                {scriptSentencesCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">角色数量</span>
              <Badge variant={hasCharacters ? "default" : "secondary"}>
                {charactersCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">已分配台词</span>
              <Badge variant="outline">{assignedSentencesCount}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/books/${bookId}/characters`)}
          >
            <User className="w-4 h-4 mr-2" />
            管理角色
          </Button>
          {hasScriptSentences && (
            <Button
              className="w-full"
              onClick={() => router.push(`/books/${bookId}/audio`)}
            >
              <Zap className="w-4 h-4 mr-2" />
              生成音频
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>提示</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p>台本会自动从文本段落中提取对话内容</p>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p>为台词分配角色以获得更好的音频效果</p>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p>可以编辑和调整台词内容</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
