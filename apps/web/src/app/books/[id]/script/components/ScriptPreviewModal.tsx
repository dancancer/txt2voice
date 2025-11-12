import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptSentence } from "./types";

interface ScriptPreviewModalProps {
  scriptSentences: ScriptSentence[];
  onClose: () => void;
}

export function ScriptPreviewModal({
  scriptSentences,
  onClose,
}: ScriptPreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>台本预览</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {scriptSentences.map((sentence, index) => (
              <div
                key={sentence.id}
                className="border-l-4 border-blue-500 pl-4"
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium text-gray-500">
                    #{index + 1}
                  </span>
                  {sentence.character && (
                    <Badge variant="outline">{sentence.character.name}</Badge>
                  )}
                  {sentence.emotion && (
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-700 border-purple-300"
                    >
                      {sentence.emotion}
                    </Badge>
                  )}
                </div>
                <p className="text-gray-900">{sentence.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
