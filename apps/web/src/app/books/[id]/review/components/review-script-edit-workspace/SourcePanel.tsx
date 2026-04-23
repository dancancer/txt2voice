// 一旦我被更新，请更新我的开头注释
// input: 段落原文/问题切片/失败消息
// output: 工作台左侧上下文面板
// pos: 质检复核页面子组件
"use client";

export function ReviewScriptEditWorkspaceSourcePanel(props: {
  segmentContent: string;
  issuePreviews: string[];
  issueMessages: string[];
  focusedSourceText: string;
}) {
  const { focusedSourceText, issueMessages, issuePreviews, segmentContent } = props;

  return (
    <section className="min-h-0 overflow-y-auto border-r border-border bg-card p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">段落原文</h3>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
              {segmentContent || "当前缺少完整段落原文"}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">问题定位片段</h3>
          <div className="space-y-2">
            {issuePreviews.length > 0 ? (
              issuePreviews.map((preview) => (
                <div
                  key={preview}
                  className="rounded-md border border-border bg-accent/60 px-3 py-2 text-sm leading-6 text-foreground"
                >
                  {preview}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">当前没有问题片段定位。</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">当前聚焦原文切片</h3>
          <div className="rounded-md border border-border bg-accent px-3 py-2 text-sm leading-6 text-accent-foreground">
            {focusedSourceText || "点击中间的台词条目后，这里会显示对应 sourceText。"}
          </div>
        </div>
        {issueMessages.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">失败原因</h3>
            <div className="space-y-2">
              {issueMessages.map((message) => (
                <div
                  key={message}
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive"
                >
                  {message}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
