jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { upsertCharacterCandidates } from "./character-utils";
import type { CharacterCandidate } from "../types";

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
};

const aliasCandidate: CharacterCandidate = {
  name: "宁书生",
  aliases: [],
  description: "",
  gender: "unknown",
  age: null,
  personality: [],
  importance: "minor",
  dialogueStyle: "",
};

describe("upsertCharacterCandidates task13", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates canonical mapping from database across fresh replay contexts", async () => {
    const tx = {
      characterProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "char-ning",
            canonicalName: "宁采臣",
            characteristics: {
              description: "existing",
              personality: [],
              importance: "main",
              relationships: {},
            },
            voicePreferences: {
              dialogueStyle: "文雅",
            },
            genderHint: "male",
            ageHint: null,
            aliases: [{ alias: "宁书生" }],
          },
        ]),
        create: jest.fn(),
        update: jest.fn(),
      },
      characterAlias: {
        createMany: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx)
    );

    await upsertCharacterCandidates({
      bookId: "book-1",
      candidates: [aliasCandidate],
      characterProfiles: [],
      characterMap: new Map<string, string>(),
    });

    const replayMap = new Map<string, string>();
    await upsertCharacterCandidates({
      bookId: "book-1",
      candidates: [aliasCandidate],
      characterProfiles: [],
      characterMap: replayMap,
    });

    expect(tx.characterProfile.findMany).toHaveBeenCalledTimes(2);
    expect(tx.characterProfile.create).not.toHaveBeenCalled();
    expect(tx.characterAlias.createMany).not.toHaveBeenCalled();
    expect(replayMap.get("宁书生")).toBe("宁采臣");
  });
});
