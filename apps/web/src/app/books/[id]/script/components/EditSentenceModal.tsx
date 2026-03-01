// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    }
  ) => void;
}

export function EditSentenceModal({
  sentence,
  characters,
  onClose,
  onSave,
}: EditSentenceModalProps) {
  const narrationValue = "__narration__";
  const [text, setText] = useState(sentence.text);
  const [tone, setTone] = useState(sentence.tone ?? "");
  const [characterId, setCharacterId] = useState(
    sentence.characterId ?? narrationValue
  );

  const availableCharacters = useMemo(() => {
    const activeCharacters = characters.filter((c) => c.isActive !== false);
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
  }, [characters, sentence.characterId, sentence.character?.canonicalName, sentence.rawSpeaker]);

  const handleSave = () => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    const normalizedTone = tone.trim();
    const resolvedCharacterId =
      characterId === narrationValue ? null : characterId;

    onSave(sentence.id, {
      text: trimmedText,
      tone: normalizedTone,
      characterId: resolvedCharacterId,
      rawSpeaker: resolvedCharacterId ? undefined : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>编辑台词</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                台词内容
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={characterId}
                onChange={(event) => setCharacterId(event.target.value)}
              >
                <option value={narrationValue}>旁白</option>
                {availableCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.canonicalName || character.name || "未命名角色"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                语气
              </label>
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
        </CardContent>
      </Card>
    </div>
  );
}
