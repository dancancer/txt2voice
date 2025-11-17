import prisma from './prisma'
import { logger } from './logger'

type RecognizedCharacter = {
  id?: string
  name?: string
  canonical_name?: string
  canonicalName?: string
  aliases?: string[]
  mentions?: number
  quotes?: number
  first_appearance_idx?: number
  roles?: string[]
  gender?: string
}

type RecognitionResult = {
  characters?: RecognizedCharacter[]
  alias_map?: Record<string, string>
  statistics?: Record<string, any>
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}

const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return fallback
}

const determineImportance = (quotes: number): 'main' | 'supporting' | 'minor' => {
  if (quotes >= 10) return 'main'
  if (quotes >= 5) return 'supporting'
  return 'minor'
}

const normalizeCanonName = (character: RecognizedCharacter): string | null => {
  const candidates = [
    character.canonical_name,
    character.canonicalName,
    character.name,
    character.id
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

const collectAliasCandidates = (
  character: RecognizedCharacter,
  aliasMap: Record<string, string>,
  canonicalName: string
): string[] => {
  const aliases = new Set(
    Array.isArray(character.aliases) ? character.aliases.filter(Boolean).map((alias) => alias!.trim()) : []
  )

  const possibleTargets = new Set(
    [canonicalName, character.id, character.canonical_name, character.name]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => value.toLowerCase())
  )

  for (const [alias, target] of Object.entries(aliasMap || {})) {
    if (
      typeof alias === 'string' &&
      typeof target === 'string' &&
      possibleTargets.has(target.toLowerCase())
    ) {
      aliases.add(alias.trim())
    }
  }

  return [...aliases].filter((alias) => alias.length > 0 && alias !== canonicalName)
}

const buildCharacteristics = (
  existing: Record<string, any>,
  character: RecognizedCharacter,
  mentions: number,
  quotes: number
) => {
  const rolesFromCharacter = Array.isArray(character.roles) ? character.roles : []
  const rolesFromExisting = Array.isArray(existing.roles) ? existing.roles : []

  return {
    ...existing,
    description: `提及${mentions}次，对话${quotes}次`,
    importance: determineImportance(quotes),
    firstAppearance: character.first_appearance_idx ?? existing.firstAppearance ?? null,
    roles: rolesFromCharacter.length > 0 ? rolesFromCharacter : rolesFromExisting
  }
}

export async function saveRecognitionResults(
  bookId: string,
  recognitionResult: RecognitionResult
): Promise<void> {
  const characters = recognitionResult?.characters ?? []
  const aliasMap = recognitionResult?.alias_map ?? {}

  if (characters.length === 0) {
    logger.warn('No characters returned from recognition result', { bookId })
    return
  }

  await prisma.$transaction(async (tx) => {
    const existingProfiles = await tx.characterProfile.findMany({
      where: { bookId },
      include: { aliases: true }
    })

    const existingByCanonicalName = new Map(
      existingProfiles.map((profile) => [profile.canonicalName, profile])
    )

    let createdCount = 0
    let updatedCount = 0
    let aliasCreatedCount = 0

    for (const character of characters) {
      const canonicalName = normalizeCanonName(character)
      if (!canonicalName) {
        logger.warn('Skipping character without canonical name', { bookId, character })
        continue
      }

      const existingProfile = existingByCanonicalName.get(canonicalName)
      const mentions = safeNumber(character.mentions, existingProfile?.mentions ?? 0)
      const quotes = safeNumber(character.quotes, existingProfile?.quotes ?? 0)
      const characteristics = buildCharacteristics(
        asRecord(existingProfile?.characteristics),
        character,
        mentions,
        quotes
      )

      let targetProfileId: string

      if (existingProfile) {
        await tx.characterProfile.update({
          where: { id: existingProfile.id },
          data: {
            characteristics,
            genderHint: character.gender || existingProfile.genderHint || 'unknown',
            mentions,
            quotes,
            isActive: true
          }
        })
        updatedCount += 1
        targetProfileId = existingProfile.id
      } else {
        const newProfile = await tx.characterProfile.create({
          data: {
            bookId,
            canonicalName,
            characteristics,
            voicePreferences: {},
            emotionProfile: {},
            genderHint: character.gender || 'unknown',
            ageHint: null,
            emotionBaseline: 'neutral',
            isActive: true,
            mentions,
            quotes
          }
        })
        createdCount += 1
        targetProfileId = newProfile.id
      }

      const existingAliases = new Set(
        (existingProfile?.aliases ?? []).map((alias) => alias.alias.trim()).filter(Boolean)
      )
      const aliasCandidates = collectAliasCandidates(character, aliasMap, canonicalName)
      const newAliases = aliasCandidates.filter((alias) => !existingAliases.has(alias))

      if (newAliases.length > 0) {
        await tx.characterAlias.createMany({
          data: newAliases.map((alias) => ({
            characterId: targetProfileId,
            alias
          })),
          skipDuplicates: true
        })
        aliasCreatedCount += newAliases.length
      }
    }

    logger.info('角色识别结果已保存', {
      bookId,
      charactersProcessed: characters.length,
      createdCount,
      updatedCount,
      aliasCreatedCount
    })
  })
}
