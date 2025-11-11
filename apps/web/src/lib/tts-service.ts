import { TTSError } from './error-handler'

export interface TTSProvider {
  name: string
  type: 'azure' | 'openai' | 'edge-tts' | 'custom'
  apiKey?: string
  region?: string
  endpoint?: string
  model?: string
  isAvailable: boolean
  supportedLanguages: string[]
  supportedVoices: TTSVoice[]
  maxCharacters: number
  rateLimits?: {
    requestsPerMinute: number
    charactersPerMinute: number
  }
}

export interface TTSVoice {
  id: string
  name: string
  displayName: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  age: 'child' | 'teen' | 'adult' | 'senior'
  style: string[]
  sampleRate?: number
  description?: string
  isNeural?: boolean
  locale?: string
}

export interface TTSRequest {
  text: string
  voice: TTSVoice
  outputFormat: 'mp3' | 'wav' | 'ogg'
  speed?: number
  pitch?: number
  volume?: number
  emotion?: string
  style?: string
}

export interface TTSResponse {
  audioBuffer: ArrayBuffer
  duration: number
  format: string
  sampleRate: number
  metadata: Record<string, any>
}

/**
 * Azure TTS 服务
 */
export class AzureTTSService {
  private apiKey: string
  private region: string

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey
    this.region = region
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch Azure voices')
      }

      const voices = await response.json()

      return voices.map((voice: any) => ({
        id: voice.ShortName,
        name: voice.ShortName,
        displayName: voice.LocalName || voice.Name,
        language: voice.Locale,
        gender: voice.Gender.toLowerCase() as 'male' | 'female',
        age: 'adult',
        style: voice.StyleList || [],
        sampleRate: voice.SampleRateHertz,
        description: voice.Description,
        isNeural: voice.VoiceType === 'Neural',
        locale: voice.Locale
      }))
    } catch (error) {
      console.error('Failed to fetch Azure voices:', error)
      return []
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const ssml = this.generateSSML(request)

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': this.getOutputFormat(request.outputFormat)
          },
          body: ssml
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new TTSError(
          `Azure TTS synthesis failed: ${errorText}`,
          'TTS_SERVICE_DOWN',
          'azure'
        )
      }

      const audioBuffer = await response.arrayBuffer()

      return {
        audioBuffer,
        duration: 0, // 需要分析音频文件获取实际时长
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: 'azure',
          voice: request.voice.id,
          ssml
        }
      }
    } catch (error) {
      if (error instanceof TTSError) {
        throw error
      }
      throw new TTSError(
        'Azure TTS service connection failed',
        'TTS_SERVICE_DOWN',
        'azure',
        true
      )
    }
  }

  private generateSSML(request: TTSRequest): string {
    const { text, voice, speed = 1.0, pitch = 0, volume = 1.0, emotion, style } = request

    let prosody = ''
    if (speed !== 1.0) prosody += ` rate="${speed}"`
    if (pitch !== 0) prosody += ` pitch="${pitch > 0 ? '+' : ''}${pitch}Hz"`
    if (volume !== 1.0) prosody += ` volume="${volume}"`

    let emotionExpression = ''
    if (emotion && voice.style.includes(emotion)) {
      emotionExpression = ` mstts:express-as="${emotion}"`
    } else if (style && voice.style.includes(style)) {
      emotionExpression = ` mstts:express-as="${style}"`
    }

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.language}">
      <voice name="${voice.id}">
        <prosody${prosody}>
          <p${emotionExpression}>
            ${text}
          </p>
        </prosody>
      </voice>
    </speak>`
  }

  private getOutputFormat(format: string): string {
    const formats = {
      'mp3': 'audio-24khz-96kbitrate-mono-mp3',
      'wav': 'riff-24khz-16bit-mono-pcm',
      'ogg': 'ogg-24khz-16bit-mono-opus'
    }
    return formats[format as keyof typeof formats] || formats.mp3
  }
}

/**
 * OpenAI TTS 服务
 */
export class OpenAITTSService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    // OpenAI TTS 目前支持的有限声音
    const voices = [
      {
        id: 'alloy',
        name: 'alloy',
        displayName: 'Alloy (中性)',
        language: 'zh-CN',
        gender: 'neutral' as const,
        age: 'adult' as const,
        style: ['neutral'],
        description: '中性声音，适合旁白',
        isNeural: true
      },
      {
        id: 'echo',
        name: 'echo',
        displayName: 'Echo (男声)',
        language: 'zh-CN',
        gender: 'male' as const,
        age: 'adult' as const,
        style: ['neutral'],
        description: '男性声音',
        isNeural: true
      },
      {
        id: 'fable',
        name: 'fable',
        displayName: 'Fable (英式男声)',
        language: 'en-GB',
        gender: 'male' as const,
        age: 'adult' as const,
        style: ['narrative'],
        description: '英式男性声音，适合讲故事',
        isNeural: true
      },
      {
        id: 'onyx',
        name: 'onyx',
        displayName: 'Onyx (深沉男声)',
        language: 'zh-CN',
        gender: 'male' as const,
        age: 'adult' as const,
        style: ['serious'],
        description: '深沉男性声音',
        isNeural: true
      },
      {
        id: 'nova',
        name: 'nova',
        displayName: 'Nova (女声)',
        language: 'zh-CN',
        gender: 'female' as const,
        age: 'adult' as const,
        style: ['friendly'],
        description: '女性声音',
        isNeural: true
      },
      {
        id: 'shimmer',
        name: 'shimmer',
        displayName: 'Shimmer (温柔女声)',
        language: 'zh-CN',
        gender: 'female' as const,
        age: 'adult' as const,
        style: ['gentle'],
        description: '温柔女性声音',
        isNeural: true
      }
    ]

    return voices
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: request.text,
          voice: request.voice.id,
          response_format: request.outputFormat,
          speed: request.speed || 1.0
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new TTSError(
          `OpenAI TTS synthesis failed: ${error.error?.message || response.statusText}`,
          'TTS_SERVICE_DOWN',
          'openai'
        )
      }

      const audioBuffer = await response.arrayBuffer()

      return {
        audioBuffer,
        duration: 0, // OpenAI doesn't return duration
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: 'openai',
          voice: request.voice.id,
          model: 'tts-1'
        }
      }
    } catch (error) {
      if (error instanceof TTSError) {
        throw error
      }
      throw new TTSError(
        'OpenAI TTS service connection failed',
        'TTS_SERVICE_DOWN',
        'openai',
        true
      )
    }
  }
}

/**
 * Edge TTS 服务 (免费)
 */
export class EdgeTTSService {
  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      // 这是一个简化的Edge TTS声音列表，实际应用中可以动态获取
      const voices = [
        {
          id: 'zh-CN-XiaoxiaoNeural',
          name: 'Xiaoxiao',
          displayName: '晓晓 (女声)',
          language: 'zh-CN',
          gender: 'female' as const,
          age: 'adult' as const,
          style: ['neutral', 'gentle', 'cheerful'],
          description: '中文女声，自然清晰',
          isNeural: true,
          locale: 'zh-CN'
        },
        {
          id: 'zh-CN-YunxiNeural',
          name: 'Yunxi',
          displayName: '云希 (男声)',
          language: 'zh-CN',
          gender: 'male' as const,
          age: 'adult' as const,
          style: ['neutral', 'calm', 'serious'],
          description: '中文男声，沉稳有力',
          isNeural: true,
          locale: 'zh-CN'
        },
        {
          id: 'zh-CN-YunjianNeural',
          name: 'Yunjian',
          displayName: '云健 (男声)',
          language: 'zh-CN',
          gender: 'male' as const,
          age: 'adult' as const,
          style: ['neutral', 'gentle'],
          description: '中文男声，亲和自然',
          isNeural: true,
          locale: 'zh-CN'
        },
        {
          id: 'zh-CN-XiaoyiNeural',
          name: 'Xiaoyi',
          displayName: '晓伊 (女声)',
          language: 'zh-CN',
          gender: 'female' as const,
          age: 'adult' as const,
          style: ['neutral', 'sweet'],
          description: '中文女声，甜美可爱',
          isNeural: true,
          locale: 'zh-CN'
        }
      ]

      return voices
    } catch (error) {
      console.error('Failed to fetch Edge TTS voices:', error)
      return []
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    // Edge TTS 实现需要使用 WebSocket 或专门的库
    // 这里提供一个基础框架，实际实现需要更多工作
    throw new TTSError(
      'Edge TTS service not fully implemented',
      'TTS_SERVICE_DOWN',
      'edge-tts'
    )
  }
}

/**
 * TTS 服务管理器
 */
export class TTSServiceManager {
  private providers: Map<string, TTSProvider> = new Map()
  private services: Map<string, any> = new Map()

  constructor() {
    this.initializeProviders()
  }

  private async initializeProviders() {
    // Azure TTS
    if (process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION) {
      const azureService = new AzureTTSService(
        process.env.AZURE_TTS_KEY,
        process.env.AZURE_TTS_REGION
      )

      try {
        const voices = await azureService.getAvailableVoices()
        this.providers.set('azure', {
          name: 'Azure TTS',
          type: 'azure',
          apiKey: process.env.AZURE_TTS_KEY,
          region: process.env.AZURE_TTS_REGION,
          isAvailable: true,
          supportedLanguages: [...new Set(voices.map(v => v.language))],
          supportedVoices: voices,
          maxCharacters: 10000,
          rateLimits: {
            requestsPerMinute: 100,
            charactersPerMinute: 300000
          }
        })
        this.services.set('azure', azureService)
      } catch (error) {
        console.error('Failed to initialize Azure TTS:', error)
      }
    }

    // OpenAI TTS
    if (process.env.OPENAI_API_KEY) {
      const openaiService = new OpenAITTSService(process.env.OPENAI_API_KEY)

      try {
        const voices = await openaiService.getAvailableVoices()
        this.providers.set('openai', {
          name: 'OpenAI TTS',
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY,
          isAvailable: true,
          supportedLanguages: ['zh-CN', 'en-US', 'en-GB'],
          supportedVoices: voices,
          maxCharacters: 4096,
          rateLimits: {
            requestsPerMinute: 50,
            charactersPerMinute: 100000
          }
        })
        this.services.set('openai', openaiService)
      } catch (error) {
        console.error('Failed to initialize OpenAI TTS:', error)
      }
    }

    // Edge TTS (免费服务，总是可用)
    const edgeService = new EdgeTTSService()
    try {
      const voices = await edgeService.getAvailableVoices()
      this.providers.set('edge-tts', {
        name: 'Edge TTS',
        type: 'edge-tts',
        isAvailable: true,
        supportedLanguages: ['zh-CN'],
        supportedVoices: voices,
        maxCharacters: 5000,
        rateLimits: {
          requestsPerMinute: 60,
          charactersPerMinute: 100000
        }
      })
      this.services.set('edge-tts', edgeService)
    } catch (error) {
      console.error('Failed to initialize Edge TTS:', error)
    }
  }

  getAvailableProviders(): TTSProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable)
  }

  getProvider(providerName: string): TTSProvider | undefined {
    return this.providers.get(providerName)
  }

  getService(providerName: string): any {
    return this.services.get(providerName)
  }

  async getVoice(providerName: string, voiceId: string): Promise<TTSVoice | null> {
    const provider = this.providers.get(providerName)
    if (!provider) return null

    return provider.supportedVoices.find(voice => voice.id === voiceId) || null
  }

  async synthesize(request: TTSRequest, providerName: string): Promise<TTSResponse> {
    const service = this.services.get(providerName)
    if (!service) {
      throw new TTSError(
        `TTS provider ${providerName} not available`,
        'TTS_SERVICE_DOWN',
        providerName
      )
    }

    return service.synthesize(request)
  }
}

// 全局 TTS 服务管理器实例
export const ttsServiceManager = new TTSServiceManager()