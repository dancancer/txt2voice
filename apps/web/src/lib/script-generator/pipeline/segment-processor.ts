import { TTSError } from "@/lib/error-handler";
import {
  addCharacterToMap,
  normalizeCharacterCandidates,
  resolveCandidateCanonicalName,
  upsertCharacterCandidates,
} from "../storage/character-utils";
import { parseLLMJsonResult } from "./json-utils";
import { saveSegmentScriptToDatabase } from "../storage/persistence";
import type {
  DialogueLine,
  ScriptGenerationOptions,
  SegmentProcessingResult,
} from "../types";

interface LLMClient {
  callLLM(prompt: string, systemPrompt?: string): Promise<string>;
}

const buildCharacterInfoText = (characterProfiles: any[]): string => {
  const characterInfo = characterProfiles
    .map((char) => {
      const aliases = char.aliases.map((a: any) => a.alias).join(", ");
      const characteristics = (char.characteristics as any) || {};
      const voicePreferences = (char.voicePreferences as any) || {};
      return {
        name: char.canonicalName,
        aliases,
        gender: char.genderHint || "unknown",
        age: char.ageHint?.toString() || "未知",
        personality: Array.isArray(characteristics.personality)
          ? characteristics.personality.join(", ")
          : characteristics.personality,
        dialogueStyle: voicePreferences.dialogueStyle || "自然",
        importance: characteristics.importance || "secondary",
      };
    })
    .filter((char) => char.name !== "旁白");

  if (characterInfo.length === 0) {
    return "无";
  }

  return characterInfo
    .map(
      (char, index) =>
        `${index + 1}. ${char.name}\n` +
        `   别名: ${char.aliases || "无"}\n` +
        `   性别: ${char.gender}, 年龄: ${char.age}\n` +
        `   性格特征: ${char.personality}\n` +
        `   对话风格: ${char.dialogueStyle}\n` +
        `   重要程度: ${char.importance}\n`
    )
    .join("\n");
};

const buildSystemPrompt = (characterInfoText: string): string => {
  return `你是一个专业的台本编剧，专门将小说文本转换为适合有声读物朗读的台本。

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
};

const resolveScriptSentences = (result: any): any[] => {
  if (Array.isArray(result)) {
    return result;
  }

  if (result.dialogues && Array.isArray(result.dialogues)) {
    return result.dialogues;
  }

  if (result.dialogueLines && Array.isArray(result.dialogueLines)) {
    return result.dialogueLines;
  }

  console.warn("未找到有效的台词数据，使用空数组");
  return [];
};

const resolveRawCharacters = (result: any): any[] => {
  if (result.characters && Array.isArray(result.characters)) {
    return result.characters;
  }

  if (result.newCharacters && Array.isArray(result.newCharacters)) {
    return result.newCharacters;
  }

  return [];
};

const mapDialogueLines = (params: {
  segment: any;
  scriptSentences: any[];
  characterMap: Map<string, string>;
}): DialogueLine[] => {
  const { segment, scriptSentences, characterMap } = params;

  return scriptSentences.map((sentence: any, index: number) => {
    let characterName = sentence.speaker || "未知";

    if (characterName !== "旁白") {
      characterName = characterMap.get(characterName) || characterName;
    }

    const ttsHints =
      sentence.ttsHints && typeof sentence.ttsHints === "object"
        ? sentence.ttsHints
        : {
            pitch: 1.0,
            rate: 1.0,
            emphasis: "",
          };

    return {
      id: sentence.id || `${segment.id}_${index}`,
      characterName,
      rawSpeaker:
        typeof sentence.speaker === "string" ? sentence.speaker : undefined,
      text: sentence.text || "",
      tone: sentence.tone || "中性",
      roleType: characterName === "旁白" ? "narration" : "dialogue",
      emotionLabel:
        typeof sentence.emotionLabel === "string" ? sentence.emotionLabel : undefined,
      emotionIntensity:
        typeof sentence.emotionIntensity === "number"
          ? sentence.emotionIntensity
          : undefined,
      engineHint:
        typeof sentence.engineHint === "string" ? sentence.engineHint : undefined,
      priority:
        sentence.priority === "high" ||
        sentence.priority === "normal" ||
        sentence.priority === "low"
          ? sentence.priority
          : undefined,
      prosody:
        sentence.prosody && typeof sentence.prosody === "object"
          ? sentence.prosody
          : undefined,
      strength: typeof sentence.strength === "number" ? sentence.strength : 75,
      pauseAfter:
        typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
      segmentId: segment.id,
      chapterId: segment.chapterId,
      orderInSegment: index,
      isNarration: characterName === "旁白",
      ttsParameters: {
        ttsHints,
        originalSpeaker: sentence.speaker,
        engineHint:
          typeof sentence.engineHint === "string" ? sentence.engineHint : undefined,
        strength: typeof sentence.strength === "number" ? sentence.strength : 75,
        pauseAfter:
          typeof sentence.pauseAfter === "number" ? sentence.pauseAfter : 1.5,
        confidence: 0.8,
      },
    };
  });
};

export async function processSegment(params: {
  llmService: LLMClient;
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
}): Promise<SegmentProcessingResult> {
  const { llmService, segment, characterMap, characterProfiles, options } =
    params;

  const characterInfoText = buildCharacterInfoText(characterProfiles);
  const systemPrompt = buildSystemPrompt(characterInfoText);

  const prompt = `请分析以下文本段落，生成朗读台本并补充角色信息：

${segment.content}

请只输出一个完整JSON对象，必须以 { 开始、以 } 结束，不要包含任何额外文字或Markdown代码块。`;

  const response = await llmService.callLLM(prompt, systemPrompt);
  console.log("LLM台本响应长度", { segmentId: segment.id, length: response.length });

  try {
    const result = await parseLLMJsonResult(llmService, response);
    const scriptSentences = resolveScriptSentences(result);
    const rawCharacters = resolveRawCharacters(result);

    const characterCandidates = normalizeCharacterCandidates(rawCharacters);
    for (const candidate of characterCandidates) {
      const canonicalName = resolveCandidateCanonicalName(candidate, characterMap);
      const aliasSet = new Set(candidate.aliases);
      if (candidate.name !== canonicalName) {
        aliasSet.add(candidate.name);
      }

      addCharacterToMap(characterMap, {
        canonicalName,
        aliases: [...aliasSet].map((alias) => ({ alias })),
      });
    }

    const dialogueLines = mapDialogueLines({
      segment,
      scriptSentences,
      characterMap,
    });

    const filteredLines = dialogueLines.filter((line) => {
      const textLength = line.text.trim().length;
      return (
        textLength >= options.minDialogueLength &&
        textLength <= options.maxDialogueLength
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

export async function processSegmentAndSave(params: {
  llmService: LLMClient;
  segment: any;
  characterMap: Map<string, string>;
  characterProfiles: any[];
  options: ScriptGenerationOptions;
  bookId: string;
}): Promise<SegmentProcessingResult> {
  const { llmService, segment, characterMap, characterProfiles, options, bookId } =
    params;

  const result = await processSegment({
    llmService,
    segment,
    characterMap,
    characterProfiles,
    options,
  });

  if (result.dialogueLines.length === 0) {
    throw new TTSError(
      `段落 ${segment.id} 未生成有效台词`,
      "TTS_SERVICE_DOWN",
      "script-generator"
    );
  }

  if (result.characterCandidates.length > 0) {
    await upsertCharacterCandidates({
      bookId,
      candidates: result.characterCandidates,
      characterProfiles,
      characterMap,
    });
  }

  await saveSegmentScriptToDatabase({
    bookId,
    segmentId: segment.id,
    dialogueLines: result.dialogueLines,
    characterProfiles,
    characterMap,
  });

  return result;
}
