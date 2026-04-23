// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptSentence } from "./types";
import { ScriptProsodyDisplay } from "./prosody-display";

interface ScriptPreviewModalProps {
  scriptSentences: ScriptSentence[];
  onClose: () => void;
}

export function ScriptPreviewModal({
  scriptSentences,
  onClose,
}: ScriptPreviewModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>台本预览</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {scriptSentences.map((sentence, index) => (
              <div
                key={sentence.id}
                className="border-l-4 border-border pl-4"
              >
                <div className="mb-1 flex items-center space-x-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  {sentence.character ? (
                    <Badge variant="outline">
                      {sentence.character.canonicalName}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">旁白</Badge>
                  )}
                  {sentence.tone && (
                    <Badge
                      variant="outline"
                      className="border-border bg-accent/60 text-accent-foreground"
                    >
                      {sentence.tone}
                    </Badge>
                  )}
                </div>
                <p className="text-foreground">{sentence.text}</p>
                <ScriptProsodyDisplay
                  strength={sentence.strength}
                  pauseAfter={sentence.pauseAfter}
                  prosody={sentence.prosody}
                  compact
                  className="mt-2"
                />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
