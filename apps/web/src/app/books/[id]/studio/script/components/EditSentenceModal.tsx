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
  bookId?: string;
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
      strength?: number;
      pauseAfter?: number;
      prosody?: {
        pace?: number;
        pitch?: number;
        energy?: number;
        pauseMsAfter?: number;
      };
    }
  ) => void;
}

const normalizeOptionalText = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOptionalNumber = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function EditSentenceModal({
  bookId,
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
  const [strength, setStrength] = useState(
    typeof sentence.strength === "number" ? `${sentence.strength}` : ""
  );
  const [pauseAfter, setPauseAfter] = useState(
    typeof sentence.pauseAfter === "number" ? `${sentence.pauseAfter}` : ""
  );
  const [pace, setPace] = useState(
    typeof sentence.prosody?.pace === "number" ? `${sentence.prosody.pace}` : ""
  );
  const [pitch, setPitch] = useState(
    typeof sentence.prosody?.pitch === "number" ? `${sentence.prosody.pitch}` : ""
  );
  const [energy, setEnergy] = useState(
    typeof sentence.prosody?.energy === "number"
      ? `${sentence.prosody.energy}`
      : ""
  );
  const [pauseMsAfter, setPauseMsAfter] = useState(
    typeof sentence.prosody?.pauseMsAfter === "number"
      ? `${sentence.prosody.pauseMsAfter}`
      : ""
  );
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

    const normalizedTone = normalizeOptionalText(tone);
    const normalizedStrength = normalizeOptionalNumber(strength);
    const normalizedPauseAfter = normalizeOptionalNumber(pauseAfter);
    const normalizedPace = normalizeOptionalNumber(pace);
    const normalizedPitch = normalizeOptionalNumber(pitch);
    const normalizedEnergy = normalizeOptionalNumber(energy);
    const normalizedPauseMsAfter = normalizeOptionalNumber(pauseMsAfter);
    const normalizedProsody =
      normalizedPace !== undefined ||
      normalizedPitch !== undefined ||
      normalizedEnergy !== undefined ||
      normalizedPauseMsAfter !== undefined
        ? {
            ...(normalizedPace !== undefined ? { pace: normalizedPace } : {}),
            ...(normalizedPitch !== undefined ? { pitch: normalizedPitch } : {}),
            ...(normalizedEnergy !== undefined ? { energy: normalizedEnergy } : {}),
            ...(normalizedPauseMsAfter !== undefined
              ? { pauseMsAfter: normalizedPauseMsAfter }
              : {}),
          }
        : undefined;
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
      strength: normalizedStrength,
      pauseAfter: normalizedPauseAfter,
      prosody: normalizedProsody,
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
            {availableCharacters.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                当前没有可用角色，建议先前往角色配置页创建或同步角色。
              </p>
            ) : null}
            {bookId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/books/${bookId}/characters`}
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  前往角色配置
                </a>
                {!sentence.characterId && sentence.rawSpeaker ? (
                  <span className="inline-flex min-h-9 items-center rounded-md border border-orange-300 bg-orange-50 px-3 text-xs text-orange-800">
                    当前句原始说话人：{sentence.rawSpeaker}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div>
            <Label className="mb-2 block text-card-foreground">语气</Label>
            <Input
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              placeholder="例如：平静、激动、严肃"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">朗读参数</h3>
              <p className="text-xs text-muted-foreground">
                控制语音强弱、停顿和语调节奏。留空表示沿用自动推断。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-2 block text-card-foreground">强度</Label>
                <Input
                  value={strength}
                  onChange={(event) => setStrength(event.target.value)}
                  placeholder="0-100"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-2 block text-card-foreground">
                  句末停顿（秒）
                </Label>
                <Input
                  value={pauseAfter}
                  onChange={(event) => setPauseAfter(event.target.value)}
                  placeholder="例如：1.5"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-2 block text-card-foreground">语速</Label>
                <Input
                  value={pace}
                  onChange={(event) => setPace(event.target.value)}
                  placeholder="例如：0.95"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-2 block text-card-foreground">音高</Label>
                <Input
                  value={pitch}
                  onChange={(event) => setPitch(event.target.value)}
                  placeholder="例如：-0.10"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-2 block text-card-foreground">能量</Label>
                <Input
                  value={energy}
                  onChange={(event) => setEnergy(event.target.value)}
                  placeholder="例如：0.42"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-2 block text-card-foreground">
                  额外尾停（毫秒）
                </Label>
                <Input
                  value={pauseMsAfter}
                  onChange={(event) => setPauseMsAfter(event.target.value)}
                  placeholder="例如：1000"
                  inputMode="numeric"
                />
              </div>
            </div>
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
