import prisma from "@/lib/prisma";

export const NARRATION_CHARACTER_NAME = "旁白";
export const NARRATION_SYSTEM_ROLE_TYPE = "narration";

type NarrationCharacterLike = {
  canonicalName?: string | null;
  isSystemRole?: boolean | null;
  systemRoleType?: string | null;
};

type CharacterProfileDelegate = {
  upsert: (...args: any[]) => any;
};

type NarrationClient = {
  characterProfile: CharacterProfileDelegate;
};

const buildNarrationCharacterCreate = (bookId: string) => ({
  bookId,
  canonicalName: NARRATION_CHARACTER_NAME,
  characteristics: {
    description: "系统角色：用于承载旁白句与全局说话人/语音配置。",
    importance: "minor",
    personality: [],
    relationships: {},
  },
  voicePreferences: {
    dialogueStyle: "自然",
  },
  emotionProfile: {},
  genderHint: "unknown",
  emotionBaseline: "neutral",
  isActive: true,
  isSystemRole: true,
  systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
});

export const isNarrationSpeaker = (value?: string | null): boolean =>
  typeof value === "string" && value.trim() === NARRATION_CHARACTER_NAME;

export const isNarrationCharacterProfile = (
  value?: NarrationCharacterLike | null
): boolean =>
  Boolean(
    value?.isSystemRole === true &&
      value?.systemRoleType === NARRATION_SYSTEM_ROLE_TYPE
  );

export const getNarrationSystemRoleGuardReason = (
  current: NarrationCharacterLike | null | undefined,
  updates: {
    canonicalName?: string;
    isActive?: boolean;
  }
): string | null => {
  if (!isNarrationCharacterProfile(current)) {
    return null;
  }

  if (
    typeof updates.canonicalName === "string" &&
    updates.canonicalName.trim() !== NARRATION_CHARACTER_NAME
  ) {
    return "旁白系统角色不允许改名";
  }

  if (updates.isActive === false) {
    return "旁白系统角色不允许禁用";
  }

  return null;
};

export async function ensureNarrationCharacter(
  bookId: string,
  db: NarrationClient = prisma as unknown as NarrationClient
) {
  return db.characterProfile.upsert({
    where: {
      bookId_systemRoleType: {
        bookId,
        systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
      },
    },
    update: {
      canonicalName: NARRATION_CHARACTER_NAME,
      isSystemRole: true,
      systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
      isActive: true,
    },
    create: buildNarrationCharacterCreate(bookId),
  });
}
