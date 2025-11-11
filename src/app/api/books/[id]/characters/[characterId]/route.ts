import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { z } from 'zod'

const genderSchema = z.union([
  z.literal('male'),
  z.literal('female'),
  z.literal('unknown')
])

const importanceSchema = z.union([
  z.literal('main'),
  z.literal('secondary'),
  z.literal('minor')
])

type ImportanceValue = z.infer<typeof importanceSchema>

const characterUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  age: z.number().int().min(0).max(200).optional(),
  gender: genderSchema.optional(),
  personality: z.array(z.string()).optional(),
  dialogueStyle: z.string().optional(),
  emotionalTone: z.array(z.string()).optional(),
  importance: importanceSchema.optional(),
  relationships: z.record(z.string(), z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
})

const toJsonValue = (value?: Record<string, unknown>): Prisma.InputJsonValue =>
  (value ?? {}) as Prisma.InputJsonValue

// GET /api/books/[id]/characters/[characterId] - 获取单个角色详情
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const { id: bookId, characterId } = await params
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    },
    include: {
      aliases: true,
      voiceBindings: {
        include: {
          voiceProfile: true
        }
      },
      scriptSentences: {
        include: {
          segment: {
            select: { id: true, content: true, orderIndex: true }
          }
        },
        orderBy: { segmentId: 'asc' }
      },
      _count: {
        select: {
          scriptSentences: true,
          voiceBindings: true
        }
      }
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  return NextResponse.json({
    success: true,
    data: {
      id: character.id,
      name: character.canonicalName,
      description: (character.characteristics as any)?.description,
      age: character.ageHint,
      gender: character.genderHint,
      personality: (character.characteristics as any)?.personality,
      dialogueStyle: (character.voicePreferences as any)?.dialogueStyle,
      emotionalTone: (character.emotionProfile as any)?.emotionalTone,
      importance: (character.characteristics as any)?.importance,
      relationships: (character.characteristics as any)?.relationships,
      isActive: character.isActive,
      aliases: character.aliases.map(a => a.alias),
      voiceBindings: character.voiceBindings.map(binding => ({
        id: binding.id,
        voiceProfile: {
          id: binding.voiceProfile.id,
          name: binding.voiceProfile.displayName,
          provider: binding.voiceProfile.provider,
          language: (binding.voiceProfile.characteristics as any)?.language,
          gender: (binding.voiceProfile.characteristics as any)?.gender,
          ageRange: (binding.voiceProfile.characteristics as any)?.ageRange,
          style: (binding.voiceProfile.characteristics as any)?.style
        },
        isPreferred: binding.isDefault
      })),
      scriptSentences: character.scriptSentences.map(sentence => ({
        id: sentence.id,
        text: sentence.text,
        emotion: sentence.tone,
        context: null,
        segment: sentence.segment
      })),
      statistics: {
        dialogueCount: character._count.scriptSentences,
        voiceBindingCount: character._count.voiceBindings,
        emotionDistribution: character.scriptSentences.reduce((acc, sentence) => {
          const emotion = sentence.tone || 'neutral'
          acc[emotion] = (acc[emotion] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      },
      createdAt: character.createdAt,
      updatedAt: character.updatedAt
    }
  })
})

// PUT /api/books/[id]/characters/[characterId] - 更新角色信息
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const body = await request.json()
  const validatedData = characterUpdateSchema.parse(body)

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

  // 如果更新名称，检查是否与其他角色重复
  if (validatedData.name && validatedData.name !== character.canonicalName) {
    const existingCharacter = await prisma.characterProfile.findFirst({
      where: {
        bookId: bookId,
        canonicalName: validatedData.name,
        isActive: true,
        id: { not: characterId }
      }
    })

    if (existingCharacter) {
      throw new ValidationError('角色名称已存在', 'name')
    }
  }

  const updateData: any = {}
  if (validatedData.name !== undefined) updateData.canonicalName = validatedData.name

  // Build updated characteristics JSON
  const currentCharacteristics = character.characteristics as any || {}
  if (validatedData.description !== undefined || validatedData.personality !== undefined ||
      validatedData.importance !== undefined || validatedData.relationships !== undefined) {
    updateData.characteristics = toJsonValue({
      ...currentCharacteristics,
      ...(validatedData.description !== undefined && { description: validatedData.description }),
      ...(validatedData.personality !== undefined && { personality: validatedData.personality }),
      ...(validatedData.importance !== undefined && { importance: validatedData.importance }),
      ...(validatedData.relationships !== undefined && { relationships: validatedData.relationships })
    })
  }

  if (validatedData.age !== undefined) updateData.ageHint = validatedData.age
  if (validatedData.gender !== undefined) updateData.genderHint = validatedData.gender

  // Build updated voicePreferences JSON
  const currentVoicePreferences = character.voicePreferences as any || {}
  if (validatedData.dialogueStyle !== undefined) {
    updateData.voicePreferences = toJsonValue({
      ...currentVoicePreferences,
      dialogueStyle: validatedData.dialogueStyle
    })
  }

  // Build updated emotionProfile JSON
  const currentEmotionProfile = character.emotionProfile as any || {}
  if (validatedData.emotionalTone !== undefined) {
    updateData.emotionProfile = toJsonValue({
      ...currentEmotionProfile,
      emotionalTone: validatedData.emotionalTone
    })
  }

  if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
  updateData.updatedAt = new Date()

  const updatedCharacter = await prisma.$transaction(async (tx) => {
    // 更新角色基本信息
    const profile = await tx.characterProfile.update({
      where: { id: characterId },
      data: updateData
    })

    // 更新别名
    if (validatedData.aliases !== undefined) {
      // 删除现有别名
      await tx.characterAlias.deleteMany({
        where: { characterId: characterId }
      })

      // 创建新别名
      if (validatedData.aliases.length > 0) {
        await tx.characterAlias.createMany({
          data: validatedData.aliases.map(alias => ({
            characterId: characterId,
            alias
          }))
        })
      }
    }

    return profile
  })

  // 获取更新后的完整信息
  const result = await prisma.characterProfile.findUnique({
    where: { id: updatedCharacter.id },
    include: {
      aliases: true,
      _count: {
        select: { scriptSentences: true }
      }
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: result!.id,
      name: result!.canonicalName,
      description: (result!.characteristics as any)?.description,
      age: result!.ageHint,
      gender: result!.genderHint,
      personality: (result!.characteristics as any)?.personality,
      dialogueStyle: (result!.voicePreferences as any)?.dialogueStyle,
      emotionalTone: (result!.emotionProfile as any)?.emotionalTone,
      importance: (result!.characteristics as any)?.importance,
      relationships: (result!.characteristics as any)?.relationships,
      isActive: result!.isActive,
      aliases: result!.aliases.map(a => a.alias),
      dialogueCount: result!._count.scriptSentences,
      updatedAt: result!.updatedAt
    }
  })
})

// DELETE /api/books/[id]/characters/[characterId] - 删除角色
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) => {
  const { id: bookId, characterId } = await params
  const character = await prisma.characterProfile.findUnique({
    where: {
      id: characterId,
      bookId: bookId
    },
    include: {
      _count: {
        select: { scriptSentences: true }
      }
    }
  })

  if (!character) {
    throw new ValidationError('角色不存在')
  }

  // 检查是否有关联的台词
  if (character._count.scriptSentences > 0) {
    throw new ValidationError('该角色有关联的台词，无法删除')
  }

  // 软删除角色
  await prisma.characterProfile.update({
    where: { id: characterId },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  })

  return NextResponse.json({
    success: true,
    message: '角色已删除'
  })
})
