/**
 * Character Recognition Service Client
 * 对接character-recognition服务的客户端
 */

import { logger } from './logger'

// 请求类型
export interface RecognitionOptions {
  enable_coreference?: boolean
  enable_dialogue?: boolean
  enable_relations?: boolean
  similarity_threshold?: number
}

export interface RecognitionRequest {
  text: string
  options?: RecognitionOptions
}

// 响应类型
export interface Character {
  id: string
  name: string
  aliases: string[]
  mentions: number
  first_appearance_idx: number
  gender?: string
  roles?: string[]
  quotes: number
}

export interface CharacterRelation {
  from_char: string
  to_char: string
  relation_type: string
  weight: number
}

export interface RecognitionStatistics {
  total_characters: number
  total_mentions: number
  total_dialogues: number
  text_length: number
  sentence_count: number
  processing_time: number
}

export interface RecognitionResponse {
  characters: Character[]
  alias_map: Record<string, string>
  relations?: CharacterRelation[]
  statistics: RecognitionStatistics
}

// 错误类型
export class CharacterRecognitionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'CharacterRecognitionError'
  }
}

/**
 * Character Recognition Service 客户端
 */
export class CharacterRecognitionClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl?: string, timeout: number = 60000) {
    this.baseUrl = baseUrl || process.env.CHARACTER_RECOGNITION_URL || 'http://localhost:8001'
    this.timeout = timeout
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      logger.error('Character recognition service health check failed', error)
      return false
    }
  }

  /**
   * 识别小说人物
   */
  async recognize(request: RecognitionRequest): Promise<RecognitionResponse> {
    try {
      logger.info('Calling character recognition service', {
        textLength: request.text.length,
        options: request.options
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/api/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new CharacterRecognitionError(
          `Recognition failed: ${response.statusText}`,
          'RECOGNITION_FAILED',
          errorData
        )
      }

      const result: RecognitionResponse = await response.json()

      logger.info('Character recognition completed', {
        totalCharacters: result.statistics.total_characters,
        processingTime: result.statistics.processing_time
      })

      return result
    } catch (error) {
      if (error instanceof CharacterRecognitionError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CharacterRecognitionError(
            'Recognition timeout',
            'TIMEOUT',
            { timeout: this.timeout }
          )
        }

        throw new CharacterRecognitionError(
          `Recognition error: ${error.message}`,
          'NETWORK_ERROR',
          { originalError: error.message }
        )
      }

      throw new CharacterRecognitionError(
        'Unknown recognition error',
        'UNKNOWN_ERROR'
      )
    }
  }

  /**
   * 异步识别小说人物（提交任务）
   */
  async recognizeAsync(request: RecognitionRequest, callbackUrl?: string): Promise<{ task_id: string; message: string }> {
    try {
      logger.info('Submitting async character recognition task', {
        textLength: request.text.length,
        callbackUrl
      })

      const url = new URL(`${this.baseUrl}/api/recognize/async`)
      if (callbackUrl) {
        url.searchParams.set('callback_url', callbackUrl)
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new CharacterRecognitionError(
          `Failed to submit task: ${response.statusText}`,
          'TASK_SUBMIT_FAILED',
          errorData
        )
      }

      const result = await response.json()
      
      logger.info('Async task submitted', { taskId: result.task_id })
      
      return result
    } catch (error) {
      if (error instanceof CharacterRecognitionError) {
        throw error
      }

      throw new CharacterRecognitionError(
        `Failed to submit async task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      )
    }
  }

  /**
   * 获取异步任务状态
   */
  async getTaskStatus(taskId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/recognize/async/${taskId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new CharacterRecognitionError(
            'Task not found',
            'TASK_NOT_FOUND'
          )
        }
        throw new CharacterRecognitionError(
          `Failed to get task status: ${response.statusText}`,
          'TASK_STATUS_FAILED'
        )
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      if (error instanceof CharacterRecognitionError) {
        throw error
      }

      throw new CharacterRecognitionError(
        `Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      )
    }
  }

  /**
   * 获取服务统计信息
   */
  async getStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`)

      if (!response.ok) {
        throw new Error(`Failed to get stats: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Failed to get character recognition stats', error)
      throw error
    }
  }
}

// 导出单例实例
export const characterRecognitionClient = new CharacterRecognitionClient()
