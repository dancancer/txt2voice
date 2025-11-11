import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { z } from 'zod'

// 角色创建/更新验证Schema
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

const characterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '角色名称不能为空'),
  description: z.string().optional(),
  age: z.number().int().min(0).max(200).optional(),
  gender: genderSchema.optional(),
  personality: z.array(z.string()).optional(),
  dialogueStyle: z.string().optional(),
  emotionalTone: z.array(z.string()).optional(),
  importance: importanceSchema.optional(),
  relationships: z.record(z.string(), z.string()).optional(),
  aliases: z.array(z.string()).optional()
})

const toJsonValue = (value?: Record<string, unknown>): Prisma.InputJsonValue =>
  (value ?? {}) as Prisma.InputJsonValue

// GET /api/books/[id]/characters - 获取角色列表
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const importance = searchParams.get('importance')

  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const where: any = { bookId: bookId }
  if (!includeInactive) {
    where.isActive = true
  }
  if (importance) {
    where.characteristics = {
      path: ['importance'],
      equals: importance
    }
  }

  const characters = await prisma.characterProfile.findMany({
    where,
    include: {
      aliases: true,
      voiceBindings: {
        include: {
          voiceProfile: true
        }
      },
      scriptSentences: true
    },
    orderBy: [
      { canonicalName: 'asc' }
    ]
  })

  return NextResponse.json({
    success: true,
    data: {
      bookId: bookId,
      characters: characters.map(character => ({
        id: character.id,
        name: character.canonicalName,
        description: (character.characteristics as any)?.description,
        age: character.ageHint,
        gender: character.genderHint,
        personality: (character.characteristics as any)?.personality || [],
        dialogueStyle: (character.voicePreferences as any)?.dialogueStyle || '自然',
        emotionalTone: (character.emotionProfile as any)?.emotionalTone || ['中性'],
        importance: (character.characteristics as any)?.importance,
        frequency: (character.characteristics as any)?.frequency,
        relationships: (character.characteristics as any)?.relationships,
        isActive: character.isActive,
        aliases: character.aliases?.map((a: any) => a.alias) || [],
        voiceBindings: character.voiceBindings?.map((binding: any) => ({
          id: binding.id,
          voiceProfile: {
            id: binding.voiceProfile.id,
            name: binding.voiceProfile.voiceName,
            provider: binding.voiceProfile.provider,
            displayName: binding.voiceProfile.displayName,
            gender: binding.voiceProfile.characteristics?.gender,
            ageRange: binding.voiceProfile.characteristics?.ageRange,
            style: binding.voiceProfile.characteristics?.style
          },
          isPreferred: binding.isDefault
        })) || [],
        dialogueCount: character.scriptSentences?.length || 0,
        createdAt: character.createdAt,
        updatedAt: character.updatedAt
      })),
      statistics: {
        total: characters.length,
        main: characters.filter(c => (c.characteristics as any)?.importance === 'main').length,
        secondary: characters.filter(c => (c.characteristics as any)?.importance === 'secondary').length,
        minor: characters.filter(c => (c.characteristics as any)?.importance === 'minor').length,
        withVoiceBindings: characters.filter(c => c.voiceBindings && c.voiceBindings.length > 0).length
      }
    }
  })
})

// POST /api/books/[id]/characters - 创建新角色
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json()
  const validatedData = characterSchema.parse(body)

  const { id: bookId } = await params
  // 验证书籍是否存在
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  // 检查角色名称是否已存在
  const existingCharacter = await prisma.characterProfile.findFirst({
    where: {
      bookId: bookId,
      canonicalName: validatedData.name,
      isActive: true
    }
  })

  if (existingCharacter) {
    throw new ValidationError('角色名称已存在', 'name')
  }

  // 创建角色
  const character = await prisma.$transaction(async (tx) => {
    const profile = await tx.characterProfile.create({
      data: {
        bookId: bookId,
        canonicalName: validatedData.name,
        characteristics: toJsonValue({
          description: validatedData.description || '',
          personality: validatedData.personality || [],
          importance: (validatedData.importance || 'minor') as ImportanceValue,
          relationships: validatedData.relationships || {}
        }),
        voicePreferences: toJsonValue({
          dialogueStyle: validatedData.dialogueStyle || '自然'
        }),
        emotionProfile: toJsonValue({
          emotionalTone: validatedData.emotionalTone || ['中性']
        }),
        ageHint: validatedData.age,
        genderHint: validatedData.gender || 'unknown',
        isActive: true
      }
    })

    // 创建别名
    if (validatedData.aliases && validatedData.aliases.length > 0) {
      await tx.characterAlias.createMany({
        data: validatedData.aliases.map(alias => ({
          characterId: profile.id,
          alias
        }))
      })
    }

    return profile
  })

  // 获取完整的角色信息
  const createdCharacter = await prisma.characterProfile.findUnique({
    where: { id: character.id },
    include: {
      aliases: true,
      scriptSentences: true
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: createdCharacter!.id,
      name: createdCharacter!.canonicalName,
      description: (createdCharacter!.characteristics as any)?.description,
      age: createdCharacter!.ageHint,
      gender: createdCharacter!.genderHint,
      personality: (createdCharacter!.characteristics as any)?.personality || [],
      dialogueStyle: (createdCharacter!.voicePreferences as any)?.dialogueStyle || '自然',
      emotionalTone: (createdCharacter!.emotionProfile as any)?.emotionalTone || ['中性'],
      importance: (createdCharacter!.characteristics as any)?.importance,
      frequency: (createdCharacter!.characteristics as any)?.frequency,
      relationships: (createdCharacter!.characteristics as any)?.relationships,
      aliases: createdCharacter!.aliases?.map((a: any) => a.alias) || [],
      dialogueCount: createdCharacter!.scriptSentences?.length || 0,
      createdAt: createdCharacter!.createdAt
    }
  }, { status: 201 })
})

// PUT /api/books/[id]/characters - 批量更新角色
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const { characters } = body

  if (!Array.isArray(characters) || characters.length === 0) {
    throw new ValidationError('角色列表不能为空')
  }

  // 验证每个角色数据
  const validatedCharacters = characters.map(char => characterSchema.parse(char))

  const results = []

  for (const charData of validatedCharacters) {
    try {
      const updatedCharacter = await prisma.$transaction(async (tx) => {
        // 更新角色基本信息
        const profile = await tx.characterProfile.update({
          where: { id: charData.id || '' },
          data: {
            canonicalName: charData.name,
            characteristics: toJsonValue({
              description: charData.description || '',
              personality: charData.personality || [],
              importance: (charData.importance || 'minor') as ImportanceValue,
              relationships: charData.relationships || {}
            }),
            voicePreferences: toJsonValue({
              dialogueStyle: charData.dialogueStyle || '自然'
            }),
            emotionProfile: toJsonValue({
              emotionalTone: charData.emotionalTone || ['中性']
            }),
            ageHint: charData.age,
            genderHint: charData.gender || 'unknown'
          }
        })

        // 更新别名
        if (charData.aliases) {
          // 删除现有别名
          await tx.characterAlias.deleteMany({
            where: { characterId: profile.id }
          })

          // 创建新别名
          if (charData.aliases.length > 0) {
            await tx.characterAlias.createMany({
              data: charData.aliases.map(alias => ({
                characterId: profile.id,
                alias
              }))
            })
          }
        }

        return profile
      })

      results.push({
        id: updatedCharacter.id,
        success: true
      })
    } catch (error) {
      results.push({
        id: charData.id,
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

// DELETE /api/books/[id]/characters - 批量删除角色
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const characterIds = searchParams.get('ids')

  if (!characterIds) {
    throw new ValidationError('请提供要删除的角色ID列表')
  }

  const ids = characterIds.split(',').filter(id => id.trim())

  if (ids.length === 0) {
    throw new ValidationError('角色ID列表不能为空')
  }

  const { id: bookId } = await params
  // 软删除角色（标记为不活跃）
  const result = await prisma.characterProfile.updateMany({
    where: {
      id: { in: ids },
      bookId: bookId
    },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      deleted: result.count,
      message: `已删除 ${result.count} 个角色`
    }
  })
})
