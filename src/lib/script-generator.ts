import { TTSError } from "./error-handler";
import { getLLMService } from "./llm-service";
import prisma from "./prisma";

export interface DialogueLine {
  id: string;
  characterName: string;
  text: string;
  emotion: string;
  context: string;
  segmentId: string;
  orderInSegment: number;
  isNarration: boolean;
  metadata?: Record<string, any>;
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
    options: Partial<ScriptGenerationOptions> = {}
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

    // 先进行角色识别（如果还没有角色）
    if (book.characterProfiles.length === 0) {
      console.log("没有找到角色，开始自动识别角色...");
      await this.identifyAndCreateCharacters(bookId, book.textSegments);

      // 重新获取角色信息
      const updatedBook = await prisma.book.findUnique({
        where: { id: bookId },
        include: {
          characterProfiles: {
            where: { isActive: true },
            include: { aliases: true },
          },
        },
      });

      if (!updatedBook) {
        throw new TTSError(
          "角色识别失败",
          "TTS_SERVICE_DOWN",
          "script-generator"
        );
      }

      book.characterProfiles = updatedBook.characterProfiles;
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
  ): Promise<{ dialogueLines: DialogueLine[] }> {
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

    const systemPrompt = `你是一个专业的台本编剧，专门将小说文本转换为适合有声读物朗读的台本。

你的任务是：
1. 识别文本中的对话和旁白
2. 将对话分配给正确的角色
3. 分析每段台词的情感色彩
4. 提供适当的朗读指导

已知角色信息：
${characterInfo
  .map(
    (char, index) =>
      `${index + 1}. ${char.name}\n` +
      `   别名: ${char.aliases || "无"}\n` +
      `   性别: ${char.gender}, 年龄: ${char.age}\n` +
      `   性格特征: ${char.personality}\n` +
      `   对话风格: ${char.dialogueStyle}\n` +
      `   重要程度: ${char.importance}\n`
  )
  .join("\n")}

识别规则：
1. 优先使用提供的角色名称
2. 注意角色的别名变化
3. 如果遇到未识别的对话，可以推断为新角色并标记为"未知角色X"
4. 旁白内容标记为 "旁白"

请返回JSON格式的台词数组，每个台词对象包含以下字段：
[
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
]

字段说明：
- id: 台词唯一标识符（自动生成）
- text: 台词内容
- speaker: 说话人角色名称（必须是上面列表中的角色，或"旁白"，或"未知角色X"）
- tone: 情感/语气（如：平静、激动、悲伤、愤怒、温柔、严肃等）
- strength: 音量强度（0-100，默认75）
- pauseAfter: 后停顿时间（秒，默认1.5）
- ttsHints: TTS提示对象
  - pitch: 音调（默认1.0）
  - rate: 语速（默认1.0）
  - emphasis: 需要强调的词

注意事项：
- 严格按照提供的角色列表分配对话
- 旁白部分标记 character 设为 "旁白"
- 情感描述要简洁明确，符合角色性格
- 保持原文的语调和风格
- 确保对话内容准确分配给对应角色`;

    const prompt = `请分析以下文本段落，生成朗读台本：

${segment.content}

请返回JSON格式的台词数组，严格按照上面定义的格式。`;

    const response = await this.llmService.callLLM(prompt, systemPrompt);

    console.log("=============", response);
    try {
      // 尝试匹配JSON格式（数组或对象）
      const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonArrayMatch && !jsonObjectMatch) {
        throw new Error("LLM返回格式不正确");
      }

      let jsonString = jsonArrayMatch?.[0] || jsonObjectMatch?.[0];
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
      if (Array.isArray(result)) {
        // 新格式：直接是台词数组
        scriptSentences = result;
      } else if (result.dialogues && Array.isArray(result.dialogues)) {
        // 旧格式：包含dialogues字段的对象
        scriptSentences = result.dialogues;
      } else {
        console.warn("未找到有效的台词数据，使用空数组");
        scriptSentences = [];
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

      return { dialogueLines: filteredLines };
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
  ): Promise<{ dialogueLines: DialogueLine[] }> {
    // 处理段落获取台词
    const result = await this.processSegment(
      segment,
      characterMap,
      characterProfiles,
      options
    );

    // 立即将该段落的台词写入数据库
    if (result.dialogueLines.length > 0) {
      await this.saveSegmentScriptToDatabase(
        bookId,
        segment.id,
        result.dialogueLines,
        characterProfiles
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
    characterProfiles: any[]
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
        const character = characterProfiles.find(
          (char) => char.canonicalName === line.characterName
        );

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
      // 主名称映射
      map.set(profile.canonicalName, profile.canonicalName);

      // 别名映射
      if (profile.aliases) {
        for (const alias of profile.aliases) {
          map.set(alias.alias, profile.canonicalName);
        }
      }

      // 常见变体映射
      const commonVariations = this.generateCommonVariations(
        profile.canonicalName
      );
      for (const variation of commonVariations) {
        map.set(variation, profile.canonicalName);
      }
    }

    return map;
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

  /**
   * 修复JSON语法错误（本地修复）
   */
  private fixJsonSyntax(jsonString: string): string {
    let fixed = jsonString;

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

    return fixed;
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
4. 只返回JSON，不要添加其他文字

修复后的JSON：`;

    const response = await this.llmService.callLLM(
      prompt,
      "你是一个JSON修复专家，专门修复格式错误的JSON。请确保返回的JSON语法完全正确。"
    );

    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return jsonMatch[0];
      }
    } catch (error) {
      console.error("LLM修复失败，返回默认格式:", error);
    }

    // 如果所有修复都失败，返回基本的默认结构
    return '{"dialogues": []}';
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
      if (!line.isNarration) {
        summary.characterDistribution[line.characterName] =
          (summary.characterDistribution[line.characterName] || 0) + 1;
      }
    }

    // 情感分布统计
    for (const line of dialogueLines) {
      summary.emotionDistribution[line.emotion] =
        (summary.emotionDistribution[line.emotion] || 0) + 1;
    }

    return summary;
  }

  /**
   * 识别并创建角色
   */
  private async identifyAndCreateCharacters(
    bookId: string,
    textSegments: any[]
  ): Promise<void> {
    try {
      // 合并部分文本用于角色识别
      const sampleTexts = textSegments
        .filter((segment) => segment.content.length > 50) // 过滤太短的段落
        .slice(0, 10) // 只取前10个段落用于识别
        .map((segment) => segment.content)
        .join("\n\n")
        .substring(0, 3000); // 限制长度

      if (sampleTexts.length < 100) {
        console.warn("文本太短，可能无法准确识别角色");
      }

      const systemPrompt = `你是一个专业的角色识别专家，专门分析小说文本中的角色信息。

你的任务是：
1. 识别文本中的所有重要角色
2. 分析角色的性别、年龄、性格特征
3. 识别角色的别名和称呼方式
4. 判断角色的重要性（主角、配角、次要角色）

请返回JSON格式的结果，包含以下字段：
- characters: 角色数组，每个角色包含：
  - name: 角色姓名
  - aliases: 别名数组
  - description: 角色描述
  - gender: 性别 (male/female/unknown)
  - age: 大概年龄
  - personality: 性格特征数组
  - importance: 重要性 (main/secondary/minor)
  - dialogueStyle: 对话风格描述

注意：
- 只识别有对话或重要作用的角色
- 角色名要准确，包括常见的称呼方式
- 忽略无名的背景角色
- 确保每个角色都有足够的描述信息`;

      const prompt = `请分析以下文本，识别其中的角色：

${sampleTexts}

请返回JSON格式的角色识别结果。`;

      const response = await this.llmService.callLLM(prompt, systemPrompt);

      // 解析LLM响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("角色识别返回格式不正确");
      }

      const result = JSON.parse(jsonMatch[0]);
      const identifiedCharacters = result.characters || [];

      if (identifiedCharacters.length === 0) {
        // 如果没有识别到角色，创建默认角色
        await this.createDefaultCharacters(bookId);
        return;
      }

      // 保存识别到的角色
      await prisma.$transaction(async (tx) => {
        for (const char of identifiedCharacters) {
          if (!char.name || char.name.trim().length === 0) continue;

          const character = await tx.characterProfile.create({
            data: {
              bookId,
              canonicalName: char.name.trim(),
              characteristics: {
                description:
                  char.description || `文本中识别的角色: ${char.name}`,
                personality: Array.isArray(char.personality)
                  ? char.personality
                  : [char.personality || "正常"],
                importance: ["main", "secondary", "minor"].includes(
                  char.importance
                )
                  ? char.importance
                  : "secondary",
                relationships: {},
              },
              voicePreferences: {
                dialogueStyle: char.dialogueStyle || "自然",
              },
              genderHint:
                char.gender === "male" || char.gender === "female"
                  ? char.gender
                  : "unknown",
              ageHint: this.parseAgeHint(char.age),
              emotionBaseline: "neutral",
              isActive: true,
            },
          });

          // 创建别名
          if (
            char.aliases &&
            Array.isArray(char.aliases) &&
            char.aliases.length > 0
          ) {
            await tx.characterAlias.createMany({
              data: char.aliases
                .filter((alias: string) => alias && alias.trim())
                .map((alias: string) => ({
                  characterId: character.id,
                  alias: alias.trim(),
                })),
            });
          }
        }
      });

      console.log(`成功识别并创建了 ${identifiedCharacters.length} 个角色`);
    } catch (error) {
      console.error("角色识别失败:", error);
      // 创建默认角色作为后备
      await this.createDefaultCharacters(bookId);
    }
  }

  /**
   * 创建默认角色（后备方案）
   */
  private async createDefaultCharacters(bookId: string): Promise<void> {
    console.log("创建默认角色作为后备方案");

    await prisma.$transaction(async (tx) => {
      // 创建默认的旁白角色
      const narrator = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: "旁白",
          characteristics: {
            description: "故事叙述者，负责讲述背景和场景描述",
            personality: ["客观", "清晰"],
            importance: "main",
            relationships: {},
          },
          voicePreferences: {
            dialogueStyle: "叙述风格",
          },
          genderHint: "unknown",
          ageHint: null,
          emotionBaseline: "neutral",
          isActive: true,
        },
      });

      // 创建通用的男主角/女主角
      const maleProtagonist = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: "男主角",
          characteristics: {
            description: "故事的主要男性角色",
            personality: ["勇敢", "正直"],
            importance: "main",
            relationships: {},
          },
          voicePreferences: {
            dialogueStyle: "自然",
          },
          genderHint: "male",
          ageHint: 25,
          emotionBaseline: "neutral",
          isActive: true,
        },
      });

      const femaleProtagonist = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: "女主角",
          characteristics: {
            description: "故事的主要女性角色",
            personality: ["温柔", "善良"],
            importance: "main",
            relationships: {},
          },
          voicePreferences: {
            dialogueStyle: "温柔",
          },
          genderHint: "female",
          ageHint: 23,
          emotionBaseline: "neutral",
          isActive: true,
        },
      });
    });
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
    } = {}
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

    // 确保有角色信息
    if (book.characterProfiles.length === 0) {
      await this.identifyAndCreateCharacters(bookId, book.textSegments);
      // 重新获取角色信息
      const updatedBook = await prisma.book.findUnique({
        where: { id: bookId },
        include: {
          characterProfiles: {
            where: { isActive: true },
            include: { aliases: true },
          },
        },
      });

      if (!updatedBook) {
        throw new TTSError(
          "角色识别失败",
          "TTS_SERVICE_DOWN",
          "script-generator"
        );
      }

      book.characterProfiles = updatedBook.characterProfiles;
    }

    // 构建角色名称映射（包含别名）
    const characterMap = this.buildCharacterMap(book.characterProfiles);

    const allDialogueLines: DialogueLine[] = [];
    const segmentSummaries: any[] = [];

    // 确定起始段落
    let startIndex = 0;
    if (params.startFromOrderIndex !== null) {
      startIndex = book.textSegments.findIndex(
        (seg) => seg.orderIndex === params.startFromOrderIndex
      );
      if (startIndex === -1) {
        startIndex = book.textSegments.findIndex(
          (seg) => seg.id === params.startFromSegmentId
        );
      }
      if (startIndex === -1) {
        throw new TTSError(
          "未找到指定的起始段落",
          "TTS_SERVICE_DOWN",
          "script-generator"
        );
      }
    }

    // 计算实际要处理的段落数量
    // const endIndex = params.limitToSegments
    //   ? Math.min(startIndex + params.limitToSegments, book.textSegments.length)
    //   : book.textSegments.length;
    const endIndex = 2;
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
    options: Partial<ScriptGenerationOptions> = {}
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
    for (const segment of book.textSegments) {
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
