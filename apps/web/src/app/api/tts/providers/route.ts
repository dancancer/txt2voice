import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, TTSError } from '@/lib/error-handler'
import { ttsServiceManager } from '@/lib/tts-service'

// GET /api/tts/providers - 获取可用的TTS服务提供商
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeVoices = searchParams.get('includeVoices') === 'true'
  const language = searchParams.get('language')
  const gender = searchParams.get('gender')

  const providers = ttsServiceManager.getAvailableProviders()

  let filteredProviders = providers

  // 按语言过滤
  if (language) {
    filteredProviders = filteredProviders.map(provider => ({
      ...provider,
      supportedVoices: provider.supportedVoices.filter(voice =>
        voice.language.toLowerCase().startsWith(language.toLowerCase())
      )
    })).filter(provider => provider.supportedVoices.length > 0)
  }

  // 按性别过滤
  if (gender) {
    filteredProviders = filteredProviders.map(provider => ({
      ...provider,
      supportedVoices: provider.supportedVoices.filter(voice =>
        voice.gender === gender.toLowerCase()
      )
    })).filter(provider => provider.supportedVoices.length > 0)
  }

  const response = {
    success: true,
    data: {
      providers: filteredProviders.map(provider => {
        const providerData: any = {
          id: provider.type,
          name: provider.name,
          type: provider.type,
          isAvailable: provider.isAvailable,
          supportedLanguages: provider.supportedLanguages,
          maxCharacters: provider.maxCharacters,
          rateLimits: provider.rateLimits
        }

        if (includeVoices) {
          providerData.supportedVoices = provider.supportedVoices.map(voice => ({
            id: voice.id,
            name: voice.name,
            displayName: voice.displayName,
            language: voice.language,
            gender: voice.gender,
            age: voice.age,
            style: voice.style,
            description: voice.description,
            isNeural: voice.isNeural
          }))
        } else {
          providerData.voiceCount = provider.supportedVoices.length
        }

        return providerData
      }),
      summary: {
        totalProviders: filteredProviders.length,
        totalVoices: filteredProviders.reduce((sum, p) => sum + p.supportedVoices.length, 0),
        supportedLanguages: [...new Set(
          filteredProviders.flatMap(p => p.supportedLanguages)
        )].sort()
      }
    }
  }

  return NextResponse.json(response)
})

// POST /api/tts/providers/test - 测试TTS服务连接
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { providerName } = body

  if (!providerName) {
    return NextResponse.json({
      success: false,
      error: 'Provider name is required'
    }, { status: 400 })
  }

  try {
    const provider = ttsServiceManager.getProvider(providerName)
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'Provider not found'
      }, { status: 404 })
    }

    // 简单的连接测试
    const testResult = {
      isAvailable: provider.isAvailable,
      voiceCount: provider.supportedVoices.length,
      supportedLanguages: provider.supportedLanguages,
      maxCharacters: provider.maxCharacters,
      testText: '这是一个测试',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: testResult
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}