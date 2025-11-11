import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { ttsServiceManager } from '@/lib/tts-service'
import { z } from 'zod'

// 声音绑定验证Schema
const voiceBindingSchema = z.object({
  voiceProfileId: z.string().min(1, '声音配置ID不能为空'),
  isPreferred: z.boolean().default(false),
  emotionOverrides: z.record(z.string(), z.string()).optional(),
  settings: z.object({
    speed: z.number().min(0.1).max(2.0).optional(),
    pitch: z.number().min(-20).max(20).optional(),
    volume: z.number().min(0).max(1).optional()
  }).optional()
})

const toJsonValue = (value?: Record<string, unknown>): Prisma.InputJsonValue =>
  (value ?? {}) as Prisma.InputJsonValue

// GET /api/books/[id]/characters/[characterId]/voices - 获取角色的声音绑定
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const includeVoiceDetails = searchParams.get('includeVoiceDetails') === 'true'

  const { id: bookId, characterId } = await params
  // 验证书籍和角色是否存在
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  const whereClause: any = {
    characterId: characterId
  }

  const voiceBindings = await prisma.characterVoiceBinding.findMany({
    where: whereClause,
    include: {
      voiceProfile: true
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' }
    ]
  })

  // 如果有详细声音信息，获取TTS服务信息
  let enhancedBindings = voiceBindings
  if (includeVoiceDetails) {
    enhancedBindings = await Promise.all(voiceBindings.map(async (binding) => {
      const provider = ttsServiceManager.getProvider(binding.voiceProfile.provider)
      const voice = provider ? await ttsServiceManager.getVoice(
        binding.voiceProfile.provider,
        binding.voiceProfile.voiceId
      ) : null

      return {
        ...binding,
        voiceProfile: {
          ...binding.voiceProfile,
          providerInfo: provider ? {
            name: provider.name,
            isAvailable: provider.isAvailable,
            maxCharacters: provider.maxCharacters
          } : null,
          voiceInfo: voice
        }
      }
    }))
  }

  return NextResponse.json({
    success: true,
    data: {
      characterId: characterId,
      characterName: character.canonicalName,
      voiceBindings: enhancedBindings.map(binding => ({
        id: binding.id,
        voiceProfileId: binding.voiceProfileId,
        isPreferred: binding.isDefault,
        emotionOverrides: (binding.emotionMappings as any)?.emotionOverrides,
        settings: (binding.customParameters as any)?.settings,
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
        ...(includeVoiceDetails && {
          voiceProfile: binding.voiceProfile
        })
      })),
      summary: {
        totalBindings: voiceBindings.length,
        preferredBinding: voiceBindings.find(b => b.isDefault),
        supportedProviders: [...new Set(voiceBindings.map(b => b.voiceProfile.provider))]
      }
    }
  })
})

// POST /api/books/[id]/characters/[characterId]/voices - 为角色绑定声音
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const body = await request.json()
  const validatedData = voiceBindingSchema.parse(body)

  const { id: bookId, characterId } = await params
  // 验证书籍和角色是否存在
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  // 验证声音配置是否存在
  const voiceProfile = await prisma.tTSVoiceProfile.findUnique({
    where: { id: validatedData.voiceProfileId }
  })

  if (!voiceProfile) {
    throw new ValidationError('声音配置不存在')
  }

  // 检查是否已经绑定过该声音
  const existingBinding = await prisma.characterVoiceBinding.findFirst({
    where: {
      characterId: characterId,
      voiceProfileId: validatedData.voiceProfileId
    }
  })

  if (existingBinding) {
    throw new ValidationError('该声音已经绑定到此角色')
  }

  // 如果设置为首选，取消其他首选绑定
  if (validatedData.isPreferred) {
    await prisma.characterVoiceBinding.updateMany({
      where: {
        characterId: characterId,
        isDefault: true
      },
      data: {
        isDefault: false
      }
    })
  }

  // 创建声音绑定
  const binding = await prisma.characterVoiceBinding.create({
    data: {
      characterId: characterId,
      voiceProfileId: validatedData.voiceProfileId,
      isDefault: validatedData.isPreferred,
      emotionMappings: toJsonValue({ emotionOverrides: validatedData.emotionOverrides }),
      customParameters: toJsonValue({ settings: validatedData.settings })
    }
  })

  // 获取完整的绑定信息
  const createdBinding = await prisma.characterVoiceBinding.findUnique({
    where: { id: binding.id },
    include: {
      voiceProfile: true
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: createdBinding!.id,
      characterId: createdBinding!.characterId,
      voiceProfile: createdBinding!.voiceProfile,
      isPreferred: createdBinding!.isDefault,
      emotionOverrides: (createdBinding!.emotionMappings as any)?.emotionOverrides,
      settings: (createdBinding!.customParameters as any)?.settings,
      createdAt: createdBinding!.createdAt
    }
  }, { status: 201 })
})

// PUT /api/books/[id]/characters/[characterId]/voices - 更新声音绑定
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const body = await request.json()
  const { bindingId, updates } = body

  if (!bindingId) {
    throw new ValidationError('绑定ID不能为空')
  }

  const validatedUpdates = voiceBindingSchema.partial().parse(updates)

  const { id: bookId, characterId } = await params
  // 验证书籍和角色是否存在
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  // 验证绑定是否存在
  const existingBinding = await prisma.characterVoiceBinding.findFirst({
    where: {
      id: bindingId,
      characterId: characterId
    }
  })

  if (!existingBinding) {
    throw new ValidationError('声音绑定不存在')
  }

  // 如果设置为首选，取消其他首选绑定
  if (validatedUpdates.isPreferred === true) {
    await prisma.characterVoiceBinding.updateMany({
      where: {
        characterId: characterId,
        id: { not: bindingId },
        isDefault: true
      },
      data: {
        isDefault: false
      }
    })
  }

  // 更新绑定
  const updateData: Prisma.CharacterVoiceBindingUpdateInput = {
    updatedAt: new Date()
  }

  if (validatedUpdates.isPreferred !== undefined) {
    updateData.isDefault = validatedUpdates.isPreferred
  }

  if (validatedUpdates.emotionOverrides !== undefined) {
    updateData.emotionMappings = toJsonValue({ emotionOverrides: validatedUpdates.emotionOverrides })
  }

  if (validatedUpdates.settings !== undefined) {
    updateData.customParameters = toJsonValue({ settings: validatedUpdates.settings as Record<string, unknown> })
  }

  if (validatedUpdates.voiceProfileId) {
    updateData.voiceProfile = {
      connect: { id: validatedUpdates.voiceProfileId }
    }
  }

  const updatedBinding = await prisma.characterVoiceBinding.update({
    where: { id: bindingId },
    data: updateData,
    include: {
      voiceProfile: true
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: updatedBinding.id,
      characterId: updatedBinding.characterId,
      voiceProfile: updatedBinding.voiceProfile,
      isPreferred: updatedBinding.isDefault,
      emotionOverrides: (updatedBinding.emotionMappings as any)?.emotionOverrides,
      settings: (updatedBinding.customParameters as any)?.settings,
      updatedAt: updatedBinding.updatedAt
    }
  })
})

// DELETE /api/books/[id]/characters/[characterId]/voices - 删除声音绑定
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const bindingId = searchParams.get('bindingId')

  if (!bindingId) {
    throw new ValidationError('绑定ID不能为空')
  }

  const { id: bookId, characterId } = await params
  // 验证书籍和角色是否存在
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  // 检查是否有关联的音频文件
  const audioFiles = await prisma.audioFile.findMany({
    where: {
      scriptSentence: {
        characterId: characterId
      },
      voiceProfileId: bindingId
    }
  })

  if (audioFiles.length > 0) {
    throw new ValidationError('该声音绑定已生成音频文件，无法删除')
  }

  // 删除绑定
  const result = await prisma.characterVoiceBinding.deleteMany({
    where: {
      id: bindingId,
      characterId: characterId
    }
  })

  if (result.count === 0) {
    throw new ValidationError('声音绑定不存在')
  }

  return NextResponse.json({
    success: true,
    message: '声音绑定已删除'
  })
})
