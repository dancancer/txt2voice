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
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Volume2 className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <p className="mb-4 text-destructive">{error || '书籍不存在'}</p>
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
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-background shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex w-full min-w-0 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-3 min-h-11 min-w-11 sm:mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">音频生成</h1>
                <p className="truncate text-sm text-muted-foreground">{book.title}</p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
              <Badge variant="secondary" className="whitespace-nowrap">
                {totalAudioFiles} 个音频文件
              </Badge>
              <Button
                variant="outline"
                onClick={() => router.push(`/books/${bookId}/play`)}
                disabled={totalAudioFiles === 0}
                className="min-h-11"
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
