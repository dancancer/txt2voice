// 一旦我被更新，请更新我的开头注释
// input: 保存错误/结构化结果/原始响应
// output: 工作台右侧检查面板
// pos: 质检复核页面子组件
"use client";

import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function ReviewScriptEditWorkspaceInspectorPanel(props: {
  saveError: string | null;
  changeSummary: string[];
  originalStructuredResult: Record<string, unknown> | null;
  currentStructuredResult: Record<string, unknown> | null;
  rawResponse: string;
  rawResponseUnavailableReason: string;
}) {
  const {
    changeSummary,
    currentStructuredResult,
    originalStructuredResult,
    rawResponse,
    rawResponseUnavailableReason,
    saveError,
  } = props;

  return (
    <section className="min-h-0 overflow-y-auto bg-white p-4">
      <div className="space-y-4">
        {saveError ? (
          <div
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {saveError}
          </div>
        ) : null}
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">变更摘要</TabsTrigger>
            <TabsTrigger value="structured">原始生成结果</TabsTrigger>
            <TabsTrigger value="raw">原始响应</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="space-y-2">
            {changeSummary.length > 0 ? (
              changeSummary.map((summary) => (
                <div
                  key={summary}
                  className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground"
                >
                  {summary}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                当前还没有相对于原始结构的变更。
              </div>
            )}
          </TabsContent>
          <TabsContent value="structured">
            <Textarea
              readOnly
              value={JSON.stringify(
                originalStructuredResult || currentStructuredResult || {},
                null,
                2
              )}
              className="min-h-[60vh] font-mono text-xs"
            />
          </TabsContent>
          <TabsContent value="raw">
            <Textarea
              readOnly
              value={
                rawResponse || rawResponseUnavailableReason || "当前没有原始响应文本。"
              }
              className="min-h-[60vh] font-mono text-xs"
            />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
