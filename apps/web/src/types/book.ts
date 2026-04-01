// 一旦我被更新，请更新我的开头注释
// input: 数据模型约束
// output: 类型导出
// pos: 共享类型
// ========================
// 书籍与任务类型定义
// ========================

export type BookStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'generating_script'
  | 'script_generated'
  | 'generating_audio'
  | 'quality_checking'
  | 'manual_review_pending'
  | 'assembling_audio'
  | 'completed_with_errors'
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
    id: number
    name?: string | null
    gender?: string
    ageGroup?: string
    toneStyle?: string
    referenceAudio?: string | null
  }
}

export interface CharacterProfileSummary {
  id: string
  canonicalName: string
  genderHint?: string
  isActive?: boolean
  mentions?: number
  quotes?: number
  scriptSentencesCount?: number
  characteristics?: unknown
  voiceBindings?: CharacterVoiceBindingSummary[]
  speakerBindings?: SpeakerBindingSummary[]
  isSystemRole?: boolean
  systemRoleType?: 'narration' | null
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
  latestTask?: ProcessingTaskSummary | null
  counts?: {
    characters: number
    chapters: number
    segments: number
    scripts: number
    audioFiles: number
  }
}
