"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Edit, Trash2, Volume2, CheckCircle, XCircle } from "lucide-react";
import { ScriptSentence } from "@/lib/types";

interface ScriptSentencesTableProps {
  segmentTitle: string;
  sentences: ScriptSentence[];
  onEdit?: (sentence: ScriptSentence) => void;
  onDelete?: (sentenceId: string) => void;
  onPlayAudio?: (sentence: ScriptSentence) => void;
  onGenerateAudio?: (sentenceId: string) => void;
}

export function ScriptSentencesTable({
  segmentTitle,
  sentences,
  onEdit,
  onDelete,
  onPlayAudio,
  onGenerateAudio,
}: ScriptSentencesTableProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayAudio = (sentence: ScriptSentence) => {
    setPlayingId(sentence.id);
    onPlayAudio?.(sentence);
    // Reset playing state after a delay (or handle in parent)
    setTimeout(() => setPlayingId(null), 3000);
  };

  return (
    <div className="border rounded-lg bg-white">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">{segmentTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">
          共 {sentences.length} 句台词
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">序号</TableHead>
              <TableHead className="w-32">角色</TableHead>
              <TableHead>台词内容</TableHead>
              <TableHead className="w-24">语气</TableHead>
              <TableHead className="w-24">音频</TableHead>
              <TableHead className="w-48">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sentences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  该段落暂无台词
                </TableCell>
              </TableRow>
            ) : (
              sentences.map((sentence, index) => {
                const hasAudio = (sentence.audioFiles?.length ?? 0) > 0;
                const audioCompleted =
                  hasAudio &&
                  sentence.audioFiles!.some((file) => file.status === "completed");

                return (
                  <TableRow key={sentence.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {sentence.orderInSegment !== undefined
                        ? sentence.orderInSegment + 1
                        : index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sentence.character?.canonicalName || sentence.rawSpeaker || "旁白"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm">{sentence.text}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sentence.tone && (
                        <Badge variant="secondary" className="text-xs">
                          {sentence.tone}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {audioCompleted ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          已生成
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          未生成
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {audioCompleted && onPlayAudio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePlayAudio(sentence)}
                            disabled={playingId === sentence.id}
                          >
                            {playingId === sentence.id ? (
                              <Volume2 className="w-3 h-3 animate-pulse" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        {!audioCompleted && onGenerateAudio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGenerateAudio(sentence.id)}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(sentence)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("确定要删除这句台词吗？")) {
                                onDelete(sentence.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
