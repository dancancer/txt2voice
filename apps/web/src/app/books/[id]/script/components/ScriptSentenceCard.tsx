import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Edit, Trash2 } from "lucide-react";
import { ScriptSentence } from "./types";

interface ScriptSentenceCardProps {
  sentence: ScriptSentence;
  index: number;
  onEdit: (sentence: ScriptSentence) => void;
  onDelete: (sentenceId: string) => void;
}

export function ScriptSentenceCard({
  sentence,
  index,
  onEdit,
  onDelete,
}: ScriptSentenceCardProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-500">
            #{index + 1}
          </span>
          {sentence.character && (
            <Badge variant="outline">
              <User className="w-3 h-3 mr-1" />
              {sentence.character.name}
            </Badge>
          )}
          {sentence.emotion && (
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 border-purple-300"
            >
              {sentence.emotion}
            </Badge>
          )}
          <span className="text-xs text-gray-500">
            段落{" "}
            {sentence.segment?.orderIndex
              ? sentence.segment.orderIndex + 1
              : sentence.orderInSegment + 1}
          </span>
        </div>
        <p className="text-gray-900">{sentence.text}</p>
      </div>
      <div className="flex space-x-1 ml-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(sentence)}
          title="编辑台词"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(sentence.id)}
          className="text-red-600 hover:text-red-800 hover:bg-red-50"
          title="删除台词"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
