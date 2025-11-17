import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import { ttsServiceManager } from '@/lib/tts-service'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// 声音配置验证Schema
const voiceProfileSchema = z.object({
  name: z.string().min(1, '声音名称不能为空'),
  provider: z.string().min(1, 'TTS提供商不能为空'),
  voiceId: z.string().min(1, '声音ID不能为空'),
  language: z.string().min(1, '语言不能为空'),
  gender: z.enum(['male', 'female', 'neutral']),
  ageRange: z.string().optional(),
  style: z.array(z.string()).optional(),
  description: z.string().optional(),
  sampleRate: z.number().int().positive().optional(),
  settings: z.object({
    speed: z.number().min(0.1).max(2.0).default(1.0),
    pitch: z.number().min(-20).max(20).default(0),
    volume: z.number().min(0).max(1).default(1.0)
  }).optional()
})

// GET /api/tts/voices - 获取所有可用声音
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const language = searchParams.get('language')
  const gender = searchParams.get('gender')
  const includeCustom = searchParams.get('includeCustom') !== 'false'
  const search = searchParams.get('search')

  await ttsServiceManager.ready()
  // 获取系统内置声音
  const providers = ttsServiceManager.getAvailableProviders()
  let systemVoices: any[] = []

  providers.forEach(p => {
    if (!provider || p.type === provider) {
      const voices = p.supportedVoices
        .filter(voice => {
          if (language && !voice.language.toLowerCase().startsWith(language.toLowerCase())) {
            return false
          }
          if (gender && voice.gender !== gender.toLowerCase()) {
            return false
          }
          if (search && !voice.displayName.toLowerCase().includes(search.toLowerCase()) &&
              !voice.name.toLowerCase().includes(search.toLowerCase())) {
            return false
          }
          return true
        })
        .map(voice => ({
          id: voice.id,
          name: voice.name,
          displayName: voice.displayName,
          provider: p.type,
          providerName: p.name,
          language: voice.language,
          gender: voice.gender,
          age: voice.age,
          style: voice.style,
          description: voice.description,
          isNeural: voice.isNeural,
          sampleRate: voice.sampleRate,
          isCustom: false,
          isAvailable: true
        }))

      systemVoices.push(...voices)
    }
  })

  let customVoices: any[] = []
  if (includeCustom) {
    // 获取自定义声音配置
    const customVoiceProfiles = await prisma.tTSVoiceProfile.findMany({
      where: {
        isAvailable: true,
        ...(provider && { provider }),
        ...(search && {
          OR: [
            { voiceName: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        _count: {
          select: { voiceBindings: true }
        }
      },
      orderBy: [
        { rating: 'desc' },
        { usageCount: 'desc' },
        { voiceName: 'asc' }
      ]
    })

    customVoices = customVoiceProfiles.map((profile: any) => ({
      id: profile.id,
      name: profile.voiceName,
      displayName: profile.displayName,
      provider: profile.provider,
      providerName: profile.provider,
      language: (profile.characteristics as any)?.language || 'en',
      gender: (profile.characteristics as any)?.gender || 'neutral',
      ageRange: (profile.characteristics as any)?.ageRange,
      style: (profile.characteristics as any)?.style || [],
      description: profile.description,
      isCustom: true,
      isDefault: false,
      settings: profile.defaultParameters,
      createdAt: profile.createdAt,
      usageCount: profile._count?.voiceBindings || 0,
      rating: Number(profile.rating)
    }))
  }

  const allVoices = [...systemVoices, ...customVoices]

  return NextResponse.json({
    success: true,
    data: {
      voices: allVoices,
      summary: {
        total: allVoices.length,
        system: systemVoices.length,
        custom: customVoices.length,
        byProvider: providers.reduce((acc, p) => {
          acc[p.type] = allVoices.filter(v => v.provider === p.type).length
          return acc
        }, {} as Record<string, number>),
        byLanguage: allVoices.reduce((acc, v) => {
          acc[v.language] = (acc[v.language] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        byGender: allVoices.reduce((acc, v) => {
          acc[v.gender] = (acc[v.gender] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }
  })
})

// POST /api/tts/voices - 创建自定义声音配置
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  const validatedData = voiceProfileSchema.parse(body)

  await ttsServiceManager.ready()
  // 检查提供商是否支持该声音
  const provider = ttsServiceManager.getProvider(validatedData.provider)
  if (!provider) {
    throw new ValidationError('不支持的TTS提供商')
  }

  const voice = await ttsServiceManager.getVoice(validatedData.provider, validatedData.voiceId)
  if (!voice) {
    throw new ValidationError('提供商不支持该声音')
  }

  // 检查是否已存在相同的配置
  const existingProfile = await prisma.tTSVoiceProfile.findFirst({
    where: {
      provider: validatedData.provider,
      voiceId: validatedData.voiceId,
      isAvailable: true
    }
  })

  if (existingProfile) {
    throw new ValidationError('该声音配置已存在')
  }

  // 创建声音配置
  const profile = await prisma.tTSVoiceProfile.create({
    data: {
      voiceId: validatedData.voiceId,
      voiceName: validatedData.name,
      displayName: validatedData.name,
      provider: validatedData.provider,
      description: validatedData.description || voice.description,
      characteristics: {
        language: validatedData.language,
        gender: validatedData.gender,
        ageRange: validatedData.ageRange || voice.age,
        style: validatedData.style || voice.style || []
      },
      defaultParameters: validatedData.settings || {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      },
      isAvailable: true
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: profile.id,
      name: profile.voiceName,
      displayName: profile.displayName,
      provider: profile.provider,
      voiceId: profile.voiceId,
      language: (profile.characteristics as any)?.language,
      gender: (profile.characteristics as any)?.gender,
      ageRange: (profile.characteristics as any)?.ageRange,
      style: (profile.characteristics as any)?.style,
      description: profile.description,
      settings: profile.defaultParameters,
      createdAt: profile.createdAt
    }
  }, { status: 201 })
})

// PUT /api/tts/voices - 批量更新声音配置
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { voiceProfiles } = body

  if (!Array.isArray(voiceProfiles) || voiceProfiles.length === 0) {
    throw new ValidationError('声音配置列表不能为空')
  }

  const results = []

  for (const profileData of voiceProfiles) {
    try {
      const validatedData = voiceProfileSchema.partial().parse(profileData)

      const updatedProfile = await prisma.tTSVoiceProfile.update({
        where: { id: profileData.id },
        data: validatedData.name ? {
          voiceName: validatedData.name,
          displayName: validatedData.name
        } : {}
      })

      results.push({
        id: updatedProfile.id,
        success: true
      })
    } catch (error) {
      results.push({
        id: profileData.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  })
})

// DELETE /api/tts/voices - 批量删除声音配置
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const voiceIds = searchParams.get('ids')

  if (!voiceIds) {
    throw new ValidationError('请提供要删除的声音ID列表')
  }

  const ids = voiceIds.split(',').filter(id => id.trim())

  if (ids.length === 0) {
    throw new ValidationError('声音ID列表不能为空')
  }

  // 检查是否有关联的角色绑定
  const voiceBindings = await prisma.characterVoiceBinding.findMany({
    where: {
      voiceProfileId: { in: ids }
    }
  })

  if (voiceBindings.length > 0) {
    throw new ValidationError('有声音配置已绑定到角色，无法删除')
  }

  // 软删除声音配置
  const result = await prisma.tTSVoiceProfile.updateMany({
    where: {
      id: { in: ids }
    },
    data: {
      isAvailable: false
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      deleted: result.count,
      message: `已删除 ${result.count} 个声音配置`
    }
  })
})
