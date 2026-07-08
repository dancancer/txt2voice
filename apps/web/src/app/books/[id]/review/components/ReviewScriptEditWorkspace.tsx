// 一旦我被更新，请更新我的开头注释
// input: SCRIPT_VALIDATION 复核项/保存回调
// output: 全屏台本修订工作台
// pos: 质检复核页面子组件
"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RotateCcw, Save } from "lucide-react";
import { ReviewScriptEditWorkspaceEditorPanel } from "./review-script-edit-workspace/EditorPanel";
import { ReviewScriptEditWorkspaceInspectorPanel } from "./review-script-edit-workspace/InspectorPanel";
import { ReviewScriptEditWorkspaceSourcePanel } from "./review-script-edit-workspace/SourcePanel";
import {
  buildChangeSummary,
  buildInitialDraft,
  buildSpeakerOptions,
  resolveCurrentStructuredResult,
  reviewScriptDraftFactories,
  toStructuredResult,
  type CharacterDraft,
  type DialogueDraft,
  type ReviewScriptEditDraft,
  type ReviewScriptEditWorkspaceProps,
} from "./review-script-edit-workspace/shared";

const { asArray, asRecord, asString } = reviewScriptDraftFactories;

export { buildInitialDraft, toStructuredResult };

export function ReviewScriptEditWorkspace({
  open,
  item,
  saving,
  onClose,
  onSave,
}: ReviewScriptEditWorkspaceProps) {
  const detail = asRecord(item?.issueDetail);
  const originalStructuredResult = useMemo(
    () =>
      detail?.structuredResult &&
      typeof detail.structuredResult === "object" &&
      !Array.isArray(detail.structuredResult)
        ? (detail.structuredResult as Record<string, unknown>)
        : null,
    [detail]
  );
  const currentStructuredResult = useMemo(
    () => resolveCurrentStructuredResult(item),
    [item]
  );
  const [draft, setDraft] = useState<ReviewScriptEditDraft>(() => buildInitialDraft(item));
  const [selectedDialogueIndex, setSelectedDialogueIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const structuredResult = useMemo(() => toStructuredResult(draft), [draft]);
  const rawResponse = asString(detail?.rawResponse);
  const rawResponseUnavailableReason = asString(detail?.rawResponseUnavailableReason);
  const segmentContent = asString(detail?.segmentContent);
  const issueMessages = asArray(detail?.issueMessages)
    .map((message) => asString(message).trim())
    .filter(Boolean);
  const issuePreviews = asArray(detail?.issuePreviews)
    .map((preview) => asString(preview).trim())
    .filter(Boolean);
  const focusedSourceText =
    draft.dialogues[selectedDialogueIndex]?.sourceText || issuePreviews[0] || "";
  const changeSummary = buildChangeSummary(currentStructuredResult, structuredResult);
  const speakerOptions = useMemo(() => buildSpeakerOptions(draft), [draft]);

  if (!item) {
    return null;
  }

  const updateDialogue = (
    index: number,
    field: keyof DialogueDraft,
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      dialogues: prev.dialogues.map((dialogue, dialogueIndex) =>
        dialogueIndex === index ? { ...dialogue, [field]: value } : dialogue
      ),
    }));
  };

  const updateCharacter = (
    index: number,
    field: keyof CharacterDraft,
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      characters: prev.characters.map((character, characterIndex) =>
        characterIndex === index ? { ...character, [field]: value } : character
      ),
    }));
  };

  const addDialogue = () => {
    setDraft((prev) => ({
      ...prev,
      dialogues: [
        ...prev.dialogues,
        {
          id: `dialogue-${prev.dialogues.length + 1}`,
          sourceText: "",
          text: "",
          speaker: "",
          tone: "",
          roleType: "",
        },
      ],
    }));
    setSelectedDialogueIndex(draft.dialogues.length);
  };

  const removeDialogue = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      dialogues: prev.dialogues.filter((_, dialogueIndex) => dialogueIndex !== index),
    }));
    setSelectedDialogueIndex((prev) => Math.max(prev - 1, 0));
  };

  const moveDialogue = (index: number, direction: "up" | "down") => {
    setDraft((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.dialogues.length) {
        return prev;
      }

      const dialogues = [...prev.dialogues];
      const [currentDialogue] = dialogues.splice(index, 1);
      dialogues.splice(targetIndex, 0, currentDialogue);
      return {
        ...prev,
        dialogues,
      };
    });
    setSelectedDialogueIndex((prev) => {
      if (prev === index) {
        return direction === "up" ? index - 1 : index + 1;
      }
      if (direction === "up" && prev === index - 1) {
        return index;
      }
      if (direction === "down" && prev === index + 1) {
        return index;
      }
      return prev;
    });
  };

  const addCharacter = () => {
    setDraft((prev) => ({
      ...prev,
      characters: [
        ...prev.characters,
        {
          name: "",
          aliases: "",
          description: "",
          gender: "unknown",
          age: "",
          dialogueStyle: "",
          importance: "minor",
          personality: "",
        },
      ],
    }));
  };

  const removeCharacter = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      characters: prev.characters.filter((_, characterIndex) => characterIndex !== index),
    }));
  };

  const handleSave = async () => {
    setSaveError(null);
    const success = await onSave(structuredResult);
    if (!success) {
      setSaveError("保存失败，请检查结构化结果后重试。");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="h-[92vh] max-w-[96vw] overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col bg-background">
          <DialogHeader className="border-b border-border bg-card px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <DialogTitle>台本修订工作台</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">segment {item.segmentId || "-"}</Badge>
                  <Badge variant="outline">chapter {item.chapterId || "-"}</Badge>
                  <Badge variant="outline">priority {item.priority}</Badge>
                  <span>保存后将直接回写该段台词并解决当前复核项</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                  关闭
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(buildInitialDraft(item))}
                  disabled={saving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置为原始结果
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "保存中..." : "保存并通过"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
            <ReviewScriptEditWorkspaceSourcePanel
              segmentContent={segmentContent}
              issuePreviews={issuePreviews}
              issueMessages={issueMessages}
              focusedSourceText={focusedSourceText}
            />
            <ReviewScriptEditWorkspaceEditorPanel
              draft={draft}
              selectedDialogueIndex={selectedDialogueIndex}
              speakerOptions={speakerOptions}
              onSelectDialogue={setSelectedDialogueIndex}
              onAddDialogue={addDialogue}
              onRemoveDialogue={removeDialogue}
              onMoveDialogue={moveDialogue}
              onUpdateDialogue={updateDialogue}
              onAddCharacter={addCharacter}
              onRemoveCharacter={removeCharacter}
              onUpdateCharacter={updateCharacter}
            />
            <ReviewScriptEditWorkspaceInspectorPanel
              saveError={saveError}
              changeSummary={changeSummary}
              originalStructuredResult={originalStructuredResult}
              currentStructuredResult={currentStructuredResult}
              rawResponse={rawResponse}
              rawResponseUnavailableReason={rawResponseUnavailableReason}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
