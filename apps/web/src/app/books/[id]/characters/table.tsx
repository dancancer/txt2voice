'use client'

import { Edit, Trash2, Volume2, Settings, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CharacterProfileSummary } from "@/types/book";

export function CharactersTable({
  characters,
  onEdit,
  onDelete,
  onConfigSpeaker,
  onAudioSettings,
  deletingId,
}: {
  characters: CharacterProfileSummary[];
  onEdit: (c: CharacterProfileSummary) => void;
  onDelete: (id: string) => void;
  onConfigSpeaker: (c: CharacterProfileSummary) => void;
  onAudioSettings: (c: CharacterProfileSummary) => void;
  deletingId?: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">角色名称</TableHead>
                <TableHead className="min-w-[80px]">性别</TableHead>
                <TableHead className="min-w-[100px]">台词数</TableHead>
                <TableHead className="min-w-[100px]">提及数</TableHead>
                <TableHead className="min-w-[100px]">引用数</TableHead>
                <TableHead className="min-w-[80px]">别名数</TableHead>
                <TableHead className="min-w-[140px]">说话人</TableHead>
                <TableHead className="min-w-[120px]">语音配置</TableHead>
                <TableHead className="min-w-[80px]">状态</TableHead>
                <TableHead className="min-w-[150px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {characters.map((character) => {
                const defaultSpeaker =
                  character.speakerBindings?.find(
                    (binding: any) => binding.isPreferred || binding.isDefault
                  ) || character.speakerBindings?.[0];
                return (
                  <TableRow key={character.id}>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="font-medium text-gray-900 truncate">
                          {character.canonicalName || character.name}
                        </div>
                        {(character as any).characteristics?.description && (
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {(character as any).characteristics?.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm inline-block">
                        {character.genderHint === "unknown"
                          ? "未知"
                          : character.genderHint === "male"
                          ? "男"
                          : character.genderHint === "female"
                          ? "女"
                          : character.genderHint}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-blue-600 inline-block">
                        {character._count?.scriptSentences || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600 inline-block">
                        {(character as any).mentions ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-orange-600 inline-block">
                        {(character as any).quotes ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 inline-block">
                        {(character as any).aliases?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex flex-col gap-1">
                        {character.speakerBindings?.length ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-indigo-600">
                                {defaultSpeaker?.speakerProfile?.name ||
                                  `说话人 #${defaultSpeaker?.speakerProfile?.id}`}
                              </span>
                              {(defaultSpeaker as any)?.isPreferred || (defaultSpeaker as any)?.isDefault ? (
                                <Badge variant="secondary" className="text-xs">
                                  默认
                                </Badge>
                              ) : null}
                            </div>
                            {character.speakerBindings.length > 1 && (
                              <span className="text-xs text-gray-500">
                                共 {character.speakerBindings.length} 个
                              </span>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            未关联
                          </Badge>
                        )}
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 text-indigo-600 hover:text-indigo-500"
                          onClick={() => onConfigSpeaker(character)}
                        >
                          <Mic className="w-3 h-3 mr-1" />
                          配置说话人
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-block">
                        {(character as any).voiceBindings?.length ? (
                          <Badge variant="outline" className="text-green-600">
                            <Volume2 className="w-3 h-3 mr-1" />
                            已配置
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <Settings className="w-3 h-3 mr-1" />
                            未配置
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-block">
                        <Badge variant={character.isActive ? "default" : "secondary"}>
                          {character.isActive ? "启用" : "禁用"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 min-w-[140px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onConfigSpeaker(character)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Mic className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(character)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAudioSettings(character)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(character.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 flex-shrink-0"
                          disabled={deletingId === character.id}
                        >
                          {deletingId === character.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
