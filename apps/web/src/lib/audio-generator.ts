import { TTSError } from './error-handler'
import { ttsServiceManager, TTSRequest } from './tts-service'
import prisma, { Prisma } from './prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

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

    try {
      // 获取台词信息
      const scriptSentence = await prisma.scriptSentence.findUnique({
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
      let voiceProfile = null
      if (request.voiceProfileId) {
        voiceProfile = await prisma.tTSVoiceProfile.findUnique({
          where: { id: request.voiceProfileId }
        })
      } else if (scriptSentence.character) {
        const preferredBinding = scriptSentence.character.voiceBindings.find(b => b.isDefault)
        if (preferredBinding) {
          voiceProfile = preferredBinding.voiceProfile
        } else if (scriptSentence.character.voiceBindings.length > 0) {
          voiceProfile = scriptSentence.character.voiceBindings[0].voiceProfile
        }
      }

      if (!voiceProfile) {
        return {
          success: false,
          error: '未找到可用的声音配置'
        }
      }

      // 构建TTS请求
      const ttsRequest = await this.buildTTSRequest(
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
        request
      )

      return {
        success: true,
        audioFileId: audioFile.id,
        duration: Number(audioFile.duration) ?? undefined,
        fileSize: Number(audioFile.fileSize) ?? undefined
      }

    } catch (error) {
      console.error('音频生成失败:', error)
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
    const requests: AudioGenerationRequest[] = scriptSentences.map(sentence => {
      let voiceProfileId: string | undefined

      if (sentence.character) {
        const preferredBinding = sentence.character.voiceBindings.find((b: any) => b.isDefault)
        if (preferredBinding) {
          voiceProfileId = preferredBinding.voiceProfileId
        } else if (sentence.character.voiceBindings.length > 0) {
          voiceProfileId = sentence.character.voiceBindings[0].voiceProfileId
        }
      }

      return {
        scriptSentenceId: sentence.id,
        voiceProfileId,
        outputFormat: 'mp3'
      }
    })

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
    const requests: AudioGenerationRequest[] = scriptSentences.map(sentence => {
      let voiceProfileId: string | undefined

      if (sentence.character) {
        const preferredBinding = sentence.character.voiceBindings.find((b: any) => b.isDefault)
        if (preferredBinding) {
          voiceProfileId = preferredBinding.voiceProfileId
        } else if (sentence.character.voiceBindings.length > 0) {
          voiceProfileId = sentence.character.voiceBindings[0].voiceProfileId
        }
      }

      return {
        scriptSentenceId: sentence.id,
        voiceProfileId,
        outputFormat: 'mp3'
      }
    })

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

    // 合并设置
    const settings = { ...voiceProfile.settings, ...request.overrides }

    // 确定情感和风格
    let emotion = scriptSentence.emotion
    let style = settings.style || voice.style[0]

    // 如果有情感覆盖设置
    if (request.overrides?.emotion) {
      emotion = request.overrides.emotion
    }

    // 构建请求
    return {
      text: scriptSentence.text,
      voice,
      outputFormat: request.outputFormat || 'mp3',
      speed: settings.speed,
      pitch: settings.pitch,
      volume: settings.volume,
      emotion,
      style
    }
  }

  /**
   * 保存音频文件
   */
  private async saveAudioFile(
    scriptSentence: any,
    voiceProfile: any,
    ttsResponse: any,
    request: AudioGenerationRequest
  ) {
    // 创建音频文件目录
    const audioDir = join(process.cwd(), 'uploads', 'audio', scriptSentence.bookId)
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

    // 创建数据库记录
    const audioFile = await prisma.audioFile.create({
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
        status: 'completed'
      }
    })

    return audioFile
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
