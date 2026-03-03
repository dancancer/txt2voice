// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 音频生成配置卡片
// pos: 共享组件
"use client";

import {
  AlertCircle,
  Loader2,
  Mic,
  Settings,
  User,
  Users,
  Volume2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CharacterProfileSummary } from "@/types/book";
import type { ProviderInfo, VoiceProfile } from "@/hooks/useAudioGeneration";

type ProviderSelectionProps = {
  providers: ProviderInfo[];
  selected: string;
  onSelect: (val: string) => void;
};

export function ProviderSelectionCard({
  providers,
  selected,
  onSelect,
}: ProviderSelectionProps) {
  const available = providers.filter((provider) => provider.isAvailable);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mic className="mr-2 h-5 w-5" />
          语音提供商
        </CardTitle>
      </CardHeader>
      <CardContent>
        {available.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {available.map((provider) => (
              <button
                type="button"
                key={provider.type}
                className={`min-h-11 rounded-lg border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  selected === provider.type
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => onSelect(provider.type)}
                aria-pressed={selected === provider.type}
              >
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Mic className="h-4 w-4" />
                </div>
                <h4 className="font-medium text-gray-900">{provider.name}</h4>
                <p className="mt-1 text-sm text-gray-600">{provider.type}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">未配置语音服务</h3>
            <p className="text-gray-600">请在环境变量中配置至少一个语音服务提供商</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type CharacterVoicesProps = {
  characters: CharacterProfileSummary[];
  voices: VoiceProfile[];
  characterVoices: Record<string, string>;
  showConfig: boolean;
  onToggleConfig: () => void;
  onVoiceChange: (id: string, voiceId: string) => void;
  onPersist: () => Promise<void>;
  isSaving: boolean;
  missingCount: number;
};

export function CharacterVoicesCard({
  characters,
  voices,
  characterVoices,
  showConfig,
  onToggleConfig,
  onVoiceChange,
  onPersist,
  isSaving,
  missingCount,
}: CharacterVoicesProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            角色语音配置
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleConfig} className="min-h-11">
            <Settings className="mr-2 h-4 w-4" />
            {showConfig ? "收起" : "配置"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {characters.length > 0 ? (
          <div className="space-y-4">
            {characters
              .filter((character) => character.isActive !== false)
              .map((character) => (
                <div
                  key={character.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{character.canonicalName}</h4>
                      <p className="text-sm text-gray-500">
                        {character.scriptSentencesCount ?? 0} 句台词
                      </p>
                    </div>
                  </div>
                  {showConfig ? (
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:w-72"
                      value={characterVoices[character.id] || ""}
                      onChange={(event) => onVoiceChange(character.id, event.target.value)}
                    >
                      <option value="">选择语音</option>
                      {voices.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.displayName || profile.name} ({profile.provider})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {characterVoices[character.id] ? (
                        <>
                          <Volume2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">已配置</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-600">未配置</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

            {showConfig && (
              <div className="flex justify-end pt-4">
                <Button onClick={onPersist} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存配置
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">暂无角色配置</h3>
            <p className="text-gray-600">先创建角色配置后再生成音频</p>
          </div>
        )}

        {missingCount > 0 && (
          <p className="mt-4 text-sm text-amber-600">还有 {missingCount} 个角色未绑定声音。</p>
        )}
      </CardContent>
    </Card>
  );
}

type AudioSettingsProps = {
  batchSize: number;
  skipExisting: boolean;
  overwriteExisting: boolean;
  autoMerge: boolean;
  onChange: (next: {
    batchSize?: number;
    skipExisting?: boolean;
    overwriteExisting?: boolean;
    autoMerge?: boolean;
  }) => void;
};

export function AudioSettingsCard({
  batchSize,
  skipExisting,
  overwriteExisting,
  autoMerge,
  onChange,
}: AudioSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          音频设置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">批次大小: {batchSize}</label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={batchSize}
              onChange={(event) => onChange({ batchSize: Number(event.target.value) })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">重用已有音频</label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(event) => onChange({ skipExisting: event.target.checked })}
              />
              <span className="text-sm text-gray-600">跳过已有音频</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(event) => onChange({ overwriteExisting: event.target.checked })}
              />
              <span className="text-sm text-gray-600">覆盖已有音频</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoMerge}
              onChange={(event) => onChange({ autoMerge: event.target.checked })}
            />
            <span className="text-sm text-gray-600">生成后自动合并章节/整书音频</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
