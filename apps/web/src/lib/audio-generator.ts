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
import {
  AudioRouteCandidate,
  AudioRouteContext,
  AudioRouteEngineHealth,
  AudioRouteEmotionPreset,
  AudioRouteSelectionResult,
  RankedAudioRouteCandidate,
  RoutedVoiceProfile,
  selectAudioRouteCandidate,
} from './audio-engine-router'

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
  routerPolicyVersion?: string
  enableRouterDebug?: boolean
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

interface VoiceRouteResolution {
  selectedCandidate: RankedAudioRouteCandidate | null
  rankedCandidates: RankedAudioRouteCandidate[]
  routeDecision: AudioRouteSelectionResult['decision']
}

interface EngineHealthCacheValue {
  expiresAt: number
  snapshot: Record<string, AudioRouteEngineHealth>
}

interface RouteAttemptContext {
  selectedCandidate: RankedAudioRouteCandidate
  rankedCandidates: RankedAudioRouteCandidate[]
  routeDecision: AudioRouteSelectionResult['decision']
  candidateIndex: number
  policyVersion: string
}

const ENGINE_HEALTH_CACHE_TTL_MS = 60 * 1000
const ENGINE_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000
const engineHealthCache = new Map<string, EngineHealthCacheValue>()

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
    let attemptStartedAt: Date | null = null
    let routeResolution: VoiceRouteResolution | null = null
    let lastError: unknown = null

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
              },
              speakerBindings: {
                include: {
                  speakerProfile: {
                    include: {
                      engineVariants: {
                        where: {
                          isActive: true
                        },
                        include: {
                          emotionPresets: {
                            where: {
                              isActive: true
                            }
                          }
                        },
                        orderBy: [
                          { isDefault: 'desc' },
                          { routingWeight: 'desc' },
                          { createdAt: 'asc' }
                        ]
                      }
                    }
                  }
                },
                orderBy: [
                  { isDefault: 'desc' },
                  { createdAt: 'asc' }
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
      routeResolution = await this.resolveVoiceRouteForSentence(
        scriptSentence,
        request,
        finalOptions
      )

      if (!routeResolution?.selectedCandidate) {
        try {
          await this.recordFailedSynthesisAttempt({
            scriptSentence,
            request,
            startedAt: attemptStartedAt,
            routeAttemptContext: routeResolution
              ? this.createRouteAttemptContext({
                  routeResolution,
                  selectedCandidate: routeResolution.rankedCandidates[0] || null,
                  candidateIndex: 0,
                })
              : undefined,
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

      const attemptCandidates = routeResolution.rankedCandidates.filter(
        (candidate) => candidate.eligible && Boolean(candidate.voiceProfile)
      )

      for (let index = 0; index < attemptCandidates.length; index += 1) {
        const candidate = attemptCandidates[index]
        const voiceProfile = candidate.voiceProfile
        if (!voiceProfile) {
          continue
        }

        const routeAttemptContext = this.createRouteAttemptContext({
          routeResolution,
          selectedCandidate: candidate,
          candidateIndex: index,
        })
        const effectiveRequest = this.applyRouterPresetToRequest(
          request,
          candidate.matchedPreset
        )
        let ttsRequest: TTSRequest | null = null

        try {
          // 构建TTS请求
          ttsRequest = await this.buildTTSRequest(
            scriptSentence,
            voiceProfile,
            effectiveRequest,
            routeAttemptContext
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
            effectiveRequest,
            ttsRequest,
            attemptStartedAt,
            routeAttemptContext
          )

          return {
            success: true,
            audioFileId: audioFile.id,
            duration: Number(audioFile.duration) ?? undefined,
            fileSize: Number(audioFile.fileSize) ?? undefined,
            metadata: {
              routerDecision: routeAttemptContext.routeDecision,
              routerPolicyVersion: routeAttemptContext.policyVersion,
              fallbackDepth: routeAttemptContext.routeDecision.fallbackDepth,
              attemptCandidateId: candidate.candidateId,
              attemptSource: candidate.source,
              attemptEngine: candidate.provider,
            }
          }
        } catch (error) {
          lastError = error
          const isFinalAttempt = index >= attemptCandidates.length - 1
          try {
            await this.recordFailedSynthesisAttempt({
              scriptSentence,
              voiceProfile,
              request: effectiveRequest,
              ttsRequest,
              startedAt: attemptStartedAt,
              fallbackEngine: finalOptions.provider || scriptSentence.engineHint || undefined,
              routeAttemptContext,
              error,
              isFinal: isFinalAttempt
            })
          } catch (persistError) {
            console.warn('写入失败合成尝试记录失败:', persistError)
          }

          if (!isFinalAttempt && finalOptions.enableRouterDebug) {
            console.warn('音频路由降级重试', {
              sentenceId: request.scriptSentenceId,
              candidateId: candidate.candidateId,
              provider: candidate.provider,
              error: error instanceof Error ? error.message : 'unknown',
            })
          }
        }
      }

      return {
        success: false,
        error: lastError instanceof Error ? lastError.message : '音频生成失败：全部路由候选均失败',
        metadata: {
          routerDecision: routeResolution.routeDecision,
        }
      }

    } catch (error) {
      console.error('音频生成失败:', error)
      if (scriptSentence && attemptStartedAt && !routeResolution?.selectedCandidate) {
        try {
          await this.recordFailedSynthesisAttempt({
            scriptSentence,
            request,
            startedAt: attemptStartedAt,
            fallbackEngine: finalOptions.provider || scriptSentence.engineHint || undefined,
            routeAttemptContext: routeResolution
              ? this.createRouteAttemptContext({
                  routeResolution,
                  selectedCandidate: routeResolution.rankedCandidates[0] || null,
                  candidateIndex: 0,
                })
              : undefined,
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
    request: AudioGenerationRequest,
    routeAttemptContext?: RouteAttemptContext
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
    const routeEmotion = routeAttemptContext?.routeDecision.emotionLabel || undefined
    const emotion = request.overrides?.emotion || routeEmotion || tone || undefined
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

  private async resolveVoiceRouteForSentence(
    scriptSentence: any,
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ): Promise<VoiceRouteResolution | null> {
    const policyVersion = this.resolveRouterPolicyVersion(scriptSentence, options)
    const preferredProvider =
      typeof options.provider === 'string' && options.provider.trim()
        ? options.provider.trim().toLowerCase()
        : null
    const context: AudioRouteContext = {
      roleType: typeof scriptSentence.roleType === 'string' ? scriptSentence.roleType : null,
      emotionLabel:
        typeof scriptSentence.emotionLabel === 'string' && scriptSentence.emotionLabel.trim()
          ? scriptSentence.emotionLabel
          : scriptSentence.tone,
      priority: typeof scriptSentence.priority === 'string' ? scriptSentence.priority : null,
      engineHint: typeof scriptSentence.engineHint === 'string' ? scriptSentence.engineHint : null,
      preferredProvider,
      policyVersion,
      debugEnabled: options.enableRouterDebug === true,
    }

    const candidates = await this.collectRouteCandidates({
      scriptSentence,
      request,
      options,
    })

    if (candidates.length === 0) {
      return null
    }

    const providers = Array.from(
      new Set(
        candidates
          .map((candidate) => candidate.provider.trim().toLowerCase())
          .filter((provider) => provider.length > 0)
      )
    )

    const engineHealth = await this.getEngineHealthSnapshot(scriptSentence.bookId, providers)
    const selection = selectAudioRouteCandidate({
      candidates,
      context,
      engineHealth,
    })

    return {
      selectedCandidate: selection.selectedCandidate,
      rankedCandidates: selection.rankedCandidates,
      routeDecision: selection.decision,
    }
  }

  private resolveRouterPolicyVersion(
    scriptSentence: any,
    options: AudioGenerationOptions
  ): string {
    if (
      typeof options.routerPolicyVersion === 'string' &&
      options.routerPolicyVersion.trim().length > 0
    ) {
      return options.routerPolicyVersion.trim()
    }

    const metadata = asRecord(scriptSentence?.book?.metadata)
    const audioRouter = asRecord(metadata?.audioRouter)
    const metadataVersion =
      (typeof audioRouter?.policyVersion === 'string' && audioRouter.policyVersion.trim()) ||
      (typeof metadata?.routerPolicyVersion === 'string' && metadata.routerPolicyVersion.trim())

    if (metadataVersion) {
      return metadataVersion
    }

    return 'engine-router-v1'
  }

  private async collectRouteCandidates({
    scriptSentence,
    request,
    options,
  }: {
    scriptSentence: any
    request: AudioGenerationRequest
    options: AudioGenerationOptions
  }): Promise<AudioRouteCandidate[]> {
    const preferredProvider =
      typeof options.provider === 'string' && options.provider.trim()
        ? options.provider.trim().toLowerCase()
        : null
    const candidates: AudioRouteCandidate[] = []

    if (request.voiceProfileId) {
      const selectedProfile = await prisma.tTSVoiceProfile.findUnique({
        where: { id: request.voiceProfileId }
      })
      if (!selectedProfile) {
        return []
      }
      if (preferredProvider && selectedProfile.provider !== preferredProvider) {
        return []
      }

      candidates.push({
        candidateId: `manual:${selectedProfile.id}`,
        source: 'manual_voice_profile',
        provider: selectedProfile.provider,
        voiceId: selectedProfile.voiceId,
        voiceProfile: {
          id: selectedProfile.id,
          provider: selectedProfile.provider,
          voiceId: selectedProfile.voiceId,
          defaultParameters: asRecord(selectedProfile.defaultParameters),
        },
        isDefault: true,
        routingWeight: 1,
      })

      return candidates
    }

    const speakerBindings = scriptSentence.character?.speakerBindings || []
    for (const speakerBinding of speakerBindings) {
      const speakerProfile = speakerBinding.speakerProfile
      if (!speakerProfile?.isActive) {
        continue
      }

      const engineVariants = speakerProfile.engineVariants || []
      for (const variant of engineVariants) {
        const provider = typeof variant.engine === 'string' ? variant.engine.trim().toLowerCase() : ''
        if (!provider) {
          continue
        }
        if (preferredProvider && provider !== preferredProvider) {
          continue
        }

        const voiceId = this.resolveVariantVoiceId(provider, variant.providerVoiceId)
        const emotionPresets = this.parseEmotionPresets(variant.emotionPresets || [])
        const capability = asRecord(variant.capability) || {}
        const defaultParameters = {
          ...(asRecord(capability.defaultParameters) || {}),
        } as Record<string, unknown>

        candidates.push({
          candidateId: `variant:${variant.id}`,
          source: 'speaker_engine_variant',
          provider,
          voiceId,
          voiceProfile: voiceId
            ? ({
                provider,
                voiceId,
                defaultParameters,
              } as RoutedVoiceProfile)
            : null,
          isDefault: Boolean(variant.isDefault || speakerBinding.isDefault),
          routingWeight: this.toFiniteNumber(variant.routingWeight, 1) ?? 1,
          capability,
          speakerProfileId: speakerProfile.id,
          speakerEngineVariantId: variant.id,
          emotionPresets,
        })
      }
    }

    const characterBindings = scriptSentence.character?.voiceBindings || []
    for (const binding of characterBindings) {
      const voiceProfile = binding.voiceProfile
      if (!voiceProfile || voiceProfile.isAvailable === false) {
        continue
      }

      const provider = typeof voiceProfile.provider === 'string'
        ? voiceProfile.provider.trim().toLowerCase()
        : ''
      if (!provider) {
        continue
      }
      if (preferredProvider && provider !== preferredProvider) {
        continue
      }

      candidates.push({
        candidateId: `binding:${binding.id}`,
        source: 'character_voice_binding',
        provider,
        voiceId: voiceProfile.voiceId,
        voiceProfile: {
          id: voiceProfile.id,
          provider,
          voiceId: voiceProfile.voiceId,
          defaultParameters: asRecord(voiceProfile.defaultParameters),
        },
        isDefault: Boolean(binding.isDefault),
        routingWeight: 1,
      })
    }

    const narrationFallback = await this.findNarrationFallbackVoice(
      scriptSentence.bookId,
      preferredProvider || undefined
    )
    if (narrationFallback) {
      candidates.push({
        candidateId: `fallback:${narrationFallback.id}`,
        source: 'narration_fallback',
        provider: narrationFallback.provider,
        voiceId: narrationFallback.voiceId,
        voiceProfile: {
          id: narrationFallback.id,
          provider: narrationFallback.provider,
          voiceId: narrationFallback.voiceId,
          defaultParameters: asRecord(narrationFallback.defaultParameters),
        },
        isDefault: true,
        routingWeight: 1,
      })
    }

    return candidates
  }

  private parseEmotionPresets(rawPresets: any[]): AudioRouteEmotionPreset[] {
    if (!Array.isArray(rawPresets) || rawPresets.length === 0) {
      return []
    }

    return rawPresets
      .map((preset) => {
        const aliases = Array.isArray(preset?.rawAliases)
          ? preset.rawAliases.filter((alias: unknown): alias is string => typeof alias === 'string')
          : []
        const normalizedLabel =
          typeof preset?.emotionLabel === 'string' ? preset.emotionLabel.trim() : ''
        if (!normalizedLabel) {
          return null
        }

        return {
          emotionLabel: normalizedLabel,
          aliases,
          intensityDefault: this.toFiniteNumber(preset?.intensityDefault, null),
          prosodyPreset: asRecord(preset?.prosodyPreset) || {},
          engineParams: asRecord(preset?.engineParams) || {},
        } as AudioRouteEmotionPreset
      })
      .filter((preset): preset is AudioRouteEmotionPreset => Boolean(preset))
  }

  private resolveVariantVoiceId(provider: string, providerVoiceId: unknown): string | null {
    if (typeof providerVoiceId === 'string' && providerVoiceId.trim().length > 0) {
      return providerVoiceId.trim()
    }

    if (provider === 'voxcpm') {
      return '__voxcpm_default__'
    }

    return null
  }

  private toFiniteNumber(value: unknown, fallback: number | null): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return fallback
  }

  private async getEngineHealthSnapshot(
    bookId: string,
    providers: string[]
  ): Promise<Record<string, AudioRouteEngineHealth>> {
    if (providers.length === 0) {
      return {}
    }

    const cacheKey = `${bookId}:${providers.slice().sort().join(',')}`
    const now = Date.now()
    const cached = engineHealthCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.snapshot
    }

    const attempts = await prisma.synthesisAttempt.findMany({
      where: {
        bookId,
        engine: {
          in: providers,
        },
        startedAt: {
          gte: new Date(now - ENGINE_HEALTH_WINDOW_MS),
        },
      },
      select: {
        engine: true,
        status: true,
        errorCode: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 300,
    })

    const snapshot: Record<string, AudioRouteEngineHealth> = {}
    for (const provider of providers) {
      const providerAttempts = attempts.filter((attempt) => attempt.engine === provider)
      const total = providerAttempts.length
      const failed = providerAttempts.filter((attempt) => attempt.status === 'failed').length
      const timeoutFailed = providerAttempts.filter((attempt) => {
        if (attempt.status !== 'failed') {
          return false
        }
        const code = typeof attempt.errorCode === 'string' ? attempt.errorCode.toUpperCase() : ''
        return code.includes('TIMEOUT') || code.includes('RATE_LIMIT')
      }).length
      const failureRate = total > 0 ? Number((failed / total).toFixed(4)) : 0
      const timeoutRate = total > 0 ? Number((timeoutFailed / total).toFixed(4)) : 0
      const healthy = total < 5 || (failureRate <= 0.45 && timeoutRate <= 0.25)

      snapshot[provider] = {
        provider,
        sampleSize: total,
        failureRate,
        timeoutRate,
        healthy,
        updatedAt: new Date(now).toISOString(),
      }
    }

    engineHealthCache.set(cacheKey, {
      expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
      snapshot,
    })

    return snapshot
  }

  private applyRouterPresetToRequest(
    request: AudioGenerationRequest,
    preset: AudioRouteEmotionPreset | null
  ): AudioGenerationRequest {
    if (!preset) {
      return request
    }

    const engineParams = preset.engineParams || {}
    const speed = this.toFiniteNumber(engineParams.speed ?? engineParams.rate, null)
    const pitch = this.toFiniteNumber(engineParams.pitch, null)
    const volume = this.toFiniteNumber(engineParams.volume, null)
    const style =
      typeof engineParams.style === 'string' && engineParams.style.trim().length > 0
        ? engineParams.style.trim()
        : undefined

    const overrides = {
      ...(request.overrides || {}),
      ...(speed !== null ? { speed } : {}),
      ...(pitch !== null ? { pitch } : {}),
      ...(volume !== null ? { volume } : {}),
      ...(style ? { style } : {}),
      ...(request.overrides?.emotion
        ? {}
        : {
            emotion: preset.emotionLabel,
          }),
    }

    return {
      ...request,
      overrides,
    }
  }

  private createRouteAttemptContext({
    routeResolution,
    selectedCandidate,
    candidateIndex,
  }: {
    routeResolution: VoiceRouteResolution
    selectedCandidate: RankedAudioRouteCandidate | null
    candidateIndex: number
  }): RouteAttemptContext {
    const candidate = selectedCandidate || routeResolution.selectedCandidate || routeResolution.rankedCandidates[0]
    if (!candidate) {
      const placeholderCandidate: RankedAudioRouteCandidate = {
        candidateId: 'unknown',
        source: 'narration_fallback',
        provider: 'unknown',
        voiceId: null,
        voiceProfile: null,
        isDefault: false,
        routingWeight: 0,
        score: 0,
        eligible: false,
        healthy: false,
        rule: 'none',
        reason: ['missing_candidate'],
        presetMatch: 'none',
        matchedPreset: null,
      }
      return {
        selectedCandidate: placeholderCandidate,
        rankedCandidates: routeResolution.rankedCandidates,
        routeDecision: routeResolution.routeDecision,
        candidateIndex,
        policyVersion: routeResolution.routeDecision.policyVersion,
      }
    }

    const selectedIndex = routeResolution.rankedCandidates.findIndex(
      (item) => item.candidateId === candidate.candidateId
    )
    const fallbackDepth = selectedIndex < 0 ? 0 : selectedIndex
    const fallbackPath = fallbackDepth > 0
      ? routeResolution.rankedCandidates.slice(0, fallbackDepth).map((item) => ({
          candidateId: item.candidateId,
          provider: item.provider,
          source: item.source,
          reason: item.reason,
        }))
      : []
    const routeDecision = {
      ...routeResolution.routeDecision,
      selectedEngine: candidate.provider,
      selectedVoiceId: candidate.voiceId,
      selectedSource: candidate.source,
      selectedRule: candidate.rule,
      selectedCandidateId: candidate.candidateId,
      fallbackDepth,
      isFallback: fallbackDepth > 0 || candidate.source === 'narration_fallback',
      fallbackPath,
    }

    return {
      selectedCandidate: candidate,
      rankedCandidates: routeResolution.rankedCandidates,
      routeDecision,
      candidateIndex,
      policyVersion: routeDecision.policyVersion,
    }
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

  private buildRouteAttemptPayload(routeAttemptContext?: RouteAttemptContext): {
    policyVersion: string | null
    fallbackDepth: number | null
    selection: Record<string, unknown> | null
    routerDecision: Record<string, unknown> | null
  } {
    if (!routeAttemptContext) {
      return {
        policyVersion: null,
        fallbackDepth: null,
        selection: null,
        routerDecision: null,
      }
    }

    const selection = {
      candidateId: routeAttemptContext.selectedCandidate.candidateId,
      provider: routeAttemptContext.selectedCandidate.provider,
      source: routeAttemptContext.selectedCandidate.source,
      rule: routeAttemptContext.selectedCandidate.rule,
      presetMatch: routeAttemptContext.selectedCandidate.presetMatch,
      speakerProfileId: routeAttemptContext.selectedCandidate.speakerProfileId || null,
      speakerEngineVariantId:
        routeAttemptContext.selectedCandidate.speakerEngineVariantId || null,
      candidateIndex: routeAttemptContext.candidateIndex,
    }

    return {
      policyVersion: routeAttemptContext.policyVersion,
      fallbackDepth: routeAttemptContext.routeDecision.fallbackDepth,
      selection,
      routerDecision: routeAttemptContext.routeDecision as unknown as Record<string, unknown>,
    }
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
    startedAt: Date | null,
    routeAttemptContext?: RouteAttemptContext
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
          voiceProfileId: typeof voiceProfile.id === 'string' ? voiceProfile.id : null,
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
      const routePayload = this.buildRouteAttemptPayload(routeAttemptContext)
      await tx.synthesisAttempt.create({
        data: {
          bookId: scriptSentence.bookId,
          chapterId: scriptSentence.chapterId ?? scriptSentence.segment?.chapterId,
          segmentId: scriptSentence.segmentId,
          sentenceId: scriptSentence.id,
          audioFileId: audioFile.id,
          speakerProfileId: routeAttemptContext?.selectedCandidate.speakerProfileId || null,
          speakerEngineVariantId:
            routeAttemptContext?.selectedCandidate.speakerEngineVariantId || null,
          engine: voiceProfile.provider || 'unknown',
          status: 'completed',
          attemptNo,
          triggerType: 'auto',
          requestPayload: {
            outputFormat: request.outputFormat || 'mp3',
            overrides: request.overrides || {},
            voiceProfileId:
              request.voiceProfileId ||
              (typeof voiceProfile.id === 'string' ? voiceProfile.id : null),
            routerDecision: routePayload.routerDecision,
            routerPolicyVersion: routePayload.policyVersion,
          } as Prisma.InputJsonValue,
          appliedParams: {
            speed: ttsRequest.speed,
            pitch: ttsRequest.pitch,
            volume: ttsRequest.volume,
            emotion: ttsRequest.emotion,
            style: ttsRequest.style,
            routerSelection: routePayload.selection,
          } as Prisma.InputJsonValue,
          metrics: {
            durationSeconds,
            fileSize,
            routerFallbackDepth: routePayload.fallbackDepth,
            routerCandidateIndex: routeAttemptContext?.candidateIndex ?? null,
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
    routeAttemptContext?: RouteAttemptContext
    isFinal?: boolean
  }): Promise<void> {
    const {
      scriptSentence,
      request,
      startedAt,
      error,
      voiceProfile,
      ttsRequest,
      fallbackEngine,
      routeAttemptContext,
      isFinal = false,
    } = params

    const now = new Date()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = error instanceof TTSError ? error.code : 'AUDIO_GENERATION_FAILED'
    const routePayload = this.buildRouteAttemptPayload(routeAttemptContext)
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
        speakerProfileId: routeAttemptContext?.selectedCandidate.speakerProfileId || null,
        speakerEngineVariantId:
          routeAttemptContext?.selectedCandidate.speakerEngineVariantId || null,
        engine: voiceProfile?.provider || fallbackEngine || 'unknown',
        status: 'failed',
        attemptNo,
        triggerType: 'auto',
        requestPayload: {
          outputFormat: request.outputFormat || 'mp3',
          overrides: request.overrides || {},
          voiceProfileId:
            request.voiceProfileId ||
            (typeof voiceProfile?.id === 'string' ? voiceProfile.id : null),
          routerDecision: routePayload.routerDecision,
          routerPolicyVersion: routePayload.policyVersion,
        } as Prisma.InputJsonValue,
        appliedParams: {
          speed: ttsRequest?.speed ?? null,
          pitch: ttsRequest?.pitch ?? null,
          volume: ttsRequest?.volume ?? null,
          emotion: ttsRequest?.emotion ?? null,
          style: ttsRequest?.style ?? null,
          routerSelection: routePayload.selection,
        } as Prisma.InputJsonValue,
        metrics: {
          routerFallbackDepth: routeAttemptContext?.routeDecision.fallbackDepth ?? null,
          routerCandidateIndex: routeAttemptContext?.candidateIndex ?? null,
        } as Prisma.InputJsonValue,
        startedAt,
        finishedAt: now,
        durationMs: Math.max(0, now.getTime() - startedAt.getTime()),
        errorCode,
        errorMessage,
        isFinal
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
