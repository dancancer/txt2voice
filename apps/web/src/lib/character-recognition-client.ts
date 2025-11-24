/**
 * Character Recognition via LLM (Gemini)
 * 使用内置的 LLM（Gemini）完成角色识别，替代外部 Python 服务
 */

import { logger } from './logger'

// ======================== 请求 & 响应类型 ========================
export interface RecognitionOptions {
  enable_coreference?: boolean
  enable_dialogue?: boolean
  enable_relations?: boolean
  similarity_threshold?: number
}

export interface RecognitionRequest {
  text: string
  book_id: string
  options?: RecognitionOptions
}

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

// ======================== 错误类型 ========================
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

// ======================== LLM 客户端 ========================
const DEFAULT_MODEL = process.env.CHARREG_LLM_MODEL || process.env.LLM_MODEL || 'gemini-2.5-pro'
const DEFAULT_PROVIDER = process.env.CHARREG_LLM_PROVIDER || process.env.LLM_PROVIDER || 'google'
const DEFAULT_ENDPOINT = process.env.CHARREG_LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'

export class CharacterRecognitionClient {
  private readonly model: string
  private readonly apiKey: string
  private readonly provider: string
  private readonly endpoint: string
  private readonly timeout: number
  private readonly maxChars: number

  constructor(timeout: number = 60000) {
    this.model = DEFAULT_MODEL
    this.provider = DEFAULT_PROVIDER
    this.endpoint = DEFAULT_ENDPOINT
    this.apiKey = process.env.CHARREG_LLM_API_KEY
      || process.env.LLM_API_KEY
      || process.env.GOOGLE_API_KEY
      || ''
    this.timeout = timeout
    this.maxChars = Number(process.env.CHARREG_LLM_MAX_CHARS || '20000')
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey && this.model && this.provider === 'google')
  }

  async recognize(request: RecognitionRequest): Promise<RecognitionResponse> {
    this.ensureConfig()
    const startedAt = Date.now()
    const trimmedText = this.trimText(request.text)

    logger.info('Calling Gemini for character recognition', {
      textLength: trimmedText.length,
      model: this.model
    })

    const parsed = this.extractJson(await this.callGemini(this.buildPrompt(trimmedText)))
    const result = this.normalizeResult(parsed, trimmedText.length, startedAt)

    logger.info('Character recognition via LLM completed', {
      characters: result.characters.length,
      processingTime: result.statistics.processing_time
    })

    return result
  }

  // ======================== 辅助方法 ========================
  private ensureConfig() {
    if (this.apiKey) return
    throw new CharacterRecognitionError('LLM未配置，缺少API Key', 'CONFIG_MISSING')
  }

  private trimText(text: string): string {
    if (this.maxChars <= 0 || text.length <= this.maxChars) {
      return text
    }
    return text.slice(0, this.maxChars)
  }

  private buildPrompt(text: string): string {
    const instructions = [
      '你是一个小说角色识别专家，返回 JSON 格式结果，字段包括 characters、alias_map、statistics。',
      'characters 内每个元素包含: name, aliases, gender, roles, mentions, quotes, first_appearance_idx。',
      'statistics 至少包含: total_mentions, total_dialogues，并给出合理的数值。只输出 JSON，不要多余文字。'
    ].join('\n')

    return `${instructions}\n\n文本内容：\n${text}`
  }

  private async callGemini(prompt: string): Promise<string> {
    const payload = await this.sendGeminiRequest(prompt)
    const text = this.parseGeminiText(payload)
    if (text) return text

    throw new CharacterRecognitionError('Gemini返回为空', 'EMPTY_RESPONSE', payload)
  }

  private async sendGeminiRequest(prompt: string): Promise<any> {
    return this.withTimeout(async (signal) => {
      const response = await fetch(this.buildGeminiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } }),
        signal
      })

      const payload = await response.json().catch(() => ({}))
      if (response.ok) return payload

      throw new CharacterRecognitionError(
        `Gemini返回错误: ${response.statusText}`,
        'LLM_REQUEST_FAILED',
        payload
      )
    })
  }

  private parseGeminiText(payload: any): string | null {
    const parts = payload?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return null

    const text = parts
      .map((part: any) => part?.text || '')
      .join('')
      .trim()

    return text || null
  }

  private buildGeminiUrl(): string {
    return `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${this.apiKey}`
  }

  private async withTimeout<T>(runner: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      return await runner(controller.signal)
    } catch (error: any) {
      if (error instanceof CharacterRecognitionError) throw error
      if (error?.name === 'AbortError') {
        throw new CharacterRecognitionError('LLM请求超时', 'TIMEOUT')
      }
      throw new CharacterRecognitionError(
        `LLM调用失败: ${error?.message || '未知错误'}`,
        'LLM_REQUEST_FAILED'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private extractJson(responseText: string): any {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new CharacterRecognitionError('未能在LLM响应中找到JSON', 'PARSE_ERROR', { responseText })
    }

    try {
      return JSON.parse(jsonMatch[0])
    } catch (error) {
      throw new CharacterRecognitionError('LLM返回的JSON解析失败', 'PARSE_ERROR', { error })
    }
  }

  private normalizeResult(raw: any, textLength: number, startedAt: number): RecognitionResponse {
    const normalizedCharacters = this.normalizeCharacters(raw)
    const statistics = this.buildStatistics(raw, normalizedCharacters, textLength, startedAt)

    return {
      characters: normalizedCharacters,
      alias_map: raw?.alias_map || {},
      relations: Array.isArray(raw?.relations) ? raw.relations : [],
      statistics
    }
  }

  private normalizeCharacters(raw: any): Character[] {
    const characters = Array.isArray(raw?.characters) ? raw.characters : []
    return characters.map((character: any, index: number) => ({
      id: character.id || `char_${index}`,
      name: character.name || `角色${index + 1}`,
      aliases: this.safeStringArray(character.aliases),
      mentions: this.safeNumber(character.mentions),
      quotes: this.safeNumber(character.quotes),
      first_appearance_idx: this.safeNumber(character.first_appearance_idx, index),
      gender: character.gender || 'unknown',
      roles: Array.isArray(character.roles) ? character.roles : []
    }))
  }

  private buildStatistics(
    raw: any,
    characters: Character[],
    textLength: number,
    startedAt: number
  ): RecognitionStatistics {
    const mentions = characters.reduce((sum, c) => sum + this.safeNumber(c.mentions), 0)
    const dialogues = characters.reduce((sum, c) => sum + this.safeNumber(c.quotes), 0)

    return {
      total_characters: characters.length,
      total_mentions: this.safeNumber(raw?.statistics?.total_mentions, mentions),
      total_dialogues: this.safeNumber(raw?.statistics?.total_dialogues, dialogues),
      text_length: textLength,
      sentence_count: this.safeNumber(raw?.statistics?.sentence_count),
      processing_time: this.safeNumber(
        raw?.statistics?.processing_time,
        Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      )
    }
  }

  private safeNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }

  private safeStringArray(list: any): string[] {
    if (!Array.isArray(list)) return []
    return list
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

export const characterRecognitionClient = new CharacterRecognitionClient()
