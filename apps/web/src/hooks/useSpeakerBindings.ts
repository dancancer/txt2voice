import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export type SpeakerBinding = {
  id: string
  isPreferred?: boolean
  speakerProfile?: {
    id: string
    name?: string
    gender?: string
    ageGroup?: string
    toneStyle?: string
    referenceAudio?: string | null
  }
}

export function useSpeakerBindings(bookId: string, setCharacters: (updater: any) => void) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogCharacter, setDialogCharacter] = useState<any | null>(null)
  const [bindings, setBindings] = useState<SpeakerBinding[]>([])
  const [availableSpeakers, setAvailableSpeakers] = useState<any[]>([])
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('')
  const [isDialogLoading, setIsDialogLoading] = useState(false)
  const [isSpeakerListLoading, setIsSpeakerListLoading] = useState(false)
  const [speakerActionLoading, setSpeakerActionLoading] = useState(false)
  const [updatingBindingId, setUpdatingBindingId] = useState<string | null>(null)
  const [removingBindingId, setRemovingBindingId] = useState<string | null>(null)

  const buildSpeakerPreviewSources = (referenceAudio?: string | null) => {
    const base = (process.env.NEXT_PUBLIC_INDEXTTS_API_URL || 'http://192.168.88.9:8001').replace(/\/$/, '')
    if (!referenceAudio) return []
    if (/^https?:\/\//.test(referenceAudio)) return [referenceAudio]
    if (referenceAudio.startsWith('/')) return [`${base}${referenceAudio}`]
    return [`${base}/uploads/${referenceAudio}`]
  }

  const fetchCharacterSpeakerBindings = useCallback(async (characterId: string) => {
    setIsDialogLoading(true)
    try {
      const response = await fetch(`/api/books/${bookId}/characters/${characterId}/speakers`)
      if (!response.ok) throw new Error('加载角色说话人失败')
      const result = await response.json()
      const newBindings = result.data?.speakerBindings || []
      setBindings(newBindings)
      setCharacters((prev: any) =>
        prev.map((character: any) =>
          character.id === characterId
            ? { ...character, speakerBindings: newBindings }
            : character
        )
      )
    } catch (error) {
      console.error('Failed to load character speakers:', error)
      toast.error(error instanceof Error ? error.message : '加载角色说话人失败')
    } finally {
      setIsDialogLoading(false)
    }
  }, [bookId, setCharacters])

  const fetchAvailableSpeakers = useCallback(async (force = false) => {
    if (!force && availableSpeakers.length > 0) return
    setIsSpeakerListLoading(true)
    try {
      const response = await fetch(`/api/tts/speakers?limit=100`)
      if (!response.ok) throw new Error('获取说话人列表失败')
      const data = await response.json()
      setAvailableSpeakers(data.data?.speakers || [])
    } catch (error) {
      console.error('Failed to load speakers:', error)
      toast.error(error instanceof Error ? error.message : '获取说话人列表失败')
    } finally {
      setIsSpeakerListLoading(false)
    }
  }, [availableSpeakers.length])

  const openDialog = async (character: any) => {
    setDialogCharacter(character)
    setDialogOpen(true)
    setSelectedSpeakerId('')
    setBindings([])
    await Promise.all([
      fetchCharacterSpeakerBindings(character.id),
      fetchAvailableSpeakers()
    ])
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setDialogCharacter(null)
    setBindings([])
    setSelectedSpeakerId('')
    setSpeakerActionLoading(false)
    setUpdatingBindingId(null)
    setRemovingBindingId(null)
  }

  const addBinding = async () => {
    if (!dialogCharacter) return
    const speakerProfileId = Number(selectedSpeakerId)
    if (!selectedSpeakerId || Number.isNaN(speakerProfileId)) {
      toast.error('请选择要关联的说话人')
      return
    }
    try {
      setSpeakerActionLoading(true)
      const response = await fetch(
        `/api/books/${bookId}/characters/${dialogCharacter.id}/speakers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speakerProfileId,
            isPreferred: bindings.length === 0,
          }),
        }
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '关联说话人失败')
      }
      toast.success('已关联说话人')
      setSelectedSpeakerId('')
      await fetchCharacterSpeakerBindings(dialogCharacter.id)
    } catch (error) {
      console.error('Failed to bind speaker:', error)
      toast.error(error instanceof Error ? error.message : '关联说话人失败，请稍后重试')
    } finally {
      setSpeakerActionLoading(false)
    }
  }

  const setDefaultBinding = async (bindingId: string) => {
    if (!dialogCharacter) return
    try {
      setUpdatingBindingId(bindingId)
      const response = await fetch(
        `/api/books/${bookId}/characters/${dialogCharacter.id}/speakers`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bindingId, isPreferred: true }),
        }
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '设置默认说话人失败')
      }
      toast.success('已设置默认说话人')
      await fetchCharacterSpeakerBindings(dialogCharacter.id)
    } catch (error) {
      console.error('Failed to set default speaker:', error)
      toast.error(error instanceof Error ? error.message : '设置默认说话人失败，请稍后重试')
    } finally {
      setUpdatingBindingId(null)
    }
  }

  const removeBinding = async (bindingId: string) => {
    if (!dialogCharacter) return
    try {
      setRemovingBindingId(bindingId)
      const response = await fetch(
        `/api/books/${bookId}/characters/${dialogCharacter.id}/speakers?bindingId=${encodeURIComponent(bindingId)}`,
        { method: 'DELETE' }
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '解除关联失败')
      }
      toast.success('说话人已解除关联')
      await fetchCharacterSpeakerBindings(dialogCharacter.id)
    } catch (error) {
      console.error('Failed to remove speaker binding:', error)
      toast.error(error instanceof Error ? error.message : '解除关联失败，请稍后重试')
    } finally {
      setRemovingBindingId(null)
    }
  }

  return {
    dialogOpen,
    dialogCharacter,
    bindings,
    availableSpeakers,
    selectedSpeakerId,
    setSelectedSpeakerId,
    isDialogLoading,
    isSpeakerListLoading,
    speakerActionLoading,
    updatingBindingId,
    removingBindingId,
    buildSpeakerPreviewSources,
    openDialog,
    closeDialog,
    addBinding,
    setDefaultBinding,
    removeBinding,
  }
}
