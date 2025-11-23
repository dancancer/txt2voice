import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { booksApi } from '@/lib/api'
import type { Book, CharacterProfileSummary } from '@/types/book'

export type VoiceProfile = {
  id: string
  name: string
  displayName?: string
  provider: string
  language?: string
  gender?: string
  isCustom?: boolean
  isAvailable?: boolean
}

export type ProviderInfo = {
  type: string
  name: string
  isAvailable: boolean
}

export type GenerationState = {
  status: string
  progress: number
  message?: string | null
  lastGenerated?: string | null
  audioCount?: number
}

type AudioSettings = {
  batchSize: number
  skipExisting: boolean
  overwriteExisting: boolean
  autoMerge: boolean
}

const ACTIVE_GENERATION = new Set(['processing', 'in_progress'])

const getDefaultVoiceId = (character: CharacterProfileSummary): string => {
  const defaultBinding = character.voiceBindings?.find(b => b.isDefault) || character.voiceBindings?.[0]
  return defaultBinding?.voiceProfile?.id || ''
}

export function useAudioGeneration(bookId: string) {
  const [book, setBook] = useState<Book | null>(null)
  const [characters, setCharacters] = useState<CharacterProfileSummary[]>([])
  const [availableVoices, setAvailableVoices] = useState<VoiceProfile[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({})
  const [showVoiceConfig, setShowVoiceConfig] = useState(false)
  const [isSavingVoices, setIsSavingVoices] = useState(false)

  const [generationState, setGenerationState] = useState<GenerationState>({
    status: 'not_started',
    progress: 0
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    batchSize: 5,
    skipExisting: true,
    overwriteExisting: false,
    autoMerge: true
  })

  const clearTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const loadBook = useCallback(async () => {
    const response = await booksApi.getBook(bookId)
    setBook(response.data)
  }, [bookId])

  const loadGenerationStatus = useCallback(
    async (shouldPoll = false) => {
      const statusResponse = await booksApi.getAudioGenerationStatus(bookId)
      const payload = statusResponse.data
      const nextState: GenerationState = {
        status: payload.generationStatus || 'not_started',
        progress: payload.generationProgress || 0,
        message: payload.latestMessage,
        lastGenerated: payload.lastGenerated,
        audioCount: payload.audioCount
      }
      setGenerationState(nextState)
      setBook(prev => (prev ? { ...prev, status: payload.bookStatus } : prev))

      const stillGenerating =
        payload.bookStatus === 'generating_audio' ||
        ACTIVE_GENERATION.has(nextState.status)

      if (shouldPoll && stillGenerating) {
        pollTimerRef.current = setTimeout(() => loadGenerationStatus(true), 2500)
      } else {
        setIsGenerating(false)
      }
    },
    [bookId]
  )

  const loadProviders = useCallback(async () => {
    const response = await fetch('/api/tts/providers')
    if (!response.ok) {
      throw new Error('获取 TTS 提供商失败')
    }
    const data = await response.json()
    const providerList: ProviderInfo[] = data.data?.providers || []
    setProviders(providerList)
    if (!selectedProvider && providerList.length > 0) {
      const first = providerList.find(p => p.isAvailable) || providerList[0]
      setSelectedProvider(first.type)
    }
  }, [selectedProvider])

  const loadVoices = useCallback(async () => {
    const response = await fetch('/api/tts/voices?includeCustom=true')
    if (!response.ok) {
      throw new Error('获取语音列表失败')
    }
    const data = await response.json()
    setAvailableVoices(data.data?.voices || [])
  }, [])

  const loadCharacters = useCallback(async () => {
    const response = await fetch(`/api/books/${bookId}/characters?limit=200`)
    if (!response.ok) {
      throw new Error('加载角色失败')
    }
    const data = await response.json()
    const items: CharacterProfileSummary[] = data.data?.data || []
    setCharacters(items)

    const initialVoices = items.reduce((acc, character) => {
      acc[character.id] = getDefaultVoiceId(character)
      return acc
    }, {} as Record<string, string>)
    setCharacterVoices(initialVoices)
  }, [bookId])

  const initialize = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      await Promise.all([
        loadBook(),
        loadCharacters(),
        loadVoices(),
        loadProviders(),
        loadGenerationStatus(false)
      ])
    } catch (err) {
      console.error('Failed to load audio page data:', err)
      setError(err instanceof Error ? err.message : '加载音频配置失败')
    } finally {
      setLoading(false)
    }
  }, [loadBook, loadCharacters, loadVoices, loadProviders, loadGenerationStatus])

  useEffect(() => {
    initialize()
    return () => clearTimer()
  }, [initialize, clearTimer])

  const missingVoiceCharacters = useMemo(
    () =>
      characters.filter(
        (character) =>
          character.isActive !== false &&
          !(characterVoices[character.id] || getDefaultVoiceId(character))
      ),
    [characters, characterVoices]
  )

  const persistVoiceConfiguration = useCallback(async () => {
    setIsSavingVoices(true)
    try {
      for (const character of characters) {
        const selectedVoiceId = characterVoices[character.id]
        if (!selectedVoiceId) continue

        const bindings = character.voiceBindings || []
        const defaultBinding = bindings.find(b => b.isDefault) || bindings[0]
        if (defaultBinding?.voiceProfile?.id === selectedVoiceId) {
          continue
        }

        const existingBinding = bindings.find(b => b.voiceProfile?.id === selectedVoiceId)
        if (existingBinding) {
          const response = await fetch(
            `/api/books/${bookId}/characters/${character.id}/voices`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bindingId: existingBinding.id,
                updates: { isPreferred: true }
              })
            }
          )
          if (!response.ok) {
            const result = await response.json().catch(() => null)
            throw new Error(result?.error?.message || '设置默认声音失败')
          }
        } else {
          const response = await fetch(
            `/api/books/${bookId}/characters/${character.id}/voices`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                voiceProfileId: selectedVoiceId,
                isPreferred: true
              })
            }
          )
          if (!response.ok) {
            const result = await response.json().catch(() => null)
            throw new Error(result?.error?.message || '绑定声音失败')
          }
        }
      }
      await loadCharacters()
      toast.success('语音配置已保存')
      return true
    } catch (err) {
      console.error('Failed to persist voice configuration:', err)
      toast.error(err instanceof Error ? err.message : '保存语音配置失败')
      return false
    } finally {
      setIsSavingVoices(false)
    }
  }, [bookId, characters, characterVoices, loadCharacters])

  const startGeneration = useCallback(async () => {
    try {
      setIsGenerating(true)
      clearTimer()

      if (missingVoiceCharacters.length > 0) {
        toast.error('请为所有启用角色配置语音后再生成')
        setIsGenerating(false)
        return
      }

      const saved = await persistVoiceConfiguration()
      if (!saved) {
        setIsGenerating(false)
        return
      }

      const response = await booksApi.startAudioGeneration(bookId, {
        type: 'book',
        autoMerge: audioSettings.autoMerge,
        options: {
          batchSize: audioSettings.batchSize,
          skipExisting: audioSettings.skipExisting,
          overwriteExisting: audioSettings.overwriteExisting,
          ...(selectedProvider ? { provider: selectedProvider } : {})
        }
      })

      if (!response.success) {
        throw new Error('音频生成任务启动失败')
      }

      toast.success('音频生成任务已启动')
      await loadGenerationStatus(true)
      await loadBook()
    } catch (err) {
      console.error('Failed to generate audio:', err)
      toast.error(err instanceof Error ? err.message : '音频生成失败')
      setIsGenerating(false)
    }
  }, [
    audioSettings.autoMerge,
    audioSettings.batchSize,
    audioSettings.overwriteExisting,
    audioSettings.skipExisting,
    bookId,
    clearTimer,
    loadBook,
    loadGenerationStatus,
    missingVoiceCharacters.length,
    persistVoiceConfiguration,
    selectedProvider
  ])

  return {
    // 数据
    book,
    characters,
    availableVoices,
    providers,
    selectedProvider,
    setSelectedProvider,
    loading,
    error,
    // 声音配置
    characterVoices,
    setCharacterVoices,
    showVoiceConfig,
    setShowVoiceConfig,
    isSavingVoices,
    missingVoiceCharacters,
    persistVoiceConfiguration,
    // 生成
    generationState,
    isGenerating,
    startGeneration,
    // 设置
    audioSettings,
    setAudioSettings,
    // 其它
    refresh: initialize
  }
}
