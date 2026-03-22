jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    characterProfile: {
      upsert: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  ensureNarrationCharacter,
  getNarrationSystemRoleGuardReason,
  isNarrationCharacterProfile,
  NARRATION_CHARACTER_NAME,
  NARRATION_SYSTEM_ROLE_TYPE,
} from "@/lib/narration-character";

const mockPrisma = prisma as unknown as {
  characterProfile: {
    upsert: jest.Mock;
  };
};

describe("narration-character", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should upsert narration system role for a book", async () => {
    mockPrisma.characterProfile.upsert.mockResolvedValue({
      id: "narration-1",
      canonicalName: NARRATION_CHARACTER_NAME,
      isSystemRole: true,
      systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
    });

    const result = await ensureNarrationCharacter("book-1");

    expect(mockPrisma.characterProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bookId_systemRoleType: {
            bookId: "book-1",
            systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
          },
        },
        create: expect.objectContaining({
          bookId: "book-1",
          canonicalName: NARRATION_CHARACTER_NAME,
          isSystemRole: true,
          systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
        }),
      })
    );
    expect(result.id).toBe("narration-1");
  });

  it("should guard protected narration system role mutations", () => {
    const narrationCharacter = {
      canonicalName: NARRATION_CHARACTER_NAME,
      isSystemRole: true,
      systemRoleType: NARRATION_SYSTEM_ROLE_TYPE,
    };

    expect(isNarrationCharacterProfile(narrationCharacter)).toBe(true);
    expect(
      getNarrationSystemRoleGuardReason(narrationCharacter, {
        canonicalName: "新旁白",
      })
    ).toBe("旁白系统角色不允许改名");
    expect(
      getNarrationSystemRoleGuardReason(narrationCharacter, {
        isActive: false,
      })
    ).toBe("旁白系统角色不允许禁用");
  });
});
