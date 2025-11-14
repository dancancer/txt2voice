/**
 * 应用程序常量配置
 * 集中管理所有魔法数字和配置值
 */

export const CONFIG = {
  // 文件上传配置
  FILE_UPLOAD: {
    MAX_SIZE: 20 * 1024 * 1024, // 20MB
    MAX_TEXT_LENGTH: 10 * 1024 * 1024, // 10MB
    ALLOWED_EXTENSIONS: ['.txt', '.md'] as const,
    CHUNK_SIZE: 64 * 1024, // 64KB for streaming
  },

  // 文本处理配置
  TEXT_PROCESSING: {
    MAX_SEGMENT_LENGTH: 600,  // 段落上限控制在500±100字的上限
    MIN_SEGMENT_LENGTH: 400,  // 段落下限控制在500±100字的下限
    DEFAULT_SEGMENT_LENGTH: 500,  // 目标长度
    SEGMENT_TOLERANCE: 100,  // 分段均匀性容差
    LLM_CHUNK_SIZE: 8000,
    OVERLAP_SIZE: 200,
  },

  // 音频生成配置
  AUDIO_GENERATION: {
    BATCH_SIZE: 5,
    RETRY_DELAY: 1000, // 1秒
    MAX_RETRIES: 3,
    DEFAULT_SAMPLE_RATE: 24000,
    SUPPORTED_FORMATS: ['mp3', 'wav', 'ogg'] as const,
  },

  // 缓存配置
  CACHE: {
    TTL: 5 * 60 * 1000, // 5分钟
    MAX_ITEMS: 500,
    BOOK_CACHE_TTL: 60 * 1000, // 1分钟
    VOICE_CACHE_TTL: 10 * 60 * 1000, // 10分钟
  },

  // 速率限制配置
  RATE_LIMIT: {
    WINDOW_MS: 60 * 1000, // 1分钟
    MAX_REQUESTS: 100,
    MAX_REQUESTS_PER_IP: 10,
    UNIQUE_TOKENS: 500,
  },

  // 数据库配置
  DATABASE: {
    CONNECTION_TIMEOUT: 10000, // 10秒
    QUERY_TIMEOUT: 30000, // 30秒
    MAX_CONNECTIONS: 10,
  },

  // LLM 配置
  LLM: {
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.7,
    TIMEOUT: 30000, // 30秒
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // 2秒
  },

  // 分页配置
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  // 日志配置
  LOGGING: {
    LEVELS: ['debug', 'info', 'warn', 'error'] as const,
    DEFAULT_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  },
} as const

// 文件名清理正则表达式
export const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9._-]/g

// 支持的语言
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'en-GB', 'ja-JP'] as const

// 书籍状态
export const BOOK_STATUS = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  SCRIPT_GENERATED: 'script_generated',
  GENERATING_AUDIO: 'generating_audio',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const

// TTS 提供商
export const TTS_PROVIDERS = {
  AZURE: 'azure',
  OPENAI: 'openai',
  EDGE_TTS: 'edge-tts',
} as const

// 错误代码
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  TTS_SERVICE_DOWN: 'TTS_SERVICE_DOWN',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  VOICE_NOT_SUPPORTED: 'VOICE_NOT_SUPPORTED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
