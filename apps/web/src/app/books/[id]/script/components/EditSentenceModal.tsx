import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScriptSentence } from "./types";

interface EditSentenceModalProps {
  sentence: ScriptSentence;
  onClose: () => void;
  onSave: (sentenceId: string, newText: string) => void;
}

export function EditSentenceModal({
  sentence,
  onClose,
  onSave,
}: EditSentenceModalProps) {
  const handleSave = () => {
    const newText = (
      document.getElementById("edit-sentence-text") as HTMLTextAreaElement
    ).value;
    onSave(sentence.id, newText);
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
                defaultValue={sentence.text}
                id="edit-sentence-text"
              />
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button onClick={handleSave} className="flex-1">
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
