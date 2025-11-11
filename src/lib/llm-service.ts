import { TTSError } from './error-handler'
import OpenAI from 'openai'

export interface LLMProvider {
  name: string
  apiKey: string
  baseURL?: string
  model: string
}

export interface CharacterInfo {
  name: string
  aliases: string[]
  description: string
  age?: number
  gender: 'male' | 'female' | 'unknown'
  personality: string[]
  relationships: Record<string, string>
  dialogueStyle: string
  emotionalTone: string[]
  frequency: number // 出现频率
  importance: 'main' | 'secondary' | 'minor'
}

export interface EmotionAnalysis {
  emotion: string
  intensity: number // 0-1
  confidence: number // 0-1
  context: string
}

export interface DialogueSegment {
  character: string
  dialogue: string
  emotion: string
  context: string
  position: {
    segmentIndex: number
    startIndex: number
    endIndex: number
  }
}

export interface ScriptAnalysisResult {
  characters: CharacterInfo[]
  dialogues: DialogueSegment[]
  emotions: EmotionAnalysis[]
  summary: {
    totalCharacters: number
    mainCharacters: number
    dialogueCount: number
    emotionTypes: string[]
    genre?: string
    tone: string
  }
}

/**
 * LLM服务类
 */
export class LLMService {
  private openai: OpenAI
  private model: string
  private providerName: string

  constructor(provider: LLMProvider) {
    // 根据provider配置OpenAI客户端
    const openaiConfig: any = {
      apiKey: provider.apiKey
    }

    // 设置自定义baseURL（用于DeepSeek等兼容OpenAI API的服务）
    if (provider.baseURL && provider.baseURL !== 'https://api.openai.com/v1') {
      if (provider.baseURL.includes('deepseek.com')) {
        openaiConfig.baseURL = 'https://api.deepseek.com/v1'
      } else {
        openaiConfig.baseURL = provider.baseURL
      }
    }

    this.openai = new OpenAI(openaiConfig)
    this.model = provider.model
    this.providerName = provider.name
  }

  /**
   * 公共的LLM调用方法
   */
  async callLLM(prompt: string, systemPrompt?: string): Promise<string> {
    return this.callLLMPrivate(prompt, systemPrompt)
  }

  /**
   * 调用LLM API
   */
  async callLLMPrivate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ]

    try {
      console.log(`LLM API调用: ${this.providerName} - ${this.openai.baseURL}`)
      console.log(`使用模型: ${this.model}`)

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4000,
        // DeepSeek等兼容API的特殊参数
        ...(this.providerName === 'custom' && { stream: false })
      })

      return response.choices[0]?.message?.content || ''
    } catch (error: any) {
      console.error('OpenAI SDK错误:', error)

      // 处理OpenAI SDK错误
      if (error instanceof OpenAI.APIError) {
        throw new TTSError(
          `LLM API调用失败: ${error.message}`,
          'TTS_SERVICE_DOWN',
          this.providerName
        )
      }

      if (error instanceof OpenAI.RateLimitError) {
        throw new TTSError(
          'LLM API调用频率超限，请稍后重试',
          'TTS_SERVICE_DOWN',
          this.providerName,
          true
        )
      }

      if (error instanceof OpenAI.AuthenticationError) {
        throw new TTSError(
          'LLM API认证失败，请检查API密钥',
          'TTS_SERVICE_DOWN',
          this.providerName
        )
      }

      // 其他错误
      throw new TTSError(
        'LLM服务连接失败',
        'TTS_SERVICE_DOWN',
        this.providerName,
        true
      )
    }
  }

  /**
   * 分析文本并识别角色和情感
   */
  async analyzeScript(text: string): Promise<ScriptAnalysisResult> {
    // 如果文本太长，分段处理
    const maxTextLength = 8000
    const chunks = this.splitTextIntoChunks(text, maxTextLength)

    if (chunks.length === 1) {
      return this.analyzeScriptChunk(text)
    }

    // 多个文本块的处理
    const allCharacters: CharacterInfo[] = []
    const allDialogues: DialogueSegment[] = []
    const allEmotions: EmotionAnalysis[] = []
    let genre: string | undefined
    let tone = ''

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const result = await this.analyzeScriptChunk(chunk, i > 0)

      // 合并角色信息
      await this.mergeCharacterInfo(allCharacters, result.characters)

      // 合并对话信息（调整位置索引）
      const adjustedDialogues = result.dialogues.map(dialogue => ({
        ...dialogue,
        position: {
          ...dialogue.position,
          segmentIndex: dialogue.position.segmentIndex + i * 1000 // 简单的索引调整
        }
      }))
      allDialogues.push(...adjustedDialogues)

      // 合并情感信息
      allEmotions.push(...result.emotions)

      // 使用第一个识别的体裁和语调
      if (!genre && result.summary.genre) {
        genre = result.summary.genre
      }
      if (!tone && result.summary.tone) {
        tone = result.summary.tone
      }
    }

    return {
      characters: allCharacters,
      dialogues: allDialogues,
      emotions: allEmotions,
      summary: {
        totalCharacters: allCharacters.length,
        mainCharacters: allCharacters.filter(c => c.importance === 'main').length,
        dialogueCount: allDialogues.length,
        emotionTypes: [...new Set(allEmotions.map(e => e.emotion))],
        genre,
        tone
      }
    }
  }

  /**
   * 分析单个文本块
   */
  private async analyzeScriptChunk(text: string, isContinuation = false): Promise<ScriptAnalysisResult> {
    const systemPrompt = `你是一个专业的文本分析专家，专门分析小说和剧本中的角色和情感。

你的任务是：
1. 识别文本中的所有角色，包括主要角色和次要角色
2. 分析每个角色的特征：性别、年龄、性格、对话风格等
3. 识别对话并分配给对应角色
4. 分析每段对话的情感色彩
5. 总结文本的体裁和整体语调

请以JSON格式返回分析结果，包含以下字段：
- characters: 角色数组，每个角色包含name, aliases, description, gender, personality, dialogueStyle, emotionalTone, importance等
- dialogues: 对话数组，包含character, dialogue, emotion, context, position
- emotions: 情感分析数组，包含emotion, intensity, confidence, context
- summary: 总结信息，包含totalCharacters, mainCharacters, dialogueCount, emotionTypes, genre, tone

注意：
- 如果是连续文本块，优先识别已存在的角色
- 角色别名要包含各种称呼方式
- 情感强度用0-1的数值表示
- 对话位置要准确标注`

    const continuationPrompt = isContinuation ?
      '\n\n注意：这是前面文本的延续，请重点关注已识别角色的出现。' : ''

    const prompt = `请分析以下文本，识别角色和情感：

${text}

${continuationPrompt}

请返回JSON格式的分析结果。`

    const response = await this.callLLM(prompt, systemPrompt)

    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('LLM返回格式不正确')
      }

      const result = JSON.parse(jsonMatch[0])

      // 验证和标准化数据格式
      return this.validateAnalysisResult(result)
    } catch (error) {
      console.error('LLM分析结果解析失败:', error)
      throw new TTSError(
        '文本分析失败，LLM返回格式错误',
        'TTS_SERVICE_DOWN',
        this.providerName
      )
    }
  }

  /**
   * 验证和标准化分析结果
   */
  private validateAnalysisResult(result: any): ScriptAnalysisResult {
    const characters: CharacterInfo[] = (result.characters || []).map((char: any) => ({
      name: char.name || '未知角色',
      aliases: Array.isArray(char.aliases) ? char.aliases : [],
      description: char.description || '',
      age: char.age,
      gender: ['male', 'female', 'unknown'].includes(char.gender) ? char.gender : 'unknown',
      personality: Array.isArray(char.personality) ? char.personality : [],
      relationships: char.relationships || {},
      dialogueStyle: char.dialogueStyle || '正常',
      emotionalTone: Array.isArray(char.emotionalTone) ? char.emotionalTone : [],
      frequency: char.frequency || 0,
      importance: ['main', 'secondary', 'minor'].includes(char.importance) ? char.importance : 'minor'
    }))

    const dialogues: DialogueSegment[] = (result.dialogues || []).map((dialogue: any) => ({
      character: dialogue.character || '未知',
      dialogue: dialogue.dialogue || '',
      emotion: dialogue.emotion || '中性',
      context: dialogue.context || '',
      position: {
        segmentIndex: dialogue.position?.segmentIndex || 0,
        startIndex: dialogue.position?.startIndex || 0,
        endIndex: dialogue.position?.endIndex || 0
      }
    }))

    const emotions: EmotionAnalysis[] = (result.emotions || []).map((emotion: any) => ({
      emotion: emotion.emotion || '中性',
      intensity: Math.max(0, Math.min(1, emotion.intensity || 0.5)),
      confidence: Math.max(0, Math.min(1, emotion.confidence || 0.5)),
      context: emotion.context || ''
    }))

    const summary = {
      totalCharacters: characters.length,
      mainCharacters: characters.filter(c => c.importance === 'main').length,
      dialogueCount: dialogues.length,
      emotionTypes: [...new Set(emotions.map(e => e.emotion))],
      genre: result.summary?.genre,
      tone: result.summary?.tone || '中性'
    }

    return {
      characters,
      dialogues,
      emotions,
      summary
    }
  }

  /**
   * 合并角色信息
   */
  private async mergeCharacterInfo(
    existing: CharacterInfo[],
    newCharacters: CharacterInfo[]
  ): Promise<void> {
    for (const newChar of newCharacters) {
      const existingChar = existing.find(c =>
        c.name === newChar.name ||
        c.aliases.some(alias => newChar.aliases.includes(alias)) ||
        newChar.aliases.some(alias => c.aliases.includes(alias))
      )

      if (existingChar) {
        // 合并信息
        existingChar.aliases = [...new Set([...existingChar.aliases, ...newChar.aliases])]
        existingChar.description = existingChar.description || newChar.description
        existingChar.age = existingChar.age || newChar.age
        existingChar.gender = existingChar.gender !== 'unknown' ? existingChar.gender : newChar.gender
        existingChar.personality = [...new Set([...existingChar.personality, ...newChar.personality])]
        existingChar.emotionalTone = [...new Set([...existingChar.emotionalTone, ...newChar.emotionalTone])]
        existingChar.frequency += newChar.frequency
        if (existingChar.importance === 'minor' && newChar.importance !== 'minor') {
          existingChar.importance = newChar.importance
        }
      } else {
        existing.push(newChar)
      }
    }

    // 按重要性和频率排序
    existing.sort((a, b) => {
      const importanceWeight = { main: 3, secondary: 2, minor: 1 }
      const aWeight = importanceWeight[a.importance] + a.frequency * 0.01
      const bWeight = importanceWeight[b.importance] + b.frequency * 0.01
      return bWeight - aWeight
    })
  }

  /**
   * 分割文本为块
   */
  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text]
    }

    const chunks: string[] = []
    let currentChunk = ''

    // 按段落分割
    const paragraphs = text.split('\n\n')

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxLength && currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }
}

/**
 * 获取LLM服务实例
 */
export function getLLMService(): LLMService {
  const provider: LLMProvider = {
    name: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  }

  if (!provider.apiKey) {
    throw new TTSError(
      'LLM服务未配置，请设置API密钥',
      'TTS_SERVICE_DOWN',
      provider.name
    )
  }

  return new LLMService(provider)
}