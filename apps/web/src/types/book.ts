// ========================
// 书籍与任务类型定义
// ========================

export type BookStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'analyzing'
  | 'analyzed'
  | 'generating_script'
  | 'script_generated'
  | 'generating_audio'
  | 'completed'
  | 'error'

export interface ProcessingTaskSummary {
  id: string
  taskType: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string | null
  error?: string | null
  createdAt: string
  completedAt?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CharacterVoiceBindingSummary {
  id: string
  isDefault?: boolean
  voiceProfile?: {
    id: string
    name?: string
    displayName?: string | null
    provider: string
    voiceId?: string
  }
}

export interface SpeakerBindingSummary {
  id: string
  isDefault?: boolean
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

export interface CharacterProfileSummary {
  id: string
  canonicalName?: string
  name?: string
  genderHint?: string
  isActive?: boolean
  mentions?: number
  quotes?: number
  voiceBindings?: CharacterVoiceBindingSummary[]
  speakerBindings?: SpeakerBindingSummary[]
  _count?: {
    scriptSentences?: number
  }
}

export interface BookStats {
  charactersCount?: number
  chaptersCount?: number
  segmentsCount?: number
  scriptsCount?: number
  audioFilesCount?: number
}

export interface Book {
  id: string
  title: string
  author?: string | null
  originalFilename?: string | null
  fileSize?: number | null
  totalSegments: number
  totalCharacters: number
  status: BookStatus
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
  characterProfiles?: CharacterProfileSummary[]
  textSegments?: any[]
  scriptSentences?: any[]
  audioFiles?: any[]
  processingTasks?: ProcessingTaskSummary[]
  stats?: BookStats
  _count?: {
    segments?: number
    characters?: number
    audioFiles?: number
    textSegments?: number
    scriptSentences?: number
    chapters?: number
  }
}
