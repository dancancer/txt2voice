// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client"

import { useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Volume2 } from 'lucide-react'
import { GenerationStatusCard, ProviderSelectionCard, CharacterVoicesCard, AudioSettingsCard, SidebarStatusCard, SidebarActionsCard, TipsCard } from './components'
import { useAudioGeneration } from '@/hooks/useAudioGeneration'

const getStatCount = (
  book: any,
  key: 'segmentsCount' | 'audioFilesCount'
) =>
  key === 'segmentsCount'
    ? book?.counts?.segments ?? book?.totalSegments ?? 0
    : book?.counts?.audioFiles ?? 0

export default function AudioGenerationPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  const {
    book,
    characters,
    availableVoices,
    providers,
    selectedProvider,
    setSelectedProvider,
    loading,
    error,
    characterVoices,
    setCharacterVoices,
    showVoiceConfig,
    setShowVoiceConfig,
    isSavingVoices,
    missingVoiceCharacters,
    persistVoiceConfiguration,
    generationState,
    isGenerating,
    startGeneration,
    audioSettings,
    setAudioSettings
  } = useAudioGeneration(bookId)

  const handlePersistVoices = useCallback(async () => {
    await persistVoiceConfiguration()
  }, [persistVoiceConfiguration])

  const filteredVoices = useMemo(
    () => availableVoices.filter(voice => !selectedProvider || voice.provider === selectedProvider),
    [availableVoices, selectedProvider]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Volume2 className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || '书籍不存在'}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    )
  }

  const handleVoiceChange = (id: string, voiceId: string) => {
    setCharacterVoices(prev => ({ ...prev, [id]: voiceId }))
  }

  const handleSettingsChange = (next: { batchSize?: number; skipExisting?: boolean; overwriteExisting?: boolean; autoMerge?: boolean }) => {
    setAudioSettings({
      ...audioSettings,
      ...next
    })
  }

  const activeCharacters = characters.filter(c => c.isActive !== false)
  const totalSegments = getStatCount(book, 'segmentsCount')
  const totalAudioFiles = getStatCount(book, 'audioFilesCount')
  const canGenerate = !isGenerating && providers.some(p => p.isAvailable) && totalSegments > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">音频生成</h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {totalAudioFiles} 个音频文件
              </Badge>
              <Button
                variant="outline"
                onClick={() => router.push(`/books/${bookId}/play`)}
                disabled={totalAudioFiles === 0}
              >
                播放音频
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GenerationStatusCard
          state={generationState}
          isGenerating={isGenerating}
          onGoPlay={() => router.push(`/books/${bookId}/play`)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ProviderSelectionCard
              providers={providers}
              selected={selectedProvider}
              onSelect={setSelectedProvider}
            />

            <CharacterVoicesCard
              characters={activeCharacters}
              voices={filteredVoices}
              characterVoices={characterVoices}
              showConfig={showVoiceConfig}
              onToggleConfig={() => setShowVoiceConfig(!showVoiceConfig)}
              onVoiceChange={handleVoiceChange}
              onPersist={handlePersistVoices}
              isSaving={isSavingVoices}
              missingCount={missingVoiceCharacters.length}
            />

            <AudioSettingsCard
              batchSize={audioSettings.batchSize}
              skipExisting={audioSettings.skipExisting}
              overwriteExisting={audioSettings.overwriteExisting}
              autoMerge={audioSettings.autoMerge}
              onChange={handleSettingsChange}
            />
          </div>

          <div className="space-y-6">
            <SidebarStatusCard
              textSegments={totalSegments}
              activeCharacters={activeCharacters.length}
              audioFiles={totalAudioFiles}
            />
            <SidebarActionsCard
              onGenerate={startGeneration}
              isGenerating={isGenerating}
              canGenerate={canGenerate}
              onGoPlay={() => router.push(`/books/${bookId}/play`)}
              onGoBook={() => router.push(`/books/${bookId}`)}
              onGoCharacters={() => router.push(`/books/${bookId}/characters`)}
              hasAudio={totalAudioFiles > 0}
            />
            <TipsCard />
          </div>
        </div>
      </div>
    </div>
  )
}
