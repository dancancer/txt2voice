// 一旦我被更新，请更新我的开头注释
// input: 台词草稿/角色草稿/编辑回调
// output: 工作台中间结构化编辑面板
// pos: 质检复核页面子组件
"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterDraft, DialogueDraft, ReviewScriptEditDraft } from "./shared";

interface EditorPanelProps {
  draft: ReviewScriptEditDraft;
  selectedDialogueIndex: number;
  speakerOptions: string[];
  onSelectDialogue: (index: number) => void;
  onAddDialogue: () => void;
  onRemoveDialogue: (index: number) => void;
  onMoveDialogue: (index: number, direction: "up" | "down") => void;
  onUpdateDialogue: (
    index: number,
    field: keyof DialogueDraft,
    value: string
  ) => void;
  onAddCharacter: () => void;
  onRemoveCharacter: (index: number) => void;
  onUpdateCharacter: (
    index: number,
    field: keyof CharacterDraft,
    value: string
  ) => void;
}

export function ReviewScriptEditWorkspaceEditorPanel(props: EditorPanelProps) {
  const {
    draft,
    onAddCharacter,
    onAddDialogue,
    onMoveDialogue,
    onRemoveCharacter,
    onRemoveDialogue,
    onSelectDialogue,
    onUpdateCharacter,
    onUpdateDialogue,
    selectedDialogueIndex,
    speakerOptions,
  } = props;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-muted/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">结构化台本编辑</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onAddDialogue}>
            <Plus className="mr-1 h-4 w-4" />
            新增台词
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAddCharacter}>
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
                    onClick={() => onSelectDialogue(index)}
                  >
                    第 {index + 1} 条
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onMoveDialogue(index, "up")}
                      disabled={index === 0}
                      aria-label={`上移第 ${index + 1} 条台词`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onMoveDialogue(index, "down")}
                      disabled={index === draft.dialogues.length - 1}
                      aria-label={`下移第 ${index + 1} 条台词`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRemoveDialogue(index)}
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
                        onUpdateDialogue(index, "speaker", event.target.value)
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
                    onChange={(event) =>
                      onUpdateDialogue(index, "tone", event.target.value)
                    }
                    placeholder="tone"
                  />
                  <Input
                    value={dialogue.roleType}
                    onChange={(event) =>
                      onUpdateDialogue(index, "roleType", event.target.value)
                    }
                    placeholder="roleType（可选）"
                  />
                  <Textarea
                    value={dialogue.sourceText}
                    onChange={(event) =>
                      onUpdateDialogue(index, "sourceText", event.target.value)
                    }
                    placeholder="sourceText"
                    className="min-h-[96px] font-mono"
                  />
                  <Textarea
                    value={dialogue.text}
                    onChange={(event) =>
                      onUpdateDialogue(index, "text", event.target.value)
                    }
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
                    onClick={() => onRemoveCharacter(index)}
                    aria-label={`删除第 ${index + 1} 个角色`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3">
                  <Input
                    value={character.name}
                    onChange={(event) =>
                      onUpdateCharacter(index, "name", event.target.value)
                    }
                    placeholder="name"
                  />
                  <Input
                    value={character.aliases}
                    onChange={(event) =>
                      onUpdateCharacter(index, "aliases", event.target.value)
                    }
                    placeholder="aliases，用逗号分隔"
                  />
                  <Input
                    value={character.gender}
                    onChange={(event) =>
                      onUpdateCharacter(index, "gender", event.target.value)
                    }
                    placeholder="gender"
                  />
                  <Input
                    value={character.personality}
                    onChange={(event) =>
                      onUpdateCharacter(index, "personality", event.target.value)
                    }
                    placeholder="personality，用逗号分隔"
                  />
                  <Input
                    value={character.age}
                    onChange={(event) =>
                      onUpdateCharacter(index, "age", event.target.value)
                    }
                    placeholder="age"
                  />
                  <Input
                    value={character.dialogueStyle}
                    onChange={(event) =>
                      onUpdateCharacter(index, "dialogueStyle", event.target.value)
                    }
                    placeholder="dialogueStyle"
                  />
                  <Input
                    value={character.importance}
                    onChange={(event) =>
                      onUpdateCharacter(index, "importance", event.target.value)
                    }
                    placeholder="importance"
                  />
                  <Textarea
                    value={character.description}
                    onChange={(event) =>
                      onUpdateCharacter(index, "description", event.target.value)
                    }
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
  );
}
