// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
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
                const isSystemRole = character.isSystemRole === true;
                const defaultSpeaker =
                  character.speakerBindings?.find(
                    (binding: any) => binding.isPreferred || binding.isDefault
                  ) || character.speakerBindings?.[0];
                return (
                  <TableRow key={character.id}>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium text-foreground">
                            {character.canonicalName}
                          </div>
                          {isSystemRole ? (
                            <Badge variant="secondary" className="text-xs">
                              系统
                            </Badge>
                          ) : null}
                        </div>
                        {(character as any).characteristics?.description && (
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
                      <span className="inline-block font-medium text-primary">
                        {character.scriptSentencesCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block font-medium text-foreground">
                        {(character as any).mentions ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block font-medium text-foreground">
                        {(character as any).quotes ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block text-sm text-muted-foreground">
                        {(character as any).aliases?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex flex-col gap-1">
                        {character.speakerBindings?.length ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
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
                              <span className="text-xs text-muted-foreground">
                                共 {character.speakerBindings.length} 个
                              </span>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            未关联
                          </Badge>
                        )}
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 text-primary hover:text-primary/80"
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
                          <Badge variant="outline" className="text-primary">
                            <Volume2 className="w-3 h-3 mr-1" />
                            已配置
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
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
                          className="min-h-11 min-w-11 p-0 flex-shrink-0"
                        >
                          <Mic className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(character)}
                          className="min-h-11 min-w-11 p-0 flex-shrink-0"
                          disabled={isSystemRole}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAudioSettings(character)}
                          className="min-h-11 min-w-11 p-0 flex-shrink-0"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(character.id)}
                          className="min-h-11 min-w-11 flex-shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={isSystemRole || deletingId === character.id}
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
