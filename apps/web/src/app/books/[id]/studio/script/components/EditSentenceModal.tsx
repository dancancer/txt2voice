// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScriptSentence } from "./types";
import type { CharacterProfileSummary } from "@/types/book";

interface EditSentenceModalProps {
  sentence: ScriptSentence;
  characters: CharacterProfileSummary[];
  onClose: () => void;
  onSave: (
    sentenceId: string,
    updates: {
      text: string;
      tone?: string;
      characterId?: string | null;
      rawSpeaker?: string | null;
      roleType?: string;
    }
  ) => void;
}

export function EditSentenceModal({
  sentence,
  characters,
  onClose,
  onSave,
}: EditSentenceModalProps) {
  const narrationCharacter = useMemo(
    () =>
      characters.find(
        (character) =>
          character.isSystemRole === true &&
          character.systemRoleType === "narration"
      ) || null,
    [characters]
  );
  const narrationValue = narrationCharacter?.id || "__narration__";
  const [text, setText] = useState(sentence.text);
  const [tone, setTone] = useState(sentence.tone ?? "");
  const [characterId, setCharacterId] = useState(
    sentence.characterId ??
      (sentence.rawSpeaker === "旁白" || sentence.roleType === "narration"
        ? narrationValue
        : "")
  );

  const availableCharacters = useMemo(() => {
    const activeCharacters = characters.filter(
      (c) => c.isActive !== false && c.id !== narrationCharacter?.id
    );
    const hasCurrent = activeCharacters.some((c) => c.id === sentence.characterId);
    if (!hasCurrent && sentence.characterId) {
      return [
        ...activeCharacters,
        {
          id: sentence.characterId,
          canonicalName:
            sentence.character?.canonicalName || sentence.rawSpeaker || "未知角色",
          isActive: false,
        },
      ];
    }
    return activeCharacters;
  }, [
    characters,
    narrationCharacter?.id,
    sentence.characterId,
    sentence.character?.canonicalName,
    sentence.rawSpeaker,
  ]);

  const handleSave = () => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    const normalizedTone = tone.trim();
    const isNarration = characterId === narrationValue;
    const resolvedCharacterId = isNarration
      ? narrationCharacter?.id ?? null
      : characterId || null;

    onSave(sentence.id, {
      text: trimmedText,
      tone: normalizedTone,
      characterId: resolvedCharacterId,
      rawSpeaker: isNarration ? "旁白" : undefined,
      roleType: isNarration ? "narration" : "dialogue",
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑台词</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-card-foreground">台词内容</Label>
            <Textarea
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div>
            <Label className="mb-2 block text-card-foreground">角色</Label>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
            >
              <option value={narrationValue}>旁白</option>
              {availableCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.canonicalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-2 block text-card-foreground">语气</Label>
            <Input
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              placeholder="例如：平静、激动、严肃"
            />
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={!text.trim()}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
