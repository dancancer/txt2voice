import {
  Book,
  CharacterProfile,
  CharacterAlias,
  TTSVoiceProfile,
  CharacterVoiceBinding,
  TextSegment,
  ScriptSentence,
  AudioFile,
  CharacterMergeAudit,
  ProcessingTask
} from '@/generated/prisma'

// 扩展的TypeScript类型定义
export interface BookWithDetails extends Book {
  characterProfiles: CharacterProfile[]
  textSegments: TextSegment[]
  scriptSentences: ScriptSentence[]
  audioFiles: AudioFile[]
  processingTasks: ProcessingTask[]
  _count: {
    segments: number
    characters: number
    audioFiles: number
  }
}

export interface CharacterProfileWithDetails extends CharacterProfile {
  aliases: CharacterAlias[]
  voiceBindings: CharacterVoiceBinding[]
  scriptSentences: ScriptSentence[]
  _count: {
    scriptSentences: number
  }
}

export interface VoiceProfileWithDetails extends TTSVoiceProfile {
  voiceBindings: CharacterVoiceBinding[]
  audioFiles: AudioFile[]
}

export interface TextSegmentWithDetails extends TextSegment {
  scriptSentences: ScriptSentence[]
  audioFiles: AudioFile[]
  _count: {
    scriptSentences: number
    audioFiles: number
  }
}

export interface ScriptSentenceWithDetails extends ScriptSentence {
  character: CharacterProfile | null
  segment: TextSegment
  audioFiles: AudioFile[]
}

export interface AudioFileWithDetails extends AudioFile {
  scriptSentence: ScriptSentence | null
  segment: TextSegment | null
  voiceProfile: TTSVoiceProfile | null
}

export interface CharacterVoiceBindingWithDetails extends CharacterVoiceBinding {
  character: CharacterProfile
  voiceProfile: TTSVoiceProfile
}

// 角色特征类型
export interface CharacterCharacteristics {
  gender: 'male' | 'female' | 'unknown'
  ageRange: 'young' | 'adult' | 'middle_aged' | 'elderly' | 'unknown'
  personality: string[]
  speechStyle: 'formal' | 'casual' | 'elegant' | 'rough' | 'playful' | 'serious'
  socialClass?: 'noble' | 'common' | 'merchant' | 'scholar' | 'unknown'
  occupation?: string
}

export interface CharacterVoicePreferences {
  preferredGender?: 'male' | 'female' | 'any'
  preferredAgeRange?: string
  preferredStyles?: string[]
  avoidStyles?: string[]
}

export interface CharacterEmotionProfile {
  baseEmotion: string
  emotionVariability: 'low' | 'medium' | 'high'
  commonEmotions: string[]
}

// 声线特征类型
export interface VoiceCharacteristics {
  gender: 'male' | 'female' | 'neutral' | 'child'
  ageRange: 'young' | 'adult' | 'middle_aged' | 'elderly'
  language: string
  accent?: string
  style: string[]
}

export interface VoiceDefaultParameters {
  pitch: number    // 0.5 - 2.0
  rate: number     // 0.5 - 2.0
  volume: number   // 0.0 - 1.0
}

export interface VoicePreviewAudio {
  url: string
  duration: number
  sampleText: string
}

// 台本生成相关类型
export interface ScriptSentenceInput {
  text: string
  speaker?: string
  orderInSegment: number
}

export interface EmotionAnalysis {
  primary: string
  intensity: number    // 0-100
  secondary?: string
  confidence: number   // 0-1
}

export interface TTSParameters {
  pitch: number
  rate: number
  volume: number
  style?: string
  pause?: number
}

export interface Sentence {
  id: string
  text: string
  startIndex: number
  endIndex: number
  type: 'dialogue' | 'narration' | 'description'
  speaker?: string
}

export interface PreprocessingResult {
  cleanText: string
  sentences: Sentence[]
  potentialCharacters: string[]
  dialoguePatterns: DialoguePattern[]
}

export interface DialoguePattern {
  type: 'quote' | 'colon' | 'dash'
  speaker: string
  content: string
  startIndex: number
  endIndex: number
}

// LLM Agent 相关类型
export interface LLMClientConfig {
  provider: 'openai' | 'anthropic'
  apiKey: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface AgentConfig {
  llm: LLMClientConfig
  redis: {
    host: string
    port: number
    password?: string
  }
  database: string
  emotionModel?: string
}

export interface CharacterCandidate {
  canonicalName: string
  aliases: string[]
  genderHint: 'male' | 'female' | 'unknown'
  ageRange: 'young' | 'adult' | 'elderly' | 'unknown'
  personality: string[]
  confidence: number
  evidence: string[]
}

// TTS 服务类型
export interface TTSServiceConfig {
  provider: 'azure' | 'openai' | 'edge-tts'
  apiKey?: string
  region?: string
  voiceId: string
  defaultParameters?: Partial<VoiceDefaultParameters>
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer
  duration: number
  format: 'mp3' | 'wav'
  voiceId: string
  parameters: VoiceDefaultParameters
}

export interface VoicePreview {
  voiceProfileId: string
  audioUrl: string
  duration: number
  sampleText: string
  generatedAt: Date
}

// 任务队列类型
export interface TaskData {
  bookId: string
  segmentIds?: number[]
  voiceOverrides?: Record<string, any>
  options?: Record<string, any>
}

export interface TaskProgress {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number        // 0-100
  currentSegment?: number
  totalSegments?: number
  estimatedTimeRemaining?: number
  errorMessage?: string
}

// API 响应类型
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: any
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 文件上传类型
export interface FileUploadResult {
  fileId: string
  fileName: string
  fileSize: number
  segments: TextSegment[]
}

export interface UploadOptions {
  maxSize: number
  acceptedTypes: string[]
  uploadProgress?: number
}

// 错误类型
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class FileProcessingError extends APIError {
  constructor(
    message: string,
    public code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'CORRUPTED_FILE',
    details?: any
  ) {
    super(message, 400, code, details);
  }
}

export class TTSError extends APIError {
  constructor(
    message: string,
    public code: 'TTS_SERVICE_DOWN' | 'QUOTA_EXCEEDED' | 'VOICE_NOT_SUPPORTED',
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message, retryable ? 503 : 502, code);
  }
}

export class ValidationError extends APIError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR', { field });
  }
}

// 环境变量类型
export interface EnvironmentVariables {
  DATABASE_URL: string
  REDIS_URL: string
  NEXTAUTH_SECRET: string
  NEXTAUTH_URL: string
  OPENAI_API_KEY: string
  AZURE_SPEECH_KEY: string
  AZURE_SPEECH_REGION: string
  UPLOAD_DIR: string
  AUDIO_DIR: string
  NODE_ENV: string
  PORT: number
}

// 工具类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
