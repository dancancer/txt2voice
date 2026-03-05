// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from './error-handler'
import { ttsServiceManager, TTSRequest } from './tts-service'
import prisma, { Prisma } from './prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getBookAudioDir } from './storage-path'

export interface AudioGenerationRequest {
  scriptSentenceId: string
  voiceProfileId?: string
  overrides?: {
    speed?: number
    pitch?: number
    volume?: number
    emotion?: string
    style?: string
  }
  outputFormat?: 'mp3' | 'wav' | 'ogg'
}

export interface AudioGenerationOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
  priority?: 'low' | 'normal' | 'high'
  skipExisting?: boolean
  overwriteExisting?: boolean
  provider?: string
}

export interface AudioGenerationResult {
  success: boolean
  audioFileId?: string
  duration?: number
  fileSize?: number
  error?: string
  metadata?: Record<string, any>
}

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, any> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : undefined

/**
 * 音频生成器类
 */
export class AudioGenerator {
  private readonly defaultOptions: AudioGenerationOptions = {
    batchSize: 5,
    maxRetries: 3,
    retryDelay: 1000,
    priority: 'normal',
    skipExisting: true,
    overwriteExisting: false
  }

  /**
   * 生成单个台词的音频
   */
  async generateSingleAudio(
    request: AudioGenerationRequest,
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult> {
    const finalOptions = { ...this.defaultOptions, ...options }
    let scriptSentence: any | null = null
    let voiceProfile: any | null = null
    let ttsRequest: TTSRequest | null = null
    let attemptStartedAt: Date | null = null

    try {
      // 获取台词信息
      scriptSentence = await prisma.scriptSentence.findUnique({
        where: { id: request.scriptSentenceId },
        include: {
          character: {
            include: {
              voiceBindings: {
                include: {
                  voiceProfile: true
                },
                orderBy: [
                  { isDefault: 'desc' },
                  { createdAt: 'desc' }
                ]
              }
            }
          },
          segment: {
            select: {
              id: true,
              chapterId: true
            }
          },
          book: true
        }
      })

      if (!scriptSentence) {
        return {
          success: false,
          error: '台词不存在'
        }
      }

      // 检查是否已存在音频文件
      if (finalOptions.skipExisting) {
        const existingAudio = await prisma.audioFile.findFirst({
          where: {
            sentenceId: request.scriptSentenceId,
            status: 'completed'
          }
        })

        if (existingAudio && !finalOptions.overwriteExisting) {
          return {
            success: true,
            audioFileId: existingAudio.id,
            duration: Number(existingAudio.duration) ?? undefined,
            fileSize: Number(existingAudio.fileSize) ?? undefined
          }
        }
      }

      // 确定使用的声音配置
      attemptStartedAt = new Date()
      voiceProfile = await this.resolveVoiceProfileForSentence(
        scriptSentence,
        request,
        finalOptions
      )

      if (!voiceProfile) {
        try {
          await this.recordFailedSynthesisAttempt({
            scriptSentence,
            request,
            startedAt: attemptStartedAt,
            fallbackEngine: finalOptions.provider || scriptSentence.engineHint || undefined,
            error: new Error('未找到可用的声音配置（包含旁白兜底）')
          })
        } catch (persistError) {
          console.warn('写入失败合成尝试记录失败:', persistError)
        }
        return {
          success: false,
          error: '未找到可用的声音配置（包含旁白兜底）'
        }
      }

      // 构建TTS请求
      ttsRequest = await this.buildTTSRequest(
        scriptSentence,
        voiceProfile,
        request
      )

      // 调用TTS服务
      const ttsResponse = await ttsServiceManager.synthesize(
        ttsRequest,
        voiceProfile.provider
      )

      // 保存音频文件
      const audioFile = await this.saveAudioFile(
        scriptSentence,
        voiceProfile,
        ttsResponse,
        request,
        ttsRequest,
        attemptStartedAt
      )

      return {
        success: true,
        audioFileId: audioFile.id,
        duration: Number(audioFile.duration) ?? undefined,
        fileSize: Number(audioFile.fileSize) ?? undefined
      }

    } catch (error) {
      console.error('音频生成失败:', error)
      if (scriptSentence && attemptStartedAt) {
        try {
          await this.recordFailedSynthesisAttempt({
            scriptSentence,
            voiceProfile,
            request,
            ttsRequest,
            startedAt: attemptStartedAt,
            fallbackEngine: finalOptions.provider || scriptSentence.engineHint || undefined,
            error
          })
        } catch (persistError) {
          console.warn('写入失败合成尝试记录失败:', persistError)
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 批量生成音频
   */
  async generateBatchAudio(
    requests: AudioGenerationRequest[],
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult[]> {
    const finalOptions = { ...this.defaultOptions, ...options }
    const results: AudioGenerationResult[] = []

    // 分批处理
    const batchSize = finalOptions.batchSize || 5
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)

      const batchPromises = batch.map(request =>
        this.generateSingleAudio(request, finalOptions)
      )

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          })
        }
      })

      // 添加延迟以避免API限制
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, finalOptions.retryDelay || 1000))
      }
    }

    return results
  }

  /**
   * 为特定章节生成音频
   */
  async generateChapterAudio(
    bookId: string,
    chapterId: string,
    options: AudioGenerationOptions = {}
  ): Promise<{ total: number; success: number; failed: number; results: AudioGenerationResult[] }> {
    // 获取章节的所有台词
    const scriptSentences = await prisma.scriptSentence.findMany({
      where: {
        bookId,
        chapterId
      },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: {
                voiceProfile: true
              }
            }
          }
        },
        segment: {
          select: {
            id: true,
            chapterId: true,
            chapterOrderIndex: true
          }
        }
      },
      orderBy: [
        { segment: { chapterOrderIndex: 'asc' } },
        { orderInSegment: 'asc' }
      ]
    })

    if (scriptSentences.length === 0) {
      throw new TTSError('该章节没有可生成的台词', 'TTS_SERVICE_DOWN', 'audio-generator')
    }

    // 构建生成请求
    const requests: AudioGenerationRequest[] = scriptSentences.map(sentence => ({
      scriptSentenceId: sentence.id,
      outputFormat: 'mp3'
    }))

    // 批量生成
    const results = await this.generateBatchAudio(requests, options)

    const success = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      total: results.length,
      success,
      failed,
      results
    }
  }

  /**
   * 为整本书生成音频
   */
  async generateBookAudio(
    bookId: string,
    options: AudioGenerationOptions = {}
  ): Promise<{ total: number; success: number; failed: number; results: AudioGenerationResult[] }> {
    // 获取书籍的所有台词
    const scriptSentences = await prisma.scriptSentence.findMany({
      where: { bookId },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: {
                voiceProfile: true
              }
            }
          }
        },
        segment: {
          select: {
            id: true,
            chapterId: true
          }
        }
      },
      orderBy: [
        { segment: { orderIndex: 'asc' } },
        { orderInSegment: 'asc' }
      ]
    })

    if (scriptSentences.length === 0) {
      throw new TTSError('没有找到可生成的台词', 'TTS_SERVICE_DOWN', 'audio-generator')
    }

    // 构建生成请求
    const requests: AudioGenerationRequest[] = scriptSentences.map(sentence => ({
      scriptSentenceId: sentence.id,
      outputFormat: 'mp3'
    }))

    // 批量生成
    const results = await this.generateBatchAudio(requests, options)

    const success = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      total: results.length,
      success,
      failed,
      results
    }
  }

  /**
   * 构建TTS请求
   */
  private async buildTTSRequest(
    scriptSentence: any,
    voiceProfile: any,
    request: AudioGenerationRequest
  ): Promise<TTSRequest> {
    await ttsServiceManager.ready()
    // 获取TTS声音信息
    const voice = await ttsServiceManager.getVoice(voiceProfile.provider, voiceProfile.voiceId)
    if (!voice) {
      throw new TTSError('声音配置无效', 'TTS_SERVICE_DOWN', voiceProfile.provider)
    }

    const defaultParameters = asRecord(voiceProfile.defaultParameters) || {}
    const sentenceTtsParams = asRecord(scriptSentence.ttsParameters) || {}
    const ttsHints = asRecord(sentenceTtsParams.ttsHints) || {}

    const defaultSpeed = this.normalizeNumber(
      defaultParameters.rate ?? defaultParameters.speed,
      1
    )
    const defaultPitch = this.normalizePitch(defaultParameters.pitch)
    const defaultVolume = this.normalizeNumber(defaultParameters.volume, 1)

    const scriptStrength = this.normalizeStrength(scriptSentence.strength ?? sentenceTtsParams.strength)
    const strengthVolume = scriptStrength === null ? null : this.clamp(scriptStrength / 100, 0.2, 1.2)

    const speed = this.clamp(
      this.normalizeNumber(
        request.overrides?.speed ??
          ttsHints.rate ??
          sentenceTtsParams.rate ??
          defaultSpeed,
        1
      ),
      0.5,
      2
    )

    const pitch = this.clamp(
      this.normalizePitch(
        request.overrides?.pitch ??
          ttsHints.pitch ??
          sentenceTtsParams.pitch ??
          defaultPitch
      ),
      -20,
      20
    )

    const volume = this.clamp(
      this.normalizeNumber(
        request.overrides?.volume ??
          sentenceTtsParams.volume ??
          strengthVolume ??
          defaultVolume,
        1
      ),
      0,
      1.5
    )

    const tone = typeof scriptSentence.tone === 'string' ? scriptSentence.tone.trim() : ''
    const emotion = request.overrides?.emotion || tone || undefined
    const style = request.overrides?.style || this.resolveStyleFromTone(tone, voice.style) || voice.style[0]

    // 构建请求
    return {
      text: scriptSentence.text,
      voice,
      outputFormat: request.outputFormat || 'mp3',
      speed,
      pitch,
      volume,
      emotion,
      style
    }
  }

  private async resolveVoiceProfileForSentence(
    scriptSentence: any,
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ): Promise<any | null> {
    const preferredProvider = typeof options.provider === 'string' ? options.provider : undefined

    if (request.voiceProfileId) {
      const selectedProfile = await prisma.tTSVoiceProfile.findUnique({
        where: { id: request.voiceProfileId }
      })
      if (!selectedProfile) {
        return null
      }
      if (preferredProvider && selectedProfile.provider !== preferredProvider) {
        return null
      }
      return selectedProfile
    }

    const characterBindings = scriptSentence.character?.voiceBindings || []
    const matchedCharacterBinding = this.pickBindingByProvider(characterBindings, preferredProvider)
    if (matchedCharacterBinding?.voiceProfile) {
      return matchedCharacterBinding.voiceProfile
    }

    const fallbackProfile = await this.findNarrationFallbackVoice(
      scriptSentence.bookId,
      preferredProvider
    )
    if (fallbackProfile) {
      return fallbackProfile
    }

    if (preferredProvider) {
      return this.findNarrationFallbackVoice(scriptSentence.bookId)
    }

    return null
  }

  private pickBindingByProvider(bindings: any[], provider?: string): any | null {
    if (!Array.isArray(bindings) || bindings.length === 0) {
      return null
    }

    if (provider) {
      const providerMatched =
        bindings.find((binding) => binding.isDefault && binding.voiceProfile?.provider === provider) ||
        bindings.find((binding) => binding.voiceProfile?.provider === provider)
      if (providerMatched) {
        return providerMatched
      }
    }

    return bindings.find((binding) => binding.isDefault) || bindings[0]
  }

  private async findNarrationFallbackVoice(
    bookId: string,
    provider?: string
  ): Promise<any | null> {
    const preferredBinding = await prisma.characterVoiceBinding.findFirst({
      where: {
        character: {
          bookId,
          isActive: true
        },
        voiceProfile: {
          isAvailable: true,
          ...(provider ? { provider } : {})
        }
      },
      include: {
        voiceProfile: true
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    })

    if (preferredBinding?.voiceProfile) {
      return preferredBinding.voiceProfile
    }

    return prisma.tTSVoiceProfile.findFirst({
      where: {
        isAvailable: true,
        ...(provider ? { provider } : {})
      },
      orderBy: [{ rating: 'desc' }, { usageCount: 'desc' }, { createdAt: 'asc' }]
    })
  }

  private normalizeNumber(value: unknown, fallback: number): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private normalizePitch(value: unknown): number {
    const parsed = this.normalizeNumber(value, 0)
    if (parsed >= 0.5 && parsed <= 2) {
      return (parsed - 1) * 20
    }
    return parsed
  }

  private normalizeStrength(value: unknown): number | null {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN
    if (!Number.isFinite(parsed)) {
      return null
    }
    return this.clamp(parsed, 0, 100)
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  private resolveStyleFromTone(tone: string, availableStyles: string[]): string | undefined {
    if (!tone || !Array.isArray(availableStyles) || availableStyles.length === 0) {
      return undefined
    }

    const normalizedTone = tone.toLowerCase()
    const matched = availableStyles.find((style) =>
      normalizedTone.includes(style.toLowerCase())
    )
    if (matched) {
      return matched
    }

    const toneStyleMap: Array<{ keywords: string[]; styleHints: string[] }> = [
      { keywords: ['平静', '冷静', 'calm'], styleHints: ['calm', 'neutral', 'gentle'] },
      { keywords: ['激动', '兴奋', 'cheerful'], styleHints: ['cheerful', 'excited'] },
      { keywords: ['悲伤', '伤心', 'sad'], styleHints: ['sad', 'melancholic'] },
      { keywords: ['愤怒', '生气', 'angry'], styleHints: ['angry', 'serious'] },
      { keywords: ['温柔', '柔和', 'gentle'], styleHints: ['gentle', 'friendly'] },
      { keywords: ['严肃', '庄重', 'serious'], styleHints: ['serious', 'narrative'] }
    ]

    for (const mapping of toneStyleMap) {
      if (!mapping.keywords.some((keyword) => normalizedTone.includes(keyword))) {
        continue
      }
      const style = mapping.styleHints.find((hint) =>
        availableStyles.some((candidate) => candidate.toLowerCase() === hint.toLowerCase())
      )
      if (style) {
        return style
      }
    }

    return undefined
  }

  /**
   * 保存音频文件
   */
  private async saveAudioFile(
    scriptSentence: any,
    voiceProfile: any,
    ttsResponse: any,
    request: AudioGenerationRequest,
    ttsRequest: TTSRequest,
    startedAt: Date | null
  ) {
    // 创建音频文件目录
    const audioDir = getBookAudioDir(scriptSentence.bookId)
    try {
      await mkdir(audioDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create audio directory:', error)
    }

    // 生成文件名
    const timestamp = Date.now()
    const filename = `${scriptSentence.id}_${timestamp}.${request.outputFormat || 'mp3'}`
    const filePath = join(audioDir, filename)

    // 保存音频文件
    await writeFile(filePath, Buffer.from(ttsResponse.audioBuffer))

    // 计算文件大小
    const stats = await import('fs').then(fs => fs.statSync(filePath))
    const fileSize = stats.size

    const durationSeconds = this.resolveAudioDurationSeconds(
      scriptSentence.text,
      ttsResponse?.duration
    )

    const attemptNo =
      (await prisma.synthesisAttempt.count({
        where: {
          sentenceId: scriptSentence.id
        }
      })) + 1

    return prisma.$transaction(async (tx) => {
      const audioFile = await tx.audioFile.create({
        data: {
          sentenceId: scriptSentence.id,
          segmentId: scriptSentence.segmentId,
          chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
          bookId: scriptSentence.bookId,
          voiceProfileId: voiceProfile.id,
          filePath,
          fileName: filename,
          fileSize: BigInt(fileSize),
          duration: durationSeconds,
          format: request.outputFormat || 'mp3',
          status: 'completed',
          attemptNo,
          engineUsed: voiceProfile.provider,
          qualityStatus: 'pending'
        }
      })

      const now = new Date()
      await tx.synthesisAttempt.create({
        data: {
          bookId: scriptSentence.bookId,
          chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
          segmentId: scriptSentence.segmentId,
          sentenceId: scriptSentence.id,
          audioFileId: audioFile.id,
          engine: voiceProfile.provider || 'unknown',
          status: 'completed',
          attemptNo,
          triggerType: 'auto',
          requestPayload: {
            outputFormat: request.outputFormat || 'mp3',
            overrides: request.overrides || {},
            voiceProfileId: voiceProfile.id
          } as Prisma.InputJsonValue,
          appliedParams: {
            speed: ttsRequest.speed,
            pitch: ttsRequest.pitch,
            volume: ttsRequest.volume,
            emotion: ttsRequest.emotion,
            style: ttsRequest.style
          } as Prisma.InputJsonValue,
          metrics: {
            durationSeconds,
            fileSize
          } as Prisma.InputJsonValue,
          startedAt: startedAt ?? now,
          finishedAt: now,
          durationMs: startedAt ? Math.max(0, now.getTime() - startedAt.getTime()) : null,
          isFinal: true
        }
      })

      return audioFile
    })
  }

  private async recordFailedSynthesisAttempt(params: {
    scriptSentence: any
    request: AudioGenerationRequest
    startedAt: Date
    error: unknown
    voiceProfile?: any | null
    ttsRequest?: TTSRequest | null
    fallbackEngine?: string
  }): Promise<void> {
    const {
      scriptSentence,
      request,
      startedAt,
      error,
      voiceProfile,
      ttsRequest,
      fallbackEngine
    } = params

    const now = new Date()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = error instanceof TTSError ? error.code : 'AUDIO_GENERATION_FAILED'
    const attemptNo =
      (await prisma.synthesisAttempt.count({
        where: {
          sentenceId: scriptSentence.id
        }
      })) + 1

    await prisma.synthesisAttempt.create({
      data: {
        bookId: scriptSentence.bookId,
        chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
        segmentId: scriptSentence.segmentId,
        sentenceId: scriptSentence.id,
        engine: voiceProfile?.provider || fallbackEngine || 'unknown',
        status: 'failed',
        attemptNo,
        triggerType: 'auto',
        requestPayload: {
          outputFormat: request.outputFormat || 'mp3',
          overrides: request.overrides || {},
          voiceProfileId: request.voiceProfileId || voiceProfile?.id || null
        } as Prisma.InputJsonValue,
        appliedParams: {
          speed: ttsRequest?.speed ?? null,
          pitch: ttsRequest?.pitch ?? null,
          volume: ttsRequest?.volume ?? null,
          emotion: ttsRequest?.emotion ?? null,
          style: ttsRequest?.style ?? null
        } as Prisma.InputJsonValue,
        metrics: {} as Prisma.InputJsonValue,
        startedAt,
        finishedAt: now,
        durationMs: Math.max(0, now.getTime() - startedAt.getTime()),
        errorCode,
        errorMessage,
        isFinal: false
      }
    })
  }

  /**
   * 估算音频时长（秒）
   */
  private estimateAudioDuration(text: string): number {
    // 中文字符每秒约3-4个，英文单词每秒约2-3个
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length

    const chineseDuration = chineseChars / 3.5 // 中文每秒3.5字
    const englishDuration = englishWords / 2.5 // 英文每秒2.5词
    const totalSeconds = chineseDuration + englishDuration || 0.5

    return Number(totalSeconds.toFixed(2))
  }

  /**
   * 解析最终写入数据库的音频时长（秒）
   */
  private resolveAudioDurationSeconds(text: string, reportedDuration?: number): number {
    const durationSeconds =
      typeof reportedDuration === 'number' && reportedDuration > 0
        ? reportedDuration
        : this.estimateAudioDuration(text)

    return Number(Math.min(durationSeconds, 999.99).toFixed(2))
  }

  /**
   * 重新生成失败的音频
   */
  async regenerateFailedAudio(bookId: string, options: AudioGenerationOptions = {}): Promise<AudioGenerationResult[]> {
    // 查找失败的音频文件
    const failedAudioFiles = await prisma.audioFile.findMany({
      where: {
        bookId,
        status: 'failed'
      },
      include: {
        scriptSentence: true
      }
    })

    if (failedAudioFiles.length === 0) {
      return []
    }

    // 构建重新生成请求
    const requests: AudioGenerationRequest[] = failedAudioFiles
      .filter((audioFile): audioFile is typeof audioFile & { sentenceId: string } => Boolean(audioFile.sentenceId))
      .map(audioFile => ({
        scriptSentenceId: audioFile.sentenceId,
        voiceProfileId: audioFile.voiceProfileId ?? undefined,
        outputFormat: (audioFile.format as 'mp3' | 'wav' | 'ogg') || 'mp3'
      }))

    // 删除失败的记录
    await prisma.audioFile.deleteMany({
      where: {
        id: { in: failedAudioFiles.map(f => f.id) }
      }
    })

    // 重新生成
    return this.generateBatchAudio(requests, options)
  }
}

/**
 * 获取音频生成器实例
 */
export function getAudioGenerator(): AudioGenerator {
  return new AudioGenerator()
}
