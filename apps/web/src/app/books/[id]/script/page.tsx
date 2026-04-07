// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, ArrowRight } from "lucide-react";

export default function ScriptLegacyEntryPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  return (
    <div className="min-h-full bg-background">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>台本入口已升级</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 leading-7 text-muted-foreground">
            <p>
              默认流程已迁移到“书籍详情 → 章节详情”，你可以按章节查看原文、台本与音频。
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">推荐：章节化流程</Badge>
              <Badge variant="outline">可选：高级台本工作台</Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={() => router.push(`/books/${bookId}`)} className="min-h-11">
                <FileText className="w-4 h-4 mr-2" />
                前往章节详情
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/books/${bookId}/studio/script`)}
                className="min-h-11"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                打开高级台本工作台
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
