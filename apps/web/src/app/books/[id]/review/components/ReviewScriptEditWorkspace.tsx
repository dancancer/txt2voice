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
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
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
  personality: string;
  gender: string;
  age: string;
  dialogueStyle: string;
  importance: string;
}

export interface ReviewScriptEditDraft {
  dialogues: DialogueDraft[];
  characters: CharacterDraft[];
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

const resolveDialogueEntries = (value: unknown): unknown[] => {
  const record = asRecord(value);
  if (Array.isArray(record?.dialogues)) {
    return record.dialogues;
  }
  if (Array.isArray(record?.lines)) {
    return record.lines;
  }
  return [];
};

const resolveCharacterEntries = (value: unknown): unknown[] => {
  const record = asRecord(value);
  if (Array.isArray(record?.characters)) {
    return record.characters;
  }
  return [];
};

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
      personality,
      gender: asString(record?.gender),
      age:
        record?.age === null || record?.age === undefined ? "" : String(record?.age),
      dialogueStyle: asString(record?.dialogueStyle),
      importance: asString(record?.importance),
    };
  });

const resolveCurrentStructuredResult = (
  item: ManualReviewItem | null
): Record<string, unknown> | null => {
  const detail = asRecord(item?.issueDetail);
  return (
    asRecord(detail?.manualEditedStructuredResult) ||
    asRecord(detail?.structuredResult)
  );
};

export const buildInitialDraft = (
  item: ManualReviewItem | null
): ReviewScriptEditDraft => {
  const structuredResult = resolveCurrentStructuredResult(item);
  return {
    dialogues: normalizeDialogues(resolveDialogueEntries(structuredResult)),
    characters: normalizeCharacters(resolveCharacterEntries(structuredResult)),
  };
};

export const toStructuredResult = (
  draft: ReviewScriptEditDraft
): Record<string, unknown> => ({
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
    personality: character.personality
      .split(",")
      .map((trait) => trait.trim())
      .filter(Boolean),
    gender: character.gender || "unknown",
    age: character.age.trim() ? character.age.trim() : null,
    importance: character.importance || "minor",
    dialogueStyle: character.dialogueStyle,
  })),
});

const buildChangeSummary = (
  original: Record<string, unknown> | null,
  current: Record<string, unknown>
) => {
  const originalDialogues = normalizeDialogues(resolveDialogueEntries(original));
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
  const currentStructuredResult = useMemo(
    () => resolveCurrentStructuredResult(item),
    [item]
  );
  const [draft, setDraft] = useState(() => buildInitialDraft(item));
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
  const speakerOptions = useMemo(() => {
    const roles = new Set<string>(["旁白"]);
    draft.characters.forEach((character) => {
      const normalizedName = character.name.trim();
      if (normalizedName) {
        roles.add(normalizedName);
      }
    });
    draft.dialogues.forEach((dialogue) => {
      const normalizedSpeaker = dialogue.speaker.trim();
      if (normalizedSpeaker) {
        roles.add(normalizedSpeaker);
      }
    });
    return Array.from(roles);
  }, [draft.characters, draft.dialogues]);

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

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
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

            <section className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-muted/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">结构化台本编辑</h3>
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

              <Tabs defaultValue="dialogues" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="w-fit shrink-0">
                  <TabsTrigger value="dialogues">台词结构</TabsTrigger>
                  <TabsTrigger value="characters">角色候选</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="dialogues"
                  className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1"
                >
                  <div className="space-y-3">
                    {draft.dialogues.map((dialogue, index) => (
                      <div
                        key={`${dialogue.id}-${index}`}
                        className={`rounded-lg border p-3 ${
                          selectedDialogueIndex === index
                            ? "border-border bg-accent/70"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <button
                            type="button"
                            className="cursor-pointer text-left text-sm font-medium text-foreground"
                            onClick={() => setSelectedDialogueIndex(index)}
                          >
                            第 {index + 1} 条
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => moveDialogue(index, "up")}
                              disabled={index === 0}
                              aria-label={`上移第 ${index + 1} 条台词`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => moveDialogue(index, "down")}
                              disabled={index === draft.dialogues.length - 1}
                              aria-label={`下移第 ${index + 1} 条台词`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
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
                        </div>
                        <div className="grid gap-3">
                          <label className="grid gap-1 text-xs text-muted-foreground">
                            <span>speaker（从已识别角色选择）</span>
                            <select
                              value={dialogue.speaker}
                              onChange={(event) =>
                                updateDialogue(index, "speaker", event.target.value)
                              }
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              {!dialogue.speaker ? (
                                <option value="">请选择 speaker</option>
                              ) : null}
                              {speakerOptions.map((speaker) => (
                                <option key={speaker} value={speaker}>
                                  {speaker}
                                </option>
                              ))}
                            </select>
                          </label>
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
                  </div>
                </TabsContent>
                <TabsContent
                  value="characters"
                  className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1"
                >
                  <div className="space-y-3">
                    {draft.characters.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                        当前没有角色候选，必要时可手动补充。
                      </div>
                    ) : null}
                    {draft.characters.map((character, index) => (
                      <div
                        key={`${character.name || "character"}-${index}`}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">角色 {index + 1}</p>
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
                            value={character.personality}
                            onChange={(event) =>
                              updateCharacter(index, "personality", event.target.value)
                            }
                            placeholder="personality，用逗号分隔"
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
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            <section className="min-h-0 overflow-y-auto bg-white p-4">
              <div className="space-y-4">
                {saveError ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
                        rawResponse ||
                        rawResponseUnavailableReason ||
                        "当前没有原始响应文本。"
                      }
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
