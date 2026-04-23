// 一旦我被更新，请更新我的开头注释
// input: SCRIPT_VALIDATION 复核项/结构化编辑草稿
// output: 工作台共享类型与纯转换工具
// pos: 质检复核页面子组件
"use client";

import type { ManualReviewItem } from "../../models/types";

export interface ReviewScriptEditWorkspaceProps {
  open: boolean;
  item: ManualReviewItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (structuredResult: Record<string, unknown>) => Promise<boolean>;
}

export interface DialogueDraft {
  id: string;
  sourceText: string;
  text: string;
  speaker: string;
  tone: string;
  roleType: string;
}

export interface CharacterDraft {
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
  return Array.isArray(record?.characters) ? record.characters : [];
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

export const resolveCurrentStructuredResult = (
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

export const buildChangeSummary = (
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

export const buildSpeakerOptions = (draft: ReviewScriptEditDraft) => {
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
};

export const reviewScriptDraftFactories = {
  asArray,
  asRecord,
  asString,
};
