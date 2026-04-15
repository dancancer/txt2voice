// 一旦我被更新，请更新我的开头注释
// input: 台词查询/角色分配/序列化配置
// output: script sentence 服务辅助函数
// pos: 脚本句子服务层
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  ensureNarrationCharacter,
  isNarrationSpeaker,
  NARRATION_CHARACTER_NAME,
  NARRATION_SYSTEM_ROLE_TYPE,
} from "@/lib/narration-character";

export const scriptSentenceInclude = {
  character: {
    select: {
      id: true,
      canonicalName: true,
      genderHint: true,
      emotionBaseline: true,
    },
  },
  chapter: {
    select: {
      id: true,
      chapterIndex: true,
      title: true,
    },
  },
  segment: {
    select: {
      id: true,
      content: true,
      segmentIndex: true,
      orderIndex: true,
      chapterOrderIndex: true,
    },
  },
  audioFiles: {
    select: {
      id: true,
      filePath: true,
      duration: true,
      status: true,
      provider: true,
      voiceProfileId: true,
      voiceProfile: {
        select: {
          id: true,
          voiceName: true,
          displayName: true,
        },
      },
    },
  },
} as const;

export const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

export const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const isNarrationRoleType = (value: unknown): boolean =>
  typeof value === "string" && value.trim().toLowerCase() === NARRATION_SYSTEM_ROLE_TYPE;

export async function resolveSentenceAssignment(params: {
  bookId: string;
  characterId?: string | null;
  rawSpeaker?: string | null;
  roleType?: string;
}) {
  const { bookId, characterId, rawSpeaker, roleType } = params;
  const wantsNarration = isNarrationRoleType(roleType) || isNarrationSpeaker(rawSpeaker);

  if (wantsNarration) {
    const narrationCharacter = await ensureNarrationCharacter(bookId);
    return {
      characterId: narrationCharacter.id,
      rawSpeaker: NARRATION_CHARACTER_NAME,
      roleType: NARRATION_SYSTEM_ROLE_TYPE,
    };
  }

  if (!characterId) {
    return {
      characterId,
      rawSpeaker,
      roleType,
    };
  }

  const character = await prisma.characterProfile.findFirst({
    where: { id: characterId, bookId },
    select: {
      id: true,
      isSystemRole: true,
      systemRoleType: true,
    },
  });

  if (!character) {
    throw new ValidationError("角色不存在");
  }

  if (character.isSystemRole && character.systemRoleType === NARRATION_SYSTEM_ROLE_TYPE) {
    return {
      characterId: character.id,
      rawSpeaker: NARRATION_CHARACTER_NAME,
      roleType: NARRATION_SYSTEM_ROLE_TYPE,
    };
  }

  return {
    characterId: character.id,
    rawSpeaker,
    roleType,
  };
}

export async function ensureBookExists(bookId: string): Promise<void> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }
}
