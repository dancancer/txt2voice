// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
'use client'

import {
  AlertCircle,
  CheckCircle,
  Mic,
  Play,
  Settings,
  Users,
  Volume2,
  Zap,
  FileText,
  Loader2,
  User
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { CharacterProfileSummary } from '@/types/book'
import type { GenerationState, ProviderInfo, VoiceProfile } from '@/hooks/useAudioGeneration'

type ProviderSelectionProps = {
  providers: ProviderInfo[]
  selected: string
  onSelect: (val: string) => void
}

export function ProviderSelectionCard({ providers, selected, onSelect }: ProviderSelectionProps) {
  const available = providers.filter(p => p.isAvailable)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mic className="w-5 h-5 mr-2" />
          语音提供商
        </CardTitle>
      </CardHeader>
      <CardContent>
        {available.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {available.map((provider) => (
              <div
                key={provider.type}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selected === provider.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSelect(provider.type)}
              >
                <div className="text-2xl mb-2">🎙️</div>
                <h4 className="font-medium text-gray-900">{provider.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{provider.type}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              未配置语音服务
            </h3>
            <p className="text-gray-600">
              请在环境变量中配置至少一个语音服务提供商
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type CharacterVoicesProps = {
  characters: CharacterProfileSummary[]
  voices: VoiceProfile[]
  characterVoices: Record<string, string>
  showConfig: boolean
  onToggleConfig: () => void
  onVoiceChange: (id: string, voiceId: string) => void
  onPersist: () => Promise<void>
  isSaving: boolean
  missingCount: number
}

export function CharacterVoicesCard({
  characters,
  voices,
  characterVoices,
  showConfig,
  onToggleConfig,
  onVoiceChange,
  onPersist,
  isSaving,
  missingCount
}: CharacterVoicesProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            角色语音配置
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleConfig}
          >
            <Settings className="w-4 h-4 mr-2" />
            {showConfig ? '收起' : '配置'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {characters.length > 0 ? (
          <div className="space-y-4">
            {characters
              .filter(char => char.isActive !== false)
              .map((character) => (
                <div key={character.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{character.canonicalName}</h4>
                      <p className="text-sm text-gray-500">
                        {(character.scriptSentencesCount ?? 0)} 句台词
                      </p>
                    </div>
                  </div>
                  {showConfig ? (
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={characterVoices[character.id] || ''}
                      onChange={(e) => onVoiceChange(character.id, e.target.value)}
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
                          <Volume2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600">已配置</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
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
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  保存配置
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              暂无角色配置
            </h3>
            <p className="text-gray-600">
              先创建角色配置后再生成音频
            </p>
          </div>
        )}
        {missingCount > 0 && (
          <p className="text-sm text-amber-600 mt-4">
            还有 {missingCount} 个角色未绑定声音。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

type AudioSettingsProps = {
  batchSize: number
  skipExisting: boolean
  overwriteExisting: boolean
  autoMerge: boolean
  onChange: (next: { batchSize?: number; skipExisting?: boolean; overwriteExisting?: boolean; autoMerge?: boolean }) => void
}

export function AudioSettingsCard({
  batchSize,
  skipExisting,
  overwriteExisting,
  autoMerge,
  onChange
}: AudioSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          音频设置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              批次大小: {batchSize}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={batchSize}
              onChange={(e) => onChange({ batchSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              重用已有音频
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => onChange({ skipExisting: e.target.checked })}
              />
              <span className="text-sm text-gray-600">跳过已有音频</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => onChange({ overwriteExisting: e.target.checked })}
              />
              <span className="text-sm text-gray-600">覆盖已有音频</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoMerge}
              onChange={(e) => onChange({ autoMerge: e.target.checked })}
            />
            <span className="text-sm text-gray-600">生成后自动合并章节/整书音频</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type GenerationStatusProps = {
  state: GenerationState
  isGenerating: boolean
  onGoPlay?: () => void
}

export function GenerationStatusCard({ state, isGenerating, onGoPlay }: GenerationStatusProps) {
  const icon = isGenerating
    ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    : state.status === 'failed'
    ? <AlertCircle className="w-6 h-6 text-red-600" />
    : state.status === 'completed'
    ? <CheckCircle className="w-6 h-6 text-green-600" />
    : <Volume2 className="w-6 h-6 text-blue-600" />

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          {icon}
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {state.message || '音频生成状态'}
            </p>
            {(isGenerating || state.status === 'processing' || state.status === 'in_progress') && (
              <Progress value={state.progress} className="mt-2" />
            )}
          </div>
          {!isGenerating && state.status === 'completed' && onGoPlay && (
            <Button onClick={onGoPlay} size="sm">
              <Play className="w-4 h-4 mr-2" />
              立即播放
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type SidebarStatusProps = {
  textSegments: number
  activeCharacters: number
  audioFiles: number
}

export function SidebarStatusCard({
  textSegments,
  activeCharacters,
  audioFiles
}: SidebarStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>生成状态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">文本段落</span>
            <Badge variant="outline">{textSegments}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">角色配置</span>
            <Badge variant="outline">{activeCharacters}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">已生成音频</span>
            <Badge variant="outline">{audioFiles}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">待生成</span>
            <Badge variant="outline">
              {Math.max(0, textSegments - audioFiles)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type SidebarActionsProps = {
  onGenerate: () => void
  isGenerating: boolean
  canGenerate: boolean
  onGoPlay: () => void
  onGoBook: () => void
  onGoCharacters: () => void
  hasAudio: boolean
}

export function SidebarActionsCard({
  onGenerate,
  isGenerating,
  canGenerate,
  onGoPlay,
  onGoBook,
  onGoCharacters,
  hasAudio
}: SidebarActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>操作</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              生成音频
            </>
          )}
        </Button>

        {hasAudio && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onGoPlay}
          >
            <Play className="w-4 h-4 mr-2" />
            播放音频
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={onGoBook}
        >
          <FileText className="w-4 h-4 mr-2" />
          返回书籍
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={onGoCharacters}
        >
          <User className="w-4 h-4 mr-2" />
          管理角色
        </Button>
      </CardContent>
    </Card>
  )
}

export function TipsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>提示</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>为每个角色配置不同的语音，让有声读物更加生动</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>支持批量生成，长文本可适当提高批次大小</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>生成完成后可选择自动合并章节或整书音频</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
