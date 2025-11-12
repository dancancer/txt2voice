"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScriptSentence } from "./types";
import { ScriptSentenceCard } from "./ScriptSentenceCard";

interface ScriptSentencesListProps {
  scriptSentences: ScriptSentence[];
  onEdit: (sentence: ScriptSentence) => void;
  onDelete: (sentenceId: string) => void;
}

export function ScriptSentencesList({
  scriptSentences,
  onEdit,
  onDelete,
}: ScriptSentencesListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>台词列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {scriptSentences.map((sentence, index) => {
            console.log("=========>sentence: ", sentence);
            return (
              <ScriptSentenceCard
                key={sentence.id}
                sentence={sentence}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
