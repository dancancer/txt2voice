// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { TTSError } from "./error-handler";
import { getLLMService } from "./llm-service";
import prisma from "./prisma";

export interface DialogueLine {
  id: string;
  characterId?: string | null; // 对齐数据库字段
  rawSpeaker?: string; // 对齐数据库字段
  text: string;
  orderInSegment: number; // 对齐数据库字段
  tone?: string; // 对齐数据库字段
  strength?: number; // 对齐数据库字段 (0-100)
  pauseAfter?: number; // 对齐数据库字段 (秒)
  ttsParameters?: Record<string, any>; // 对齐数据库字段
  segmentId: string;
  chapterId?: string | null;
  isNarration?: boolean; // 内部使用，不存数据库

  // 兼容性字段
  characterName?: string; // 向后兼容
  emotion?: string; // 向后兼容
  context?: string; // 向后兼容
  metadata?: Record<string, any>; // 向后兼容
}

export interface CharacterCandidate {
  name: string;
  aliases: string[];
  description?: string;
  gender?: "male" | "female" | "unknown";
  age?: string | number | null;
  personality: string[];
  importance?: "main" | "secondary" | "minor";
  dialogueStyle?: string;
}

export interface ScriptGenerationOptions {
  includeNarration: boolean;
  emotionDetection: boolean;
  contextAnalysis: boolean;
  minDialogueLength: number;
  maxDialogueLength: number;
  preserveOriginalBreaks: boolean;
}

export interface GeneratedScript {
  dialogueLines: DialogueLine[];
  summary: {
    totalLines: number;
    dialogueCount: number;
    narrationCount: number;
    characterDistribution: Record<string, number>;
    emotionDistribution: Record<string, number>;
  };
  segments: {
    segmentId: string;
    lineCount: number;
    characters: string[];
  }[];
}

/**
 * 台本生成器类
 */
export class ScriptGenerator {
  private llmService = getLLMService();

  /**
   * 生成完整台本
   */
  async generateScript(
    bookId: string,
    options: Partial<ScriptGenerationOptions> = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const defaultOptions: ScriptGenerationOptions = {
      includeNarration: true,
      emotionDetection: true,
      contextAnalysis: true,
      minDialogueLength: 5,
      maxDialogueLength: 200,
      preserveOriginalBreaks: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    // 获取书籍和文本段落信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          orderBy: { orderIndex: "asc" },
        },
        characterProfiles: {
          where: { isActive: true },
          include: {
            aliases: true,
          },
        },
      },
    });

    if (!book) {
      throw new TTSError("书籍不存在", "TTS_SERVICE_DOWN", "script-generator");
    }

    if (book.textSegments.length === 0) {
      throw new TTSError(
        "没有可处理的文本段落",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 构建角色名称映射（包含别名）
    const characterMap = this.buildCharacterMap(book.characterProfiles);

    const allDialogueLines: DialogueLine[] = [];
    const segmentSummaries: any[] = [];

    // 逐段处理文本并实时写入数据库
    for (let i = 0; i < book.textSegments.length; i++) {
      const segment = book.textSegments[i];

      try {
        const segmentResult = await this.processSegmentAndSave(
          segment,
          characterMap,
          book.characterProfiles,
          finalOptions,
          bookId
        );

        allDialogueLines.push(...segmentResult.dialogueLines);
        segmentSummaries.push({
          segmentId: segment.id,
          lineCount: segmentResult.dialogueLines.length,
          characters: [
            ...new Set(
              segmentResult.dialogueLines.map((line) => line.characterName)
            ),
          ],
        });
        if (onProgress) {
          await onProgress(i + 1, book.textSegments.length);
        }
      } catch (error) {
        console.error(`处理段落 ${segment.id} 失败:`, error);
        // 继续处理下一段，不中断整个流程
      }
    }

    if (allDialogueLines.length === 0) {
      throw new TTSError(
        "台本生成失败，没有生成任何台词",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 计算统计信息
    const summary = this.calculateScriptSummary(allDialogueLines);

    return {
      dialogueLines: allDialogueLines,
      summary,
      segments: segmentSummaries,
    };
  }

  /**
   * 处理单个文本段落
   */
  private async processSegment(
    segment: any,
    characterMap: Map<string, string>,
    characterProfiles: any[],
    options: ScriptGenerationOptions
  ): Promise<{
    dialogueLines: DialogueLine[];
    characterCandidates: CharacterCandidate[];
  }> {
    // 构建详细的角色信息
    const characterInfo = characterProfiles
      .map((char) => {
        const aliases = char.aliases.map((a: any) => a.alias).join(", ");
        const characteristics = (char.characteristics as any) || {};
        const voicePreferences = (char.voicePreferences as any) || {};
        return {
          name: char.canonicalName,
          aliases: aliases,
          gender: char.genderHint || "unknown",
          age: char.ageHint?.toString() || "未知",
          personality: Array.isArray(characteristics.personality)
            ? characteristics.personality.join(", ")
            : characteristics.personality,
          dialogueStyle: voicePreferences.dialogueStyle || "自然",
          importance: characteristics.importance || "secondary",
        };
      })
      .filter((char) => char.name !== "旁白"); // 排除旁白角色

    const characterInfoText =
      characterInfo.length > 0
        ? characterInfo
            .map(
              (char, index) =>
                `${index + 1}. ${char.name}\n` +
                `   别名: ${char.aliases || "无"}\n` +
                `   性别: ${char.gender}, 年龄: ${char.age}\n` +
                `   性格特征: ${char.personality}\n` +
                `   对话风格: ${char.dialogueStyle}\n` +
                `   重要程度: ${char.importance}\n`
            )
            .join("\n")
        : "无";

    const systemPrompt = `你是一个专业的台本编剧，专门将小说文本转换为适合有声读物朗读的台本。

你的任务是：
1. 识别文本中的对话和旁白
2. 将对话分配给正确的角色
3. 分析每段台词的情感色彩
4. 提供适当的朗读指导
5. 同步补充本段出现的新角色或新别名

已知角色信息：
${characterInfoText}

识别规则：
1. 优先使用提供的角色名称
2. 注意角色的别名变化，别名应归一为角色名称
3. 如果出现未收录角色，先在角色列表补充，再在台词中使用该名称
4. 旁白内容标记为 "旁白"，旁白不要出现在角色列表中

请返回严格JSON对象，包含以下字段：
{
  "dialogues": [
    {
      "id": "sentence_001",
      "text": "具体语句内容",
      "speaker": "说话人角色名",
      "tone": "情绪/语气",
      "strength": 75,
      "pauseAfter": 1.5,
      "ttsHints": {
        "pitch": 1.0,
        "rate": 1.0,
        "emphasis": "需要强调的词"
      }
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名1", "别名2"],
      "description": "角色描述",
      "gender": "male/female/unknown",
      "age": "大致年龄",
      "personality": ["性格1", "性格2"],
      "importance": "main/secondary/minor",
      "dialogueStyle": "对话风格"
    }
  ]
}

字段说明：
- dialogues: 台词数组
  - id: 台词唯一标识符（自动生成）
  - text: 台词内容
  - speaker: 说话人角色名称（必须是已知角色、新增角色，或"旁白"）
  - tone: 情感/语气（如：平静、激动、悲伤、愤怒、温柔、严肃等）
  - strength: 音量强度（0-100，默认75）
  - pauseAfter: 后停顿时间（秒，默认1.5）
  - ttsHints: TTS提示对象
    - pitch: 音调（默认1.0）
    - rate: 语速（默认1.0）
    - emphasis: 需要强调的词
- characters: 新增角色或新增别名的角色，没有则返回空数组

注意事项：
- 严格按照提供的角色列表分配对话
- 情感描述要简洁明确，符合角色性格
- 保持原文的语调和风格
- 只返回JSON，不要添加其他文字，不要使用Markdown或代码块（例如\`\`\`json）`;

    const prompt = `请分析以下文本段落，生成朗读台本并补充角色信息：

${segment.content}

请只输出一个完整JSON对象，必须以 { 开始、以 } 结束，不要包含任何额外文字或Markdown代码块。`;

    const response = await this.llmService.callLLM(prompt, systemPrompt);

    console.log("=============", response);
    try {
      const jsonString = this.extractJsonCandidate(response);
      if (!jsonString) {
        throw new Error("无法从LLM响应中提取JSON");
      }

      let result: any;

      try {
        // 第一次尝试：直接解析
        result = JSON.parse(jsonString);
      } catch (firstError) {
        const errorMessage =
          firstError instanceof Error ? firstError.message : String(firstError);
        console.log("JSON解析失败，尝试本地修复...");

        // 第二次尝试：本地修复
        const fixedJson = this.fixJsonSyntax(jsonString);
        try {
          result = JSON.parse(fixedJson);
          console.log("本地修复成功");
        } catch (secondError) {
          console.log("本地修复失败，尝试LLM修复...");

          // 第三次尝试：使用LLM修复
          const llmFixedJson = await this.fixJsonWithLLM(
            jsonString,
            errorMessage
          );
          result = JSON.parse(llmFixedJson);
          console.log("LLM修复成功");
        }
      }

      // 处理新格式：直接是数组，或者是包含dialogues字段的对象
      let scriptSentences = [];
      let rawCharacters = [];
      if (Array.isArray(result)) {
        scriptSentences = result;
      } else if (result.dialogues && Array.isArray(result.dialogues)) {
        scriptSentences = result.dialogues;
      } else if (result.dialogueLines && Array.isArray(result.dialogueLines)) {
        scriptSentences = result.dialogueLines;
      } else {
        console.warn("未找到有效的台词数据，使用空数组");
        scriptSentences = [];
      }

      if (result.characters && Array.isArray(result.characters)) {
        rawCharacters = result.characters;
      } else if (result.newCharacters && Array.isArray(result.newCharacters)) {
        rawCharacters = result.newCharacters;
      }

      const characterCandidates = this.normalizeCharacterCandidates(rawCharacters);
      for (const candidate of characterCandidates) {
        const canonicalName = this.resolveCandidateCanonicalName(
          candidate,
          characterMap
        );
        const aliasSet = new Set(candidate.aliases);
        if (candidate.name !== canonicalName) {
          aliasSet.add(candidate.name);
        }

        this.addCharacterToMap(characterMap, {
          canonicalName,
          aliases: [...aliasSet].map((alias) => ({ alias })),
        });
      }

      // 转换为标准格式
      const dialogueLines: DialogueLine[] = scriptSentences.map(
        (sentence: any, index: number) => {
          let characterName = sentence.speaker || "未知";

          // 规范化角色名称（使用别名映射）
          if (characterName !== "旁白") {
            const normalizedCharacter =
              characterMap.get(characterName) || characterName;
            characterName = normalizedCharacter;
          }

          // 映射新格式字段到数据库字段
          return {
            id: sentence.id || `${segment.id}_${index}`,
            characterName,
            text: sentence.text || "",
            emotion: sentence.tone || "中性",
            context: "", // 新格式中没有context字段
            segmentId: segment.id,
            chapterId: segment.chapterId,
            orderInSegment: index,
            isNarration: characterName === "旁白",
            metadata: {
              strength: sentence.strength || 75,
              pauseAfter: sentence.pauseAfter || 1.5,
              ttsHints: sentence.ttsHints || {
                pitch: 1.0,
                rate: 1.0,
                emphasis: "",
              },
              originalSpeaker: sentence.speaker,
              confidence: 0.8,
            },
          };
        }
      );

      // 过滤和验证台词
      const filteredLines = dialogueLines.filter((line) => {
        return (
          line.text.trim().length >= options.minDialogueLength &&
          line.text.trim().length <= options.maxDialogueLength
        );
      });

      return { dialogueLines: filteredLines, characterCandidates };
    } catch (error) {
      console.error("台本解析失败:", error);
      throw new TTSError(
        "台本生成失败，LLM返回格式错误",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }
  }

  /**
   * 处理单个文本段落并实时写入数据库
   */
  private async processSegmentAndSave(
    segment: any,
    characterMap: Map<string, string>,
    characterProfiles: any[],
    options: ScriptGenerationOptions,
    bookId: string
  ): Promise<{
    dialogueLines: DialogueLine[];
    characterCandidates: CharacterCandidate[];
  }> {
    // 处理段落获取台词
    const result = await this.processSegment(
      segment,
      characterMap,
      characterProfiles,
      options
    );

    if (result.characterCandidates.length > 0) {
      await this.upsertCharacterCandidates(
        bookId,
        result.characterCandidates,
        characterProfiles,
        characterMap
      );
    }

    // 立即将该段落的台词写入数据库
    if (result.dialogueLines.length > 0) {
      await this.saveSegmentScriptToDatabase(
        bookId,
        segment.id,
        result.dialogueLines,
        characterProfiles,
        characterMap
      );
    }

    return result;
  }

  /**
   * 保存单个段落的台词到数据库
   */
  private async saveSegmentScriptToDatabase(
    bookId: string,
    segmentId: string,
    dialogueLines: DialogueLine[],
    characterProfiles: any[],
    characterMap: Map<string, string>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 删除该段落的现有台词记录
      await tx.scriptSentence.deleteMany({
        where: {
          bookId,
          segmentId,
        },
      });

      // 保存新的台词记录
      for (const line of dialogueLines) {
        // 查找角色ID
        let character = characterProfiles.find(
          (char) => char.canonicalName === line.characterName
        );

        if (
          !character &&
          line.characterName &&
          line.characterName !== "旁白"
        ) {
          const newCharacter = await tx.characterProfile.create({
            data: {
              bookId,
              canonicalName: line.characterName,
              characteristics: {
                description: `台本生成自动创建的角色：${line.characterName}`,
                personality: [],
                importance: "minor",
                relationships: {},
              },
              voicePreferences: {
                dialogueStyle: "自然",
              },
              genderHint: "unknown",
              ageHint: null,
              emotionBaseline: "neutral",
              isActive: true,
            },
          });

          character = {
            ...newCharacter,
            aliases: [],
          };

          characterProfiles.push(character);
          this.addCharacterToMap(characterMap, character);
          console.log(`自动创建新角色: ${line.characterName}`);
        }

        let characterId: string | null = null;
        if (character) {
          characterId = character.id;
        } else if (line.characterName === "旁白") {
          // 旁白不关联具体角色
          characterId = null;
        } else {
          console.warn(`未找到角色: ${line.characterName}`);
        }

        await tx.scriptSentence.create({
          data: {
            bookId,
            segmentId,
            chapterId: line.chapterId ?? null,
            characterId,
            text: line.text,
            tone: line.emotion,
            orderInSegment: line.orderInSegment,
            ttsParameters: line.metadata || {},
          },
        });
      }

      // 更新书籍状态为脚本生成中（如果还不是最终状态）
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: "script_generated",
          metadata: {
            scriptGeneratedAt: new Date().toISOString(),
            lastSegmentGenerationAt: new Date().toISOString(),
            lastGeneratedSegmentId: segmentId,
          },
        },
      });
    });
  }

  /**
   * 构建角色名称映射表
   */
  private buildCharacterMap(characterProfiles: any[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const profile of characterProfiles) {
      this.addCharacterToMap(map, profile);
    }

    return map;
  }

  private addCharacterToMap(
    map: Map<string, string>,
    profile: { canonicalName?: string; aliases?: Array<{ alias: string }> }
  ): void {
    if (!profile?.canonicalName) {
      return;
    }

    map.set(profile.canonicalName, profile.canonicalName);

    if (profile.aliases) {
      for (const alias of profile.aliases) {
        if (alias?.alias) {
          map.set(alias.alias, profile.canonicalName);
        }
      }
    }

    const commonVariations = this.generateCommonVariations(
      profile.canonicalName
    );
    for (const variation of commonVariations) {
      map.set(variation, profile.canonicalName);
    }
  }

  /**
   * 生成角色名称的常见变体
   */
  private generateCommonVariations(name: string): string[] {
    const variations: string[] = [];

    // 简单的变体规则
    if (name.length > 2) {
      variations.push(name.slice(0, -1)); // 去掉最后一个字
      variations.push(name.slice(1)); // 去掉第一个字
    }

    if (
      name.includes("先生") ||
      name.includes("小姐") ||
      name.includes("女士")
    ) {
      variations.push(name.replace(/先生|小姐|女士/g, ""));
    }

    return variations;
  }

  private normalizeCharacterCandidates(
    rawCandidates: any[]
  ): CharacterCandidate[] {
    if (!Array.isArray(rawCandidates)) {
      return [];
    }

    return rawCandidates
      .map((candidate): CharacterCandidate | null => {
        const name =
          typeof candidate?.name === "string" ? candidate.name.trim() : "";
        if (!name || name === "旁白") {
          return null;
        }

        const aliases = Array.isArray(candidate?.aliases)
          ? candidate.aliases
              .filter((alias: any) => typeof alias === "string" && alias.trim())
              .map((alias: string) => alias.trim())
          : [];

        const personality = Array.isArray(candidate?.personality)
          ? candidate.personality
              .filter((trait: any) => typeof trait === "string" && trait.trim())
              .map((trait: string) => trait.trim())
          : typeof candidate?.personality === "string" &&
              candidate.personality.trim()
            ? [candidate.personality.trim()]
            : [];

        const gender =
          candidate?.gender === "male" ||
          candidate?.gender === "female" ||
          candidate?.gender === "unknown"
            ? candidate.gender
            : "unknown";

        const importance =
          candidate?.importance === "main" ||
          candidate?.importance === "secondary" ||
          candidate?.importance === "minor"
            ? candidate.importance
            : "minor";

        return {
          name,
          aliases,
          description:
            typeof candidate?.description === "string"
              ? candidate.description.trim()
              : "",
          gender,
          age: candidate?.age ?? null,
          personality,
          importance,
          dialogueStyle:
            typeof candidate?.dialogueStyle === "string"
              ? candidate.dialogueStyle.trim()
              : "",
        };
      })
      .filter(
        (candidate): candidate is CharacterCandidate => candidate !== null
      );
  }

  private resolveCandidateCanonicalName(
    candidate: CharacterCandidate,
    characterMap: Map<string, string>
  ): string {
    const mapped = characterMap.get(candidate.name);
    if (mapped) {
      return mapped;
    }

    for (const alias of candidate.aliases) {
      const aliasMapped = characterMap.get(alias);
      if (aliasMapped) {
        return aliasMapped;
      }
    }

    return candidate.name;
  }

  private async upsertCharacterCandidates(
    bookId: string,
    candidates: CharacterCandidate[],
    characterProfiles: any[],
    characterMap: Map<string, string>
  ): Promise<void> {
    if (candidates.length === 0) {
      return;
    }

    const importanceWeight: Record<"main" | "secondary" | "minor", number> = {
      main: 3,
      secondary: 2,
      minor: 1,
    };

    await prisma.$transaction(async (tx) => {
      for (const candidate of candidates) {
        const canonicalName = this.resolveCandidateCanonicalName(
          candidate,
          characterMap
        ).trim();

        if (!canonicalName || canonicalName === "旁白") {
          continue;
        }

        let profile = characterProfiles.find(
          (item) => item.canonicalName === canonicalName
        );

        const aliasSet = new Set(candidate.aliases);
        if (candidate.name && candidate.name !== canonicalName) {
          aliasSet.add(candidate.name);
        }

        if (!profile) {
          const created = await tx.characterProfile.create({
            data: {
              bookId,
              canonicalName,
              characteristics: {
                description:
                  candidate.description ||
                  `台本生成识别的角色：${canonicalName}`,
                personality: candidate.personality,
                importance: candidate.importance || "minor",
                relationships: {},
              },
              voicePreferences: {
                dialogueStyle: candidate.dialogueStyle || "自然",
              },
              genderHint:
                candidate.gender === "male" || candidate.gender === "female"
                  ? candidate.gender
                  : "unknown",
              ageHint: this.parseAgeHint(candidate.age),
              emotionBaseline: "neutral",
              isActive: true,
            },
          });

          profile = { ...created, aliases: [] };
          characterProfiles.push(profile);
        } else {
          const updateData: any = {};
          const characteristics = (profile.characteristics as any) || {};
          const voicePreferences = (profile.voicePreferences as any) || {};
          const nextCharacteristics = { ...characteristics };
          let shouldUpdateCharacteristics = false;

          if (candidate.description && !characteristics.description) {
            nextCharacteristics.description = candidate.description;
            shouldUpdateCharacteristics = true;
          }

          if (
            candidate.personality.length > 0 &&
            (!Array.isArray(characteristics.personality) ||
              characteristics.personality.length === 0)
          ) {
            nextCharacteristics.personality = candidate.personality;
            shouldUpdateCharacteristics = true;
          }

          const currentImportance: "main" | "secondary" | "minor" =
            characteristics.importance === "main" ||
            characteristics.importance === "secondary" ||
            characteristics.importance === "minor"
              ? characteristics.importance
              : "minor";
          const candidateImportance: "main" | "secondary" | "minor" =
            candidate.importance === "main" ||
            candidate.importance === "secondary" ||
            candidate.importance === "minor"
              ? candidate.importance
              : "minor";
          if (
            importanceWeight[candidateImportance] >
            importanceWeight[currentImportance]
          ) {
            nextCharacteristics.importance = candidateImportance;
            shouldUpdateCharacteristics = true;
          }

          if (shouldUpdateCharacteristics) {
            updateData.characteristics = nextCharacteristics;
          }

          if (candidate.dialogueStyle && !voicePreferences.dialogueStyle) {
            updateData.voicePreferences = {
              ...voicePreferences,
              dialogueStyle: candidate.dialogueStyle,
            };
          }

          if (
            profile.genderHint === "unknown" &&
            candidate.gender &&
            candidate.gender !== "unknown"
          ) {
            updateData.genderHint = candidate.gender;
          }

          if (profile.ageHint === null || profile.ageHint === undefined) {
            const ageHint = this.parseAgeHint(candidate.age);
            if (ageHint !== null) {
              updateData.ageHint = ageHint;
            }
          }

          if (Object.keys(updateData).length > 0) {
            const updatedProfile = await tx.characterProfile.update({
              where: { id: profile.id },
              data: updateData,
            });
            profile = {
              ...profile,
              ...updatedProfile,
              aliases: profile.aliases,
            };
            const profileIndex = characterProfiles.findIndex(
              (item) => item.id === profile.id
            );
            if (profileIndex >= 0) {
              characterProfiles[profileIndex] = profile;
            }
          }
        }

        if (aliasSet.size > 0) {
          const existingAliases = new Set(
            (profile.aliases || []).map((alias: any) => alias.alias)
          );
          const aliasesToCreate = [...aliasSet].filter(
            (alias) =>
              alias &&
              alias !== canonicalName &&
              !existingAliases.has(alias)
          );

          if (aliasesToCreate.length > 0) {
            await tx.characterAlias.createMany({
              data: aliasesToCreate.map((alias) => ({
                characterId: profile!.id,
                alias,
              })),
              skipDuplicates: true,
            });

            profile.aliases = [
              ...(profile.aliases || []),
              ...aliasesToCreate.map((alias) => ({ alias })),
            ];
          }
        }

        this.addCharacterToMap(characterMap, {
          canonicalName: profile.canonicalName,
          aliases: profile.aliases || [],
        });
      }
    });
  }

  /**
   * 解析年龄提示
   */
  private parseAgeHint(age: any): number | null {
    if (age === null || age === undefined) {
      return null;
    }

    if (typeof age === "number") {
      return age;
    }

    if (typeof age === "string") {
      // 处理各种年龄格式的字符串
      const ageStr = age.trim();

      // 提取数字
      const numberMatch = ageStr.match(/\d+/);
      if (numberMatch) {
        const num = parseInt(numberMatch[0], 10);
        return isNaN(num) ? null : num;
      }

      // 处理年龄范围，取中间值
      const rangeMatch = ageStr.match(/(\d+)-?(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start;
        if (!isNaN(start) && !isNaN(end)) {
          return Math.round((start + end) / 2);
        }
      }

      // 处理描述性年龄
      const ageMap: Record<string, number> = {
        儿童: 8,
        少年: 15,
        青年: 25,
        中年: 40,
        老年: 65,
        幼年: 5,
        成年: 30,
        青年人: 25,
        中年人: 40,
        老年人: 65,
      };

      for (const [key, value] of Object.entries(ageMap)) {
        if (ageStr.includes(key)) {
          return value;
        }
      }
    }

    return null;
  }

  private extractJsonCandidate(raw: string): string | null {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const text = (fencedMatch ? fencedMatch[1] : raw).trim();
    if (!text) {
      return null;
    }

    const start = text.search(/[\[{]/);
    if (start < 0) {
      return null;
    }

    let inString = false;
    let escape = false;
    const stack: string[] = [];

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (ch === "{" || ch === "[") {
        stack.push(ch);
        continue;
      }

      if (ch === "}" || ch === "]") {
        if (stack.length > 0) {
          stack.pop();
          if (stack.length === 0) {
            return text.slice(start, i + 1);
          }
        }
      }
    }

    return text.slice(start);
  }

  /**
   * 修复JSON语法错误（本地修复）
   */
  private fixJsonSyntax(jsonString: string): string {
    let fixed = jsonString.trim();

    const fencedMatch = fixed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      fixed = fencedMatch[1].trim();
    }

    fixed = fixed.replace(/^\uFEFF/, "");

    // 1. 修复常见的JSON语法错误
    // 修复数组末尾多余的逗号
    fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

    // 修复对象末尾多余的逗号
    fixed = fixed.replace(/,(\s*})/g, "$1");

    // 修复缺少逗号的问题 - 在数组元素之间
    fixed = fixed.replace(/}\s*{/g, "},{");
    fixed = fixed.replace(/]\s*{/g, "],{");

    // 修复缺少逗号的问题 - 在对象属性之间（简单情况）
    fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');

    // 修复换行符问题 - 正确处理字符串中的换行
    fixed = fixed.replace(/"([^"]*)"/g, (match, content) => {
      // 转义字符串内容中的特殊字符
      let escapedContent = content
        .replace(/\\/g, "\\\\") // 先转义反斜杠
        .replace(/"/g, '\\"') // 转义引号
        .replace(/\n/g, "\\n") // 转义换行
        .replace(/\r/g, "\\r") // 转义回车
        .replace(/\t/g, "\\t"); // 转义制表符

      return `"${escapedContent}"`;
    });

    // 修复尾随逗号
    fixed = fixed.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    return this.balanceJsonBrackets(fixed);
  }

  private balanceJsonBrackets(input: string): string {
    let inString = false;
    let escape = false;
    const stack: string[] = [];

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (ch === "{" || ch === "[") {
        stack.push(ch);
        continue;
      }

      if (ch === "}" || ch === "]") {
        if (stack.length > 0) {
          stack.pop();
        }
      }
    }

    if (stack.length === 0) {
      return input;
    }

    const tail = stack
      .reverse()
      .map((ch) => (ch === "{" ? "}" : "]"))
      .join("");

    return `${input}${tail}`;
  }

  /**
   * 使用LLM修复JSON格式
   */
  private async fixJsonWithLLM(
    brokenJson: string,
    errorMessage: string
  ): Promise<string> {
    const prompt = `以下是一个格式错误的JSON，请修复它：

错误信息：${errorMessage}

有问题的JSON：
\`\`\`json
${brokenJson.substring(0, 3000)}
\`\`\`

请返回修复后的完整JSON，确保：
1. 语法完全正确
2. 保持原始数据结构
3. 修复所有语法错误
4. 只返回JSON，不要添加其他文字，不要使用Markdown或代码块

修复后的JSON：`;

    const response = await this.llmService.callLLM(
      prompt,
      "你是一个JSON修复专家，专门修复格式错误的JSON。请确保返回的JSON语法完全正确。"
    );

    try {
      const jsonCandidate = this.extractJsonCandidate(response);
      if (jsonCandidate) {
        return jsonCandidate;
      }
    } catch (error) {
      console.error("LLM修复失败，返回默认格式:", error);
    }

    // 如果所有修复都失败，返回基本的默认结构
    return '{"dialogues": [], "characters": []}';
  }

  /**
   * 计算台本统计信息
   */
  private calculateScriptSummary(dialogueLines: DialogueLine[]) {
    const summary = {
      totalLines: dialogueLines.length,
      dialogueCount: dialogueLines.filter((line) => !line.isNarration).length,
      narrationCount: dialogueLines.filter((line) => line.isNarration).length,
      characterDistribution: {} as Record<string, number>,
      emotionDistribution: {} as Record<string, number>,
    };

    // 角色分布统计
    for (const line of dialogueLines) {
      if (!line.isNarration && line.characterName) {
        summary.characterDistribution[line.characterName] =
          (summary.characterDistribution[line.characterName] || 0) + 1;
      }
    }

    // 情感分布统计
    for (const line of dialogueLines) {
      if (line.emotion) {
        summary.emotionDistribution[line.emotion] =
          (summary.emotionDistribution[line.emotion] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * 增量生成台本
   */
  async generatePartialScript(
    bookId: string,
    options: Partial<ScriptGenerationOptions> = {},
    params: {
      startFromSegmentId?: string | null;
      startFromOrderIndex?: number | null;
      limitToSegments?: number;
    } = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const defaultOptions: ScriptGenerationOptions = {
      includeNarration: true,
      emotionDetection: true,
      contextAnalysis: true,
      minDialogueLength: 5,
      maxDialogueLength: 200,
      preserveOriginalBreaks: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    // 获取书籍和文本段落信息
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          orderBy: { orderIndex: "asc" },
        },
        characterProfiles: {
          where: { isActive: true },
          include: {
            aliases: true,
          },
        },
      },
    });

    if (!book) {
      throw new TTSError("书籍不存在", "TTS_SERVICE_DOWN", "script-generator");
    }

    if (book.textSegments.length === 0) {
      throw new TTSError(
        "没有可处理的文本段落",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 构建角色名称映射（包含别名）
    const characterMap = this.buildCharacterMap(book.characterProfiles);

    const allDialogueLines: DialogueLine[] = [];
    const segmentSummaries: any[] = [];

    // 确定起始段落
    let startIndex = 0;
    let hasExplicitStart = false;

    if (typeof params.startFromOrderIndex === "number") {
      hasExplicitStart = true;
      startIndex = book.textSegments.findIndex(
        (seg) => seg.orderIndex === params.startFromOrderIndex
      );
    }

    if (
      (startIndex === -1 || !hasExplicitStart) &&
      params.startFromSegmentId
    ) {
      hasExplicitStart = true;
      startIndex = book.textSegments.findIndex(
        (seg) => seg.id === params.startFromSegmentId
      );
    }

    if (hasExplicitStart && startIndex === -1) {
      throw new TTSError(
        "未找到指定的起始段落",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 计算实际要处理的段落数量
    const hasLimit =
      typeof params.limitToSegments === "number" && params.limitToSegments > 0;
    const endIndex = hasLimit
      ? Math.min(startIndex + params.limitToSegments!, book.textSegments.length)
      : book.textSegments.length;
    if (startIndex >= endIndex) {
      throw new TTSError(
        "没有可处理的文本段落",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }
    const totalSegments = endIndex - startIndex;

    console.log(
      `开始处理段落数量: ${totalSegments} (从 ${startIndex + 1} 到 ${endIndex})`
    );

    // 从指定段落开始处理并实时写入数据库
    for (let i = startIndex; i < endIndex; i++) {
      const segment = book.textSegments[i];

      try {
        const segmentResult = await this.processSegmentAndSave(
          segment,
          characterMap,
          book.characterProfiles,
          finalOptions,
          bookId
        );

        allDialogueLines.push(...segmentResult.dialogueLines);
        segmentSummaries.push({
          segmentId: segment.id,
          lineCount: segmentResult.dialogueLines.length,
          characters: [
            ...new Set(
              segmentResult.dialogueLines.map((line) => line.characterName)
            ),
          ],
        });
        if (onProgress) {
          await onProgress(i - startIndex + 1, totalSegments);
        }
      } catch (error) {
        console.error(`处理段落 ${segment.id} 失败:`, error);
        // 继续处理下一段，不中断整个流程
      }
    }

    if (allDialogueLines.length === 0) {
      throw new TTSError(
        "台本生成失败，没有生成任何台词",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 计算统计信息
    const summary = this.calculateScriptSummary(allDialogueLines);

    return {
      dialogueLines: allDialogueLines,
      summary,
      segments: segmentSummaries,
    };
  }

  /**
   * 重新生成指定段落的台本
   */
  async regenerateSegmentScript(
    bookId: string,
    segmentIds: string[],
    options: Partial<ScriptGenerationOptions> = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const defaultOptions: ScriptGenerationOptions = {
      includeNarration: true,
      emotionDetection: true,
      contextAnalysis: true,
      minDialogueLength: 5,
      maxDialogueLength: 200,
      preserveOriginalBreaks: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    // 获取书籍和指定的文本段落
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          where: { id: { in: segmentIds } },
          orderBy: { orderIndex: "asc" },
        },
        characterProfiles: {
          where: { isActive: true },
          include: {
            aliases: true,
          },
        },
      },
    });

    if (!book) {
      throw new TTSError("书籍不存在", "TTS_SERVICE_DOWN", "script-generator");
    }

    if (book.textSegments.length === 0) {
      throw new TTSError(
        "没有找到指定的段落",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 构建角色名称映射（包含别名）
    const characterMap = this.buildCharacterMap(book.characterProfiles);

    const allDialogueLines: DialogueLine[] = [];
    const segmentSummaries: any[] = [];

    // 处理指定的段落并实时写入数据库
    for (let idx = 0; idx < book.textSegments.length; idx++) {
      const segment = book.textSegments[idx];
      try {
        const segmentResult = await this.processSegmentAndSave(
          segment,
          characterMap,
          book.characterProfiles,
          finalOptions,
          bookId
        );

        allDialogueLines.push(...segmentResult.dialogueLines);
        segmentSummaries.push({
          segmentId: segment.id,
          lineCount: segmentResult.dialogueLines.length,
          characters: [
            ...new Set(
              segmentResult.dialogueLines.map((line) => line.characterName)
            ),
          ],
        });
        if (onProgress) {
          await onProgress(idx + 1, book.textSegments.length);
        }
      } catch (error) {
        console.error(`重新处理段落 ${segment.id} 失败:`, error);
      }
    }

    if (allDialogueLines.length === 0) {
      throw new TTSError(
        "段落重新生成失败，没有生成任何台词",
        "TTS_SERVICE_DOWN",
        "script-generator"
      );
    }

    // 计算统计信息
    const summary = this.calculateScriptSummary(allDialogueLines);

    return {
      dialogueLines: allDialogueLines,
      summary,
      segments: segmentSummaries,
    };
  }

  /**
   * 保存生成的台本到数据库（增量）
   */
  async savePartialScriptToDatabase(
    bookId: string,
    script: GeneratedScript
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 只删除要重新生成的段落的台词记录
      const segmentIds = script.segments.map((seg) => seg.segmentId);

      await tx.scriptSentence.deleteMany({
        where: {
          bookId,
          segmentId: { in: segmentIds },
        },
      });

      // 保存新的台词记录
      for (const line of script.dialogueLines) {
        // 查找角色ID
        const character = await tx.characterProfile.findFirst({
          where: {
            bookId,
            canonicalName: line.characterName,
            isActive: true,
          },
        });

        let characterId: string | null = null;
        if (character) {
          characterId = character.id;
        } else if (line.characterName === "旁白") {
          // 旁白不关联具体角色
          characterId = null;
        } else {
          console.warn(`未找到角色: ${line.characterName}`);
        }

        await tx.scriptSentence.create({
          data: {
            bookId,
            segmentId: line.segmentId,
            chapterId: line.chapterId ?? null,
            characterId: characterId,
            text: line.text,
            tone: line.emotion,
            orderInSegment: line.orderInSegment,
            ttsParameters: line.metadata || {},
          },
        });
      }

      // 更新书籍状态（如果还没有生成过完整的台本）
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: "script_generated",
          metadata: {
            scriptGeneratedAt: new Date().toISOString(),
            lastPartialGenerationAt: new Date().toISOString(),
            partialGenerationSegments: segmentIds.length,
          },
        },
      });
    });
  }

  /**
   * 保存生成的台本到数据库（全量）
   */
  async saveScriptToDatabase(
    bookId: string,
    script: GeneratedScript
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 删除现有的台词记录
      await tx.scriptSentence.deleteMany({
        where: { bookId },
      });

      // 保存新的台词记录
      for (const line of script.dialogueLines) {
        // 查找角色ID
        const character = await tx.characterProfile.findFirst({
          where: {
            bookId,
            canonicalName: line.characterName,
            isActive: true,
          },
        });

        let characterId: string | null = null;
        if (character) {
          characterId = character.id;
        } else if (line.characterName === "旁白") {
          // 旁白不关联具体角色
          characterId = null;
        } else {
          console.warn(`未找到角色: ${line.characterName}`);
        }

        await tx.scriptSentence.create({
          data: {
            bookId,
            segmentId: line.segmentId,
            chapterId: line.chapterId ?? null,
            characterId: characterId,
            text: line.text,
            tone: line.emotion,
            orderInSegment: line.orderInSegment,
            ttsParameters: line.metadata || {},
          },
        });
      }

      // 更新书籍状态
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: "script_generated",
          metadata: {
            scriptGeneratedAt: new Date().toISOString(),
            totalScriptLines: script.summary.totalLines,
            dialogueCount: script.summary.dialogueCount,
            narrationCount: script.summary.narrationCount,
          },
        },
      });
    });
  }
}

/**
 * 获取台本生成器实例
 */
export function getScriptGenerator(): ScriptGenerator {
  return new ScriptGenerator();
}
