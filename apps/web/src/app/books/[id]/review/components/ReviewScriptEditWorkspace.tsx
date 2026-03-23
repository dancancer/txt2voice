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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { ManualReviewItem } from "../models/types";

interface ReviewScriptEditWorkspaceProps {
  open: boolean;
  item: ManualReviewItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (structuredResult: Record<string, unknown>) => Promise<boolean>;
}

interface DialogueDraft {
  id: string;
  sourceText: string;
  text: string;
  speaker: string;
  tone: string;
  roleType: string;
}

interface CharacterDraft {
  name: string;
  aliases: string;
  description: string;
  gender: string;
  age: string;
  dialogueStyle: string;
  importance: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeDialogues = (value: unknown): DialogueDraft[] =>
  asArray(value).map((entry, index) => {
    const record = asRecord(entry);
    return {
      id: asString(record?.id) || `dialogue-${index + 1}`,
      sourceText: asString(record?.sourceText),
      text: asString(record?.text),
      speaker: asString(record?.speaker),
      tone: asString(record?.tone),
      roleType: asString(record?.roleType),
    };
  });

const normalizeCharacters = (value: unknown): CharacterDraft[] =>
  asArray(value).map((entry) => {
    const record = asRecord(entry);
    const aliases = asArray(record?.aliases)
      .map((alias) => asString(alias).trim())
      .filter(Boolean)
      .join(", ");
    const personality = asArray(record?.personality)
      .map((item) => asString(item).trim())
      .filter(Boolean)
      .join(", ");
    return {
      name: asString(record?.name),
      aliases,
      description: asString(record?.description),
      gender: asString(record?.gender),
      age:
        record?.age === null || record?.age === undefined ? "" : String(record?.age),
      dialogueStyle: asString(record?.dialogueStyle),
      importance: asString(record?.importance),
      // 先把 personality 合并进 description 辅助展示，避免新增更多字段
      ...(personality
        ? {
            description:
              [asString(record?.description), `性格: ${personality}`]
                .filter(Boolean)
                .join("\n"),
          }
        : {}),
    };
  });

const buildInitialDraft = (item: ManualReviewItem | null) => {
  const detail = asRecord(item?.issueDetail);
  const structuredResult = asRecord(detail?.structuredResult);
  return {
    dialogues: normalizeDialogues(structuredResult?.dialogues),
    characters: normalizeCharacters(structuredResult?.characters),
  };
};

const toStructuredResult = (draft: {
  dialogues: DialogueDraft[];
  characters: CharacterDraft[];
}): Record<string, unknown> => ({
  dialogues: draft.dialogues.map((dialogue) => ({
    id: dialogue.id,
    sourceText: dialogue.sourceText,
    text: dialogue.text,
    speaker: dialogue.speaker,
    tone: dialogue.tone,
    ...(dialogue.roleType.trim() ? { roleType: dialogue.roleType.trim() } : {}),
  })),
  characters: draft.characters.map((character) => ({
    name: character.name,
    aliases: character.aliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    description: character.description,
    gender: character.gender || "unknown",
    age: character.age.trim() ? character.age.trim() : null,
    personality: [],
    importance: character.importance || "minor",
    dialogueStyle: character.dialogueStyle,
  })),
});

const buildChangeSummary = (
  original: Record<string, unknown> | null,
  current: Record<string, unknown>
) => {
  const originalDialogues = normalizeDialogues(asRecord(original)?.dialogues);
  const currentDialogues = normalizeDialogues(current.dialogues);
  const changes: string[] = [];

  currentDialogues.forEach((dialogue, index) => {
    const originalDialogue = originalDialogues[index];
    if (!originalDialogue) {
      changes.push(`新增第 ${index + 1} 条台词：${dialogue.text || "（空）"}`);
      return;
    }
    if (originalDialogue.speaker !== dialogue.speaker) {
      changes.push(
        `第 ${index + 1} 条 speaker：${originalDialogue.speaker || "（空）"} → ${dialogue.speaker || "（空）"}`
      );
    }
    if (originalDialogue.text !== dialogue.text) {
      changes.push(`第 ${index + 1} 条正文已修改`);
    }
    if (originalDialogue.sourceText !== dialogue.sourceText) {
      changes.push(`第 ${index + 1} 条 sourceText 已修改`);
    }
  });

  if (currentDialogues.length < originalDialogues.length) {
    changes.push(`删除了 ${originalDialogues.length - currentDialogues.length} 条原始台词`);
  }

  return changes;
};

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
  const [draft, setDraft] = useState(() => buildInitialDraft(item));
  const [selectedDialogueIndex, setSelectedDialogueIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const structuredResult = useMemo(() => toStructuredResult(draft), [draft]);
  const rawResponse = asString(detail?.rawResponse);
  const segmentContent = asString(detail?.segmentContent);
  const issueMessages = asArray(detail?.issueMessages)
    .map((message) => asString(message).trim())
    .filter(Boolean);
  const issuePreviews = asArray(detail?.issuePreviews)
    .map((preview) => asString(preview).trim())
    .filter(Boolean);
  const focusedSourceText =
    draft.dialogues[selectedDialogueIndex]?.sourceText || issuePreviews[0] || "";
  const changeSummary = buildChangeSummary(originalStructuredResult, structuredResult);

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
        <div className="flex h-full flex-col bg-slate-50">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <DialogTitle>台本修订工作台</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                <Button type="button" variant="outline" onClick={() => setDraft(buildInitialDraft(item))} disabled={saving}>
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

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
            <section className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">段落原文</h3>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
                      {segmentContent || "当前缺少完整段落原文"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">问题定位片段</h3>
                  <div className="space-y-2">
                    {issuePreviews.length > 0 ? (
                      issuePreviews.map((preview) => (
                        <div
                          key={preview}
                          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
                        >
                          {preview}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">当前没有问题片段定位。</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">当前聚焦原文切片</h3>
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-900">
                    {focusedSourceText || "点击中间的台词条目后，这里会显示对应 sourceText。"}
                  </div>
                </div>
                {issueMessages.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">失败原因</h3>
                    <div className="space-y-2">
                      {issueMessages.map((message) => (
                        <div
                          key={message}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-900"
                        >
                          {message}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">结构化台本编辑</h3>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={addDialogue}>
                      <Plus className="mr-1 h-4 w-4" />
                      新增台词
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={addCharacter}>
                      <Plus className="mr-1 h-4 w-4" />
                      新增角色
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="dialogues">
                  <TabsList>
                    <TabsTrigger value="dialogues">台词结构</TabsTrigger>
                    <TabsTrigger value="characters">角色候选</TabsTrigger>
                  </TabsList>
                  <TabsContent value="dialogues" className="space-y-3">
                    {draft.dialogues.map((dialogue, index) => (
                      <div
                        key={`${dialogue.id}-${index}`}
                        className={`rounded-lg border p-3 ${
                          selectedDialogueIndex === index
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <button
                            type="button"
                            className="cursor-pointer text-left text-sm font-medium text-slate-900"
                            onClick={() => setSelectedDialogueIndex(index)}
                          >
                            第 {index + 1} 条
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeDialogue(index)}
                            aria-label={`删除第 ${index + 1} 条台词`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <Input
                            value={dialogue.speaker}
                            onChange={(event) => updateDialogue(index, "speaker", event.target.value)}
                            placeholder="speaker"
                          />
                          <Input
                            value={dialogue.tone}
                            onChange={(event) => updateDialogue(index, "tone", event.target.value)}
                            placeholder="tone"
                          />
                          <Input
                            value={dialogue.roleType}
                            onChange={(event) => updateDialogue(index, "roleType", event.target.value)}
                            placeholder="roleType（可选）"
                          />
                          <Textarea
                            value={dialogue.sourceText}
                            onChange={(event) => updateDialogue(index, "sourceText", event.target.value)}
                            placeholder="sourceText"
                            className="min-h-[96px] font-mono"
                          />
                          <Textarea
                            value={dialogue.text}
                            onChange={(event) => updateDialogue(index, "text", event.target.value)}
                            placeholder="text"
                            className="min-h-[96px]"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="characters" className="space-y-3">
                    {draft.characters.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        当前没有角色候选，必要时可手动补充。
                      </div>
                    ) : null}
                    {draft.characters.map((character, index) => (
                      <div
                        key={`${character.name || "character"}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">角色 {index + 1}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeCharacter(index)}
                            aria-label={`删除第 ${index + 1} 个角色`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <Input
                            value={character.name}
                            onChange={(event) => updateCharacter(index, "name", event.target.value)}
                            placeholder="name"
                          />
                          <Input
                            value={character.aliases}
                            onChange={(event) => updateCharacter(index, "aliases", event.target.value)}
                            placeholder="aliases，用逗号分隔"
                          />
                          <Input
                            value={character.gender}
                            onChange={(event) => updateCharacter(index, "gender", event.target.value)}
                            placeholder="gender"
                          />
                          <Input
                            value={character.age}
                            onChange={(event) => updateCharacter(index, "age", event.target.value)}
                            placeholder="age"
                          />
                          <Input
                            value={character.dialogueStyle}
                            onChange={(event) => updateCharacter(index, "dialogueStyle", event.target.value)}
                            placeholder="dialogueStyle"
                          />
                          <Input
                            value={character.importance}
                            onChange={(event) => updateCharacter(index, "importance", event.target.value)}
                            placeholder="importance"
                          />
                          <Textarea
                            value={character.description}
                            onChange={(event) => updateCharacter(index, "description", event.target.value)}
                            placeholder="description"
                            className="min-h-[96px]"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto bg-white p-4">
              <div className="space-y-4">
                {saveError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
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
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                        >
                          {summary}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        当前还没有相对于原始结构的变更。
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="structured">
                    <Textarea
                      readOnly
                      value={JSON.stringify(originalStructuredResult || {}, null, 2)}
                      className="min-h-[60vh] font-mono text-xs"
                    />
                  </TabsContent>
                  <TabsContent value="raw">
                    <Textarea
                      readOnly
                      value={rawResponse || "当前没有原始响应文本。"}
                      className="min-h-[60vh] font-mono text-xs"
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
