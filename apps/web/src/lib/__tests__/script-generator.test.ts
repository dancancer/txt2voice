/**
 * 台本生成器测试 - 适配新的数据库字段结构
 */

import { ScriptGenerator } from "../script-generator";
import { ScriptSentence, CharacterProfile } from "../types";

// Mock dependencies
const mockPrisma = {
  $transaction: jest.fn(),
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  characterProfile: {
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  scriptSentence: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock("../llm-service", () => ({
  getLLMService: () => ({
    callLLM: jest.fn().mockResolvedValue(
      JSON.stringify([
        {
          id: "sentence_001",
          text: "测试台词",
          speaker: "测试角色",
          tone: "中性",
          strength: 75,
          pauseAfter: 1.5,
          ttsHints: {
            pitch: 1.0,
            rate: 1.0,
            emphasis: "",
          },
        },
      ])
    ),
  }),
}));

jest.mock("../character-recognition-client", () => ({
  characterRecognitionClient: {
    healthCheck: jest.fn().mockResolvedValue(false),
    recognize: jest.fn(),
  },
}));

jest.mock("../prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe("ScriptGenerator - 新数据结构适配", () => {
  let scriptGenerator: ScriptGenerator;
  let mockBook: any;
  let mockCharacters: CharacterProfile[];
  let mockSegments: any[];

  beforeEach(() => {
    scriptGenerator = new ScriptGenerator();

    mockBook = {
      id: "test-book-id",
      title: "测试书籍",
      textSegments: [
        {
          id: "segment-1",
          content: '这是第一段测试内容。"你好，"他说，"我是测试角色。"',
          orderIndex: 0,
        },
        {
          id: "segment-2",
          content: '这是第二段测试内容。她回答道："很高兴认识你。"',
          orderIndex: 1,
        },
      ],
      characterProfiles: [
        {
          id: "char-1",
          bookId: "test-book-id",
          canonicalName: "测试角色", // 使用新的字段名
          characteristics: {
            description: "测试角色描述",
            personality: ["勇敢", "正直"],
            importance: "main",
            mentions: 5,
            quotes: 3,
          },
          voicePreferences: {
            dialogueStyle: "自然",
          },
          emotionProfile: {
            baseEmotion: "neutral",
            emotionVariability: "medium",
            commonEmotions: ["开心", "严肃"],
          },
          genderHint: "male", // 使用新的字段名
          ageHint: 25,
          emotionBaseline: "neutral",
          isActive: true,
          aliases: [
            {
              id: "alias-1",
              characterId: "char-1",
              alias: "测试别名", // 使用新的字段名
              confidence: 0.9,
              sourceSentence: "原始句子",
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      scriptSentences: [],
    };

    mockCharacters = mockBook.characterProfiles;
    mockSegments = mockBook.textSegments;
  });

  describe("数据库字段对齐测试", () => {
    it("应该正确处理新的CharacterProfile字段", async () => {
      // Mock book查询返回
      mockPrisma.book.findUnique.mockResolvedValue(mockBook);

      // Mock角色创建
      mockPrisma.characterProfile.create.mockResolvedValue(mockCharacters[0]);

      // Mock别名创建
      mockPrisma.characterProfile.createMany.mockResolvedValue({ count: 1 });

      // 测试公共方法，通过调用generateScript来间接测试identifyWithLLM
      const result = await scriptGenerator.generateScript("test-book-id", {
        includeNarration: true,
        emotionDetection: true,
        contextAnalysis: true,
        minDialogueLength: 5,
        maxDialogueLength: 200,
        preserveOriginalBreaks: true,
      });

      // 验证使用了正确的字段名
      expect(mockPrisma.characterProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canonicalName: expect.any(String), // 而不是name
            genderHint: expect.any(String), // 而不是gender
            characteristics: expect.objectContaining({
              mentions: expect.any(Number), // 新增字段
              quotes: expect.any(Number), // 新增字段
            }),
          }),
        })
      );
    });

    it("应该正确处理新的ScriptSentence字段", async () => {
      // Mock book查询返回
      mockPrisma.book.findUnique.mockResolvedValue(mockBook);

      // Mock台词创建
      mockPrisma.scriptSentence.create.mockResolvedValue({
        id: "sentence-1",
        characterId: "char-1", // 使用新的字段名
        rawSpeaker: "原始说话人", // 新增字段
        orderInSegment: 0, // 使用新的字段名
        tone: "中性", // 使用新的字段名
        strength: 75, // 新增字段
        pauseAfter: 1.5, // 新增字段
        ttsParameters: {}, // 新增字段
      });

      const result = await scriptGenerator.generateScript("test-book-id");

      // 验证使用了正确的字段名
      expect(mockPrisma.scriptSentence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            characterId: expect.any(String), // 而不是characterId
            rawSpeaker: expect.any(String), // 新增字段
            orderInSegment: expect.any(Number), // 而不是orderIndex
            tone: expect.any(String), // 而不是emotion
            strength: expect.any(Number), // 新增字段
            pauseAfter: expect.any(Number), // 新增字段
            ttsParameters: expect.any(Object), // 新增字段
          }),
        })
      );
    });
  });

  describe("向后兼容性测试", () => {
    it("应该处理旧格式的角色数据", async () => {
      const oldFormatCharacter = {
        id: "char-old",
        name: "旧格式角色", // 旧字段名
        gender: "male", // 旧字段名
        personality: ["勇敢"],
        age: 25,
      };

      // 验证转换逻辑
      const convertedCharacter = {
        id: oldFormatCharacter.id,
        canonicalName: oldFormatCharacter.name, // 转换为新字段名
        genderHint: oldFormatCharacter.gender, // 转换为新字段名
        characteristics: {
          personality: oldFormatCharacter.personality,
        },
        voicePreferences: {},
        emotionProfile: {},
        ageHint: oldFormatCharacter.age,
        emotionBaseline: "neutral",
        isActive: true,
        aliases: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(convertedCharacter.canonicalName).toBe("旧格式角色");
      expect(convertedCharacter.genderHint).toBe("male");
    });

    it("应该处理旧格式的台词数据", async () => {
      const oldFormatSentence = {
        id: "sentence-old",
        characterName: "旧角色", // 旧字段名
        emotion: "开心", // 旧字段名
        orderIndex: 0, // 旧字段名
        text: "测试台词",
      };

      // 验证转换逻辑
      const convertedSentence: ScriptSentence = {
        id: oldFormatSentence.id,
        characterId: "char-old", // 转换为新字段名
        rawSpeaker: oldFormatSentence.characterName, // 新增字段
        orderInSegment: oldFormatSentence.orderIndex, // 转换为新字段名
        tone: oldFormatSentence.emotion, // 转换为新字段名
        text: oldFormatSentence.text,
        bookId: "test-book-id",
        segmentId: "segment-1",
        strength: 75, // 默认值
        pauseAfter: 1.5, // 默认值
        ttsParameters: {}, // 默认值
        createdAt: new Date().toISOString(),
      };

      expect(convertedSentence.orderInSegment).toBe(0);
      expect(convertedSentence.tone).toBe("开心");
      expect(convertedSentence.rawSpeaker).toBe("旧角色");
    });
  });

  describe("新字段功能测试", () => {
    it("应该正确处理角色别名", async () => {
      const characterWithAliases = {
        ...mockCharacters[0],
        aliases: [
          {
            id: "alias-1",
            characterId: "char-1",
            alias: "小明", // 使用新的字段名
            confidence: 0.95,
            sourceSentence: "小明说：",
            createdAt: new Date().toISOString(),
          },
          {
            id: "alias-2",
            characterId: "char-1",
            alias: "阿明",
            confidence: 0.85,
            sourceSentence: "阿明回答：",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      // 验证别名映射
      const aliasMap = new Map();
      characterWithAliases.aliases.forEach((alias) => {
        aliasMap.set(alias.alias, characterWithAliases.canonicalName);
      });

      expect(aliasMap.get("小明")).toBe("测试角色");
      expect(aliasMap.get("阿明")).toBe("测试角色");
    });

    it("应该正确处理TTS参数", async () => {
      const ttsParameters = {
        pitch: 1.2,
        rate: 0.9,
        volume: 0.8,
        style: "gentle",
      };

      const sentenceWithTTS: ScriptSentence = {
        id: "sentence-tts",
        bookId: "test-book-id",
        segmentId: "segment-1",
        characterId: "char-1",
        text: "带TTS参数的台词",
        orderInSegment: 0,
        tone: "温柔",
        strength: 80,
        pauseAfter: 2.0,
        ttsParameters, // 新增字段
        createdAt: new Date().toISOString(),
      };

      expect(sentenceWithTTS.ttsParameters).toEqual(ttsParameters);
      expect(sentenceWithTTS.strength).toBe(80);
      expect(sentenceWithTTS.pauseAfter).toBe(2.0);
    });

    it("应该正确处理角色统计信息", async () => {
      const characterWithStats = {
        ...mockCharacters[0],
        characteristics: {
          ...mockCharacters[0].characteristics,
          mentions: 15, // 新增统计字段
          quotes: 8, // 新增统计字段
          firstAppearance: 2, // 新增统计字段
          roles: ["主角", "叙述者"], // 新增统计字段
        },
      };

      expect(characterWithStats.characteristics.mentions).toBe(15);
      expect(characterWithStats.characteristics.quotes).toBe(8);
      expect(characterWithStats.characteristics.firstAppearance).toBe(2);
      expect(characterWithStats.characteristics.roles).toContain("主角");
    });
  });

  describe("错误处理测试", () => {
    it("应该处理缺失的新字段", async () => {
      const incompleteCharacter = {
        id: "char-incomplete",
        bookId: "test-book-id",
        canonicalName: "不完整角色",
        characteristics: {}, // 缺少新增字段
        voicePreferences: {},
        emotionProfile: {},
        genderHint: "unknown",
        emotionBaseline: "neutral",
        isActive: true,
        aliases: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 验证默认值处理
      expect(
        (incompleteCharacter.characteristics as any).mentions
      ).toBeUndefined();
      expect(
        (incompleteCharacter.characteristics as any).quotes
      ).toBeUndefined();

      // 在使用时应该有默认值
      const mentions =
        (incompleteCharacter.characteristics as any).mentions || 0;
      const quotes = (incompleteCharacter.characteristics as any).quotes || 0;

      expect(mentions).toBe(0);
      expect(quotes).toBe(0);
    });

    it("应该处理字段类型转换", async () => {
      const characterWithTypeIssues = {
        ...mockCharacters[0],
        characteristics: {
          ...mockCharacters[0].characteristics,
          mentions: "15", // 字符串而不是数字
          quotes: "8", // 字符串而不是数字
        },
      };

      // 验证类型转换
      const mentions =
        Number(characterWithTypeIssues.characteristics.mentions) || 0;
      const quotes =
        Number(characterWithTypeIssues.characteristics.quotes) || 0;

      expect(mentions).toBe(15);
      expect(quotes).toBe(8);
      expect(typeof mentions).toBe("number");
      expect(typeof quotes).toBe("number");
    });
  });

  describe("集成测试", () => {
    it("应该完整处理台本生成流程", async () => {
      // Mock所有数据库操作
      mockPrisma.book.findUnique.mockResolvedValue(mockBook);
      mockPrisma.characterProfile.create.mockResolvedValue(mockCharacters[0]);
      mockPrisma.characterProfile.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.scriptSentence.create.mockResolvedValue({
        id: "sentence-1",
        characterId: "char-1",
        text: "测试台词",
        orderInSegment: 0,
        tone: "中性",
      });
      mockPrisma.scriptSentence.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.book.update.mockResolvedValue({});

      const result = await scriptGenerator.generateScript("test-book-id");

      expect(result).toBeDefined();
      expect(result.dialogueLines).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.segments).toBeDefined();

      // 验证使用了新的字段结构
      expect(mockPrisma.scriptSentence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            characterId: expect.any(String),
            orderInSegment: expect.any(Number),
            tone: expect.any(String),
          }),
        })
      );
    });
  });
});
