import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { User, Settings } from "lucide-react";
import { ScriptSentence, CharacterProfile } from "./types";

interface CharacterAssignmentProps {
  scriptSentences: ScriptSentence[];
  characters: CharacterProfile[];
  showCharacterAssignment: boolean;
  onToggleAssignment: () => void;
  onSentenceCharacterChange: (sentenceId: string, characterId: string) => void;
  onSaveAssignment: () => void;
}

export function CharacterAssignment({
  scriptSentences,
  characters,
  showCharacterAssignment,
  onToggleAssignment,
  onSentenceCharacterChange,
  onSaveAssignment,
}: CharacterAssignmentProps) {
  const assignedCount = scriptSentences.filter(
    (s) => s.character && s.character.id
  ).length;
  const assignmentProgress =
    scriptSentences.length > 0
      ? (assignedCount / scriptSentences.length) * 100
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            角色分配
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleAssignment}>
            <Settings className="w-4 h-4 mr-2" />
            {showCharacterAssignment ? "收起" : "配置"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">已分配角色</span>
            <span className="font-medium">
              {assignedCount} / {scriptSentences.length}
            </span>
          </div>
          <Progress value={assignmentProgress} className="mt-2" />
        </div>

        {showCharacterAssignment && (
          <div className="space-y-4">
            {scriptSentences.slice(0, 10).map((sentence) => (
              <div
                key={sentence.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {sentence.text}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    段落{" "}
                    {sentence.segment?.orderIndex
                      ? sentence.segment.orderIndex + 1
                      : sentence.orderInSegment + 1}
                  </p>
                </div>
                <select
                  className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={sentence.characterId || ""}
                  onChange={(e) =>
                    onSentenceCharacterChange(sentence.id, e.target.value)
                  }
                >
                  <option value="">选择角色</option>
                  <option value="">旁白</option>
                  {characters
                    .filter((c) => c.isActive)
                    .map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.canonicalName}
                      </option>
                    ))}
                </select>
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <Button onClick={onSaveAssignment}>保存分配</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
