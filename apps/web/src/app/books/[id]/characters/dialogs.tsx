"use client";

import React from "react";
import { Loader2, User, Volume2, Trash2, Mic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SpeakerBinding } from "@/hooks/useSpeakerBindings";

export function CharacterForm({
  character,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  character?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}) {
  const [formData, setFormData] = React.useState({
    name: character?.canonicalName || character?.name || "",
    description:
      (character?.characteristics as any)?.description ||
      character?.description ||
      "",
    aliases:
      character?.aliases?.map((a: { alias: string }) => a.alias).join(", ") ||
      "",
    isActive: character?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    onSubmit({
      ...formData,
      aliases: formData.aliases
        .split(",")
        .map((a: string) => a.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色名称 *
        </label>
        <input
          type="text"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="输入角色名称"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色描述
        </label>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="描述角色的性格特征、身份等"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          别名 (用逗号分隔)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.aliases}
          onChange={(e) =>
            setFormData({ ...formData, aliases: e.target.value })
          }
          placeholder="例如：小明, 少年, 主角"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={formData.isActive}
          onChange={(e) =>
            setFormData({ ...formData, isActive: e.target.checked })
          }
        />
        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
          启用此角色
        </label>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          取消
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : character ? (
            "更新"
          ) : (
            "创建"
          )}
        </Button>
      </div>
    </form>
  );
}

export function CharacterFormModal({
  open,
  character,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  character: any | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{character ? "编辑角色" : "添加角色"}</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterForm
            character={character || undefined}
            onSubmit={onSubmit}
            onCancel={onClose}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function SpeakerDialog({
  open,
  character,
  bindings,
  availableSpeakers,
  selectedSpeakerId,
  onSelectSpeaker,
  onClose,
  onAdd,
  onSetDefault,
  onRemove,
  buildPreview,
  isDialogLoading,
  isSpeakerListLoading,
  speakerActionLoading,
  updatingBindingId,
  removingBindingId,
}: {
  open: boolean
  character: any | null
  bindings: SpeakerBinding[]
  availableSpeakers: any[]
  selectedSpeakerId: string
  onSelectSpeaker: (id: string) => void
  onClose: () => void
  onAdd: () => void
  onSetDefault: (id: string) => void
  onRemove: (id: string) => void
  buildPreview: (ref?: string | null) => string[]
  isDialogLoading: boolean
  isSpeakerListLoading: boolean
  speakerActionLoading: boolean
  updatingBindingId: string | null
  removingBindingId: string | null
}) {
  if (!open || !character) return null
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>角色说话人关联</DialogTitle>
          <p className="text-sm text-gray-500">
            为 {character.canonicalName || character.name} 配置说话人
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {isDialogLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </div>
          ) : bindings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              暂无说话人关联，请添加新的说话人。
            </div>
          ) : (
            <div className="space-y-3">
              {bindings.map((binding) => (
                <div key={binding.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {binding.speakerProfile?.name || `说话人 #${binding.speakerProfile?.id}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {[
                          binding.speakerProfile?.gender || "未知",
                          binding.speakerProfile?.ageGroup,
                          binding.speakerProfile?.toneStyle,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {binding.isPreferred && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          默认说话人
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!binding.isPreferred && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSetDefault(binding.id)}
                          disabled={updatingBindingId === binding.id}
                          className="flex items-center gap-1"
                        >
                          {updatingBindingId === binding.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          设为默认
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(binding.id)}
                        disabled={removingBindingId === binding.id}
                        className="text-red-600 hover:text-red-800 flex items-center gap-1"
                      >
                        {removingBindingId === binding.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        移除
                      </Button>
                    </div>
                  </div>
                  {binding.speakerProfile?.referenceAudio ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <Volume2 className="w-3 h-3" />
                        示例音频预览
                      </p>
                      <audio controls preload="none" className="w-full">
                        {buildPreview(binding.speakerProfile.referenceAudio).map((src) => (
                          <source key={src} src={src} />
                        ))}
                        您的浏览器不支持音频播放
                      </audio>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">暂无示例音频</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              添加说话人关联
            </p>
            {isSpeakerListLoading ? (
              <div className="text-sm text-gray-500">
                <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                说话人列表加载中...
              </div>
            ) : availableSpeakers.length === 0 ? (
              <div className="text-sm text-gray-500">
                暂无说话人，请先在说话人管理页面创建。
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={selectedSpeakerId}
                    onChange={(e) => onSelectSpeaker(e.target.value)}
                  >
                    <option value="">选择说话人</option>
                    {availableSpeakers.map((speaker) => (
                      <option key={speaker.id} value={speaker.id}>
                        {speaker.name || `说话人 #${speaker.id}`} · {speaker.gender} · {speaker.ageGroup}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={onAdd}
                    disabled={speakerActionLoading || !selectedSpeakerId.length}
                    className="flex items-center justify-center gap-2"
                  >
                    {speakerActionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        添加中...
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        添加关联
                      </>
                    )}
                  </Button>
                </div>
                {selectedSpeakerId.length > 0 && (
                  <div className="mt-4 rounded-md border border-dashed border-gray-200 p-3 space-y-2">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      {availableSpeakers.find((s) => String(s.id) === selectedSpeakerId)?.name ||
                        `说话人 #${selectedSpeakerId}`}
                      <span className="text-xs text-gray-500 font-normal">示例音频</span>
                    </div>
                    {availableSpeakers.find((s) => String(s.id) === selectedSpeakerId)?.referenceAudio ? (
                      <audio controls preload="none" className="w-full">
                        {buildPreview(
                          availableSpeakers.find((s) => String(s.id) === selectedSpeakerId)?.referenceAudio
                        ).map((src) => (
                          <source key={src} src={src} />
                        ))}
                        您的浏览器不支持音频播放
                      </audio>
                    ) : (
                      <p className="text-xs text-gray-500">该说话人暂无示例音频</p>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-gray-500 mt-2">
              说话人数据来源于说话人管理页面，可随时前往 /tts/speakers 页面进行维护。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
