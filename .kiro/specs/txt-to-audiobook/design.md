# 设计文档

## 概述

文本转有声书系统是一个复杂的Web应用程序，旨在将完整的小说文本自动转换成结构化的有声书内容。系统采用前后端分离架构，支持大文本处理、智能角色识别、多TTS提供商集成和音频处理功能。

## 系统架构

### 整体架构

```mermaid
graph TB
    subgraph "前端层 (Next.js)"
        A[文件上传界面]
        B[文本编辑器]
        C[角色管理界面]
        D[音频预览播放器]
        E[进度监控面板]
    end

    subgraph "API层 (Next.js + Hono)"
        F[上传处理API]
        G[文本解析API]
        H[角色识别API]
        I[台本生成Agent]
        J[TTS合成API]
        K[音频拼接API]
    end

    subgraph "服务层"
        L[文本清洗服务]
        M[NLP处理服务]
        N[LLM台本生成Agent]
        O[任务队列服务]
        P[TTS提供商适配器]
        Q[音频处理服务]
    end

    subgraph "数据层"
        R[(PostgreSQL)]
        S[Redis缓存]
        T[文件存储]
        U[LLM API缓存]
    end

    A --> F
    B --> G
    C --> H
    D --> J
    E --> K

    F --> L
    G --> M
    H --> N
    I --> N
    J --> P
    K --> Q

    L --> R
    M --> R
    N --> U
    O --> S
    P --> T
    Q --> T
```

### 技术栈选择

**前端技术栈**
- Next.js 16 + React 19 - 现代化React框架，支持SSR和静态生成
- TypeScript - 类型安全的JavaScript
- Tailwind CSS + Radix UI - 现代化UI框架和组件库
- Zustand - 轻量级状态管理
- Web Speech API - 浏览器原生TTS能力

**后端技术栈**
- Next.js 16 + Hono - 现代化全栈框架，支持API Routes和Edge Runtime
- TypeScript - 前后端统一类型系统
- Bull Queue + Redis - 异步任务队列处理
- PostgreSQL - 关系型数据库，支持复杂查询
- Prisma ORM - 类型安全的数据库访问
- OpenAI/Anthropic API - LLM服务用于台本生成

**音频处理**
- Web Audio API - 浏览器音频处理
- FFmpeg - 音频格式转换和处理
- Multiple TTS Providers - 支持多种TTS服务

## LLM台本生成Agent设计

### Agent架构

```mermaid
graph TB
    subgraph "台本生成Agent"
        A[文本分段输入]
        B[角色识别模块]
        C[情绪分析模块]
        D[语句分割模块]
        E[台本结构化模块]
        F[质量验证模块]
    end

    subgraph "LLM服务"
        G[OpenAI GPT-4]
        H[Claude-3]
        I[本地模型备用]
    end

    subgraph "知识库"
        J[角色特征库]
        K[情绪词典]
        L[语句模式库]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F

    B --> J
    C --> K
    D --> L

    B --> G
    C --> G
    D --> G
    E --> G

    G --> H
    H --> I
```

### 台本生成流程

**1. 文本预处理阶段**
```typescript
interface PreprocessingResult {
  cleanText: string;
  sentences: Sentence[];
  potentialCharacters: string[];
  dialoguePatterns: DialoguePattern[];
}

interface Sentence {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  type: 'dialogue' | 'narration' | 'description';
  speaker?: string;
}
```

**2. 角色识别与消歧**
```typescript
interface CharacterIdentificationAgent {
  identifyCharacters(text: string): Promise<CharacterCandidate[]>;
  resolveAliases(characters: CharacterCandidate[]): Promise<Character[]>;
  buildCharacterProfile(character: string, context: string[]): Promise<CharacterProfile>;
}

interface CharacterProfile {
  canonicalName: string;
  aliases: string[];
  genderHint: 'male' | 'female' | 'unknown';
  ageHint?: number;
  personality: string[];
  speechPatterns: string[];
  relationships: Record<string, string>;
  ttsProfile: TTSProfile;
}
```

**3. 情绪与语气分析**
```typescript
interface EmotionAnalysisAgent {
  analyzeEmotion(sentence: string, speaker: string, context: string[]): Promise<EmotionResult>;
  mapEmotionToTTSParameters(emotion: EmotionResult): TTSParameters;
}

interface EmotionResult {
  primary: string; // 'happy', 'sad', 'angry', 'neutral', etc.
  intensity: number; // 0-100
  secondary?: string;
  confidence: number; // 0-1
}

interface TTSParameters {
  pitch: number;
  rate: number;
  volume: number;
  style: string;
  pause: number;
}
```

**4. 语句分割与优化**
```typescript
interface ScriptSegmentationAgent {
  segmentLongSentence(sentence: string, maxLength: number): string[];
  optimizeForTTS(sentences: string[]): string[];
  addPauses(sentences: ScriptSentence[]): ScriptSentence[];
}

interface ScriptSentence {
  id: string;
  text: string;
  speaker: string;
  emotion: EmotionResult;
  ttsParameters: TTSParameters;
  pauseAfter: number;
  orderInSegment: number;
}
```

### LLM Prompt设计

**角色识别Prompt**
```typescript
const CHARACTER_IDENTIFICATION_PROMPT = `
你是一个专业的文本分析师，专门识别小说中的人物角色。

任务：
1. 从给定的文本片段中识别所有可能的说话人
2. 区分主要角色和次要角色
3. 识别角色的别名、昵称、敬称等
4. 判断角色的性别和年龄段
5. 分析角色的性格特征

输入文本：
{text}

输出格式（JSON）：
{
  "characters": [
    {
      "canonicalName": "标准名称",
      "aliases": ["别名1", "别名2"],
      "genderHint": "male/female/unknown",
      "ageRange": "young/adult/elderly/unknown",
      "personality": ["性格特征1", "性格特征2"],
      "confidence": 0.95,
      "evidence": ["文本证据1", "文本证据2"]
    }
  ]
}
`;
```

**情绪分析Prompt**
```typescript
const EMOTION_ANALYSIS_PROMPT = `
你是一个专业的情绪分析师，专门分析文本中说话者的情绪状态。

任务：
1. 分析说话者的主要情绪
2. 评估情绪的强度
3. 识别混合情绪
4. 建议适合的TTS参数

上下文信息：
- 角色：{characterName}
- 性格特征：{personality}
- 前文：{precedingText}
- 当前语句：{currentSentence}
- 后文：{followingText}

输出格式（JSON）：
{
  "primaryEmotion": "主要情绪",
  "intensity": 75,
  "secondaryEmotion": "次要情绪（如有）",
  "confidence": 0.88,
  "reasoning": "判断依据",
  "ttsParameters": {
    "pitch": 1.2,
    "rate": 0.9,
    "volume": 0.85,
    "style": "cheerful",
    "pause": 0.5
  }
}
`;
```

**台本结构化Prompt**
```typescript
const SCRIPT_STRUCTURING_PROMPT = `
你是一个专业的有声书台本制作师，负责将文本转换为结构化的音频制作台本。

任务：
1. 将文本按说话人分割
2. 为每句话标注说话人
3. 分析情绪和语气
4. 设置停顿时间
5. 优化语句长度（适合TTS）

输入数据：
- 原始文本：{originalText}
- 角色列表：{characters}
- 已识别情绪：{emotions}

输出格式（JSON数组）：
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
`;
```

### Agent配置与管理

**Agent管理器**
```typescript
class ScriptGenerationAgent {
  private llmClient: LLMClient;
  private cache: Redis;
  private characterDatabase: CharacterDatabase;
  private emotionAnalyzer: EmotionAnalyzer;

  constructor(config: AgentConfig) {
    this.llmClient = new LLMClient(config.llm);
    this.cache = new Redis(config.redis);
    this.characterDatabase = new CharacterDatabase(config.database);
    this.emotionAnalyzer = new EmotionAnalyzer(config.emotionModel);
  }

  async generateScript(segment: TextSegment): Promise<ScriptSentence[]> {
    // 1. 检查缓存
    const cacheKey = this.generateCacheKey(segment);
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. 角色识别
    const characters = await this.identifyCharacters(segment);

    // 3. 情绪分析
    const emotions = await this.analyzeEmotions(segment, characters);

    // 4. 台本生成
    const script = await this.generateStructuredScript(segment, characters, emotions);

    // 5. 质量验证
    const validatedScript = await this.validateScript(script);

    // 6. 缓存结果
    await this.cache.setex(cacheKey, 3600, JSON.stringify(validatedScript));

    return validatedScript;
  }

  private async identifyCharacters(segment: TextSegment): Promise<Character[]> {
    const prompt = CHARACTER_IDENTIFICATION_PROMPT.replace('{text}', segment.content);
    const response = await this.llmClient.complete(prompt);
    return this.parseCharacterResponse(response);
  }

  private async analyzeEmotions(segment: TextSegment, characters: Character[]): Promise<EmotionAnalysis[]> {
    const sentences = this.splitIntoSentences(segment.content);
    const emotions: EmotionAnalysis[] = [];

    for (const sentence of sentences) {
      const speaker = this.identifySpeaker(sentence, characters);
      const prompt = EMOTION_ANALYSIS_PROMPT
        .replace('{characterName}', speaker.canonicalName)
        .replace('{personality}', speaker.personality.join(', '))
        .replace('{currentSentence}', sentence.text);

      const response = await this.llmClient.complete(prompt);
      emotions.push(this.parseEmotionResponse(response));
    }

    return emotions;
  }

  private async generateStructuredScript(
    segment: TextSegment,
    characters: Character[],
    emotions: EmotionAnalysis[]
  ): Promise<ScriptSentence[]> {
    const prompt = SCRIPT_STRUCTURING_PROMPT
      .replace('{originalText}', segment.content)
      .replace('{characters}', JSON.stringify(characters))
      .replace('{emotions}', JSON.stringify(emotions));

    const response = await this.llmClient.complete(prompt);
    return this.parseScriptResponse(response);
  }

  private async validateScript(script: ScriptSentence[]): Promise<ScriptSentence[]> {
    // 验证逻辑：检查角色一致性、情绪合理性、语句完整性等
    const issues = await this.detectScriptIssues(script);

    if (issues.length > 0) {
      // 自动修复或标记需要人工审核
      return this.autoFixScriptIssues(script, issues);
    }

    return script;
  }
}
```

**错误处理与重试机制**
```typescript
interface AgentErrorHandler {
  handleLLMError(error: LLMError): Promise<ScriptSentence[]>;
  fallbackToRuleBased(segment: TextSegment): Promise<ScriptSentence[]>;
  retryWithExponentialBackoff(request: LLMRequest): Promise<LLMResponse>;
}

class RobustScriptGenerator extends ScriptGenerationAgent {
  async generateScript(segment: TextSegment): Promise<ScriptSentence[]> {
    try {
      return await super.generateScript(segment);
    } catch (error) {
      if (error instanceof LLMQuotaExceededError) {
        // 降级到规则生成
        return this.generateRuleBasedScript(segment);
      }

      if (error instanceof LLMTimeoutError) {
        // 重试一次
        return this.retryWithDifferentModel(segment);
      }

      throw error;
    }
  }

  private async generateRuleBasedScript(segment: TextSegment): Promise<ScriptSentence[]> {
    // 基于规则的简单台本生成
    const sentences = this.splitIntoSentences(segment.content);
    return sentences.map((sentence, index) => ({
      id: `rule_${index}`,
      text: sentence.text,
      speaker: sentence.speaker || '旁白',
      tone: 'neutral',
      strength: 50,
      pauseAfter: sentence.text.endsWith('?') || sentence.text.endsWith('。') ? 1.0 : 0.5
    }));
  }
}
```

### 性能优化策略

**缓存策略**
```typescript
interface CacheStrategy {
  segmentCache: {
    key: (segment: TextSegment) => string;
    ttl: number; // 24小时
  };

  characterCache: {
    key: (text: string) => string;
    ttl: number; // 7天
  };

  emotionCache: {
    key: (sentence: string, speaker: string) => string;
    ttl: number; // 1小时
  };
}
```

**批处理与并行化**
```typescript
class BatchScriptGenerator {
  async generateBatch(segments: TextSegment[]): Promise<ScriptSentence[][]> {
    // 并行处理多个分段
    const batchSize = 3; // 限制并发数避免LLM限流
    const results: ScriptSentence[][] = [];

    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(segment => this.agent.generateScript(segment))
      );
      results.push(...batchResults);

      // 添加延迟避免API限流
      if (i + batchSize < segments.length) {
        await this.delay(1000);
      }
    }

    return results;
  }
}
```

## 声线管理系统设计

### 声线数据模型

**声线配置扩展**
```typescript
interface TTSVoiceProfile {
  id: string;
  provider: 'azure' | 'openai' | 'edge-tts' | 'xtts';
  voiceId: string;
  voiceName: string;
  displayName: string;
  description: string;

  // 声线特征描述
  characteristics: {
    gender: 'male' | 'female' | 'neutral' | 'child';
    ageRange: 'young' | 'adult' | 'middle_aged' | 'elderly';
    language: string;
    accent?: string;
    style: string[];
  };

  // 音频参数
  defaultParameters: {
    pitch: number;      // 0.5 - 2.0
    rate: number;       // 0.5 - 2.0
    volume: number;     // 0.0 - 1.0
  };

  // 预览音频
  previewAudio?: {
    url: string;
    duration: number;
    sampleText: string;
  };

  // 使用统计
  usageCount: number;
  rating: number;       // 1-5 stars
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CharacterVoiceBinding {
  id: string;
  characterId: string;
  voiceProfileId: string;

  // 自定义参数覆盖
  customParameters?: {
    pitch?: number;
    rate?: number;
    volume?: number;
    style?: string;
  };

  // 情绪参数映射
  emotionMappings: Record<string, {
    pitch?: number;
    rate?: number;
    volume?: number;
    style?: string;
  }>;

  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**角色特征扩展**
```typescript
interface CharacterProfile {
  id: string;
  bookId: string;
  canonicalName: string;
  aliases: string[];

  // 角色特征
  characteristics: {
    gender: 'male' | 'female' | 'unknown';
    ageRange: 'young' | 'adult' | 'middle_aged' | 'elderly' | 'unknown';
    personality: string[];
    speechStyle: 'formal' | 'casual' | 'elegant' | 'rough' | 'playful' | 'serious';
    socialClass?: 'noble' | 'common' | 'merchant' | 'scholar' | 'unknown';
    occupation?: string;
  };

  // 声线偏好
  voicePreferences: {
    preferredGender?: 'male' | 'female' | 'any';
    preferredAgeRange?: string;
    preferredStyles?: string[];
    avoidStyles?: string[];
  };

  // 当前绑定
  currentVoiceBinding?: CharacterVoiceBinding;

  // 情绪特征
  emotionProfile: {
    baseEmotion: string;
    emotionVariability: 'low' | 'medium' | 'high';
    commonEmotions: string[];
  };

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 智能声线推荐系统

**声线匹配算法**
```typescript
interface VoiceMatchingService {
  // 计算角色与声线的匹配度
  calculateMatchScore(character: CharacterProfile, voice: TTSVoiceProfile): number;

  // 为角色推荐声线
  recommendVoices(character: CharacterProfile, allVoices: TTSVoiceProfile[]): TTSVoiceProfile[];

  // 批量为多个角色推荐声线（避免声线冲突）
  recommendVoiceAssignments(characters: CharacterProfile[], voices: TTSVoiceProfile[]): Map<string, TTSVoiceProfile>;
}

class VoiceMatchingServiceImpl implements VoiceMatchingService {
  calculateMatchScore(character: CharacterProfile, voice: TTSVoiceProfile): number {
    let score = 0;
    let maxScore = 0;

    // 性别匹配 (权重: 30%)
    if (character.characteristics.gender !== 'unknown' && voice.characteristics.gender !== 'neutral') {
      maxScore += 30;
      if (character.characteristics.gender === voice.characteristics.gender) {
        score += 30;
      }
    }

    // 年龄匹配 (权重: 25%)
    if (character.characteristics.ageRange !== 'unknown') {
      maxScore += 25;
      if (character.characteristics.ageRange === voice.characteristics.ageRange) {
        score += 25;
      } else if (this.isAdjacentAgeRange(character.characteristics.ageRange, voice.characteristics.ageRange)) {
        score += 15; // 部分匹配
      }
    }

    // 风格匹配 (权重: 20%)
    const matchingStyles = voice.characteristics.style.filter(style =>
      character.characteristics.speechStyle === style ||
      character.voicePreferences.preferredStyles?.includes(style)
    );
    if (matchingStyles.length > 0) {
      maxScore += 20;
      score += Math.min(20, matchingStyles.length * 10);
    }

    // 避免不匹配的风格 (权重: 15%)
    const conflictingStyles = voice.characteristics.style.filter(style =>
      character.voicePreferences.avoidStyles?.includes(style)
    );
    if (conflictingStyles.length === 0) {
      maxScore += 15;
      score += 15;
    } else {
      maxScore += 15;
      score -= conflictingStyles.length * 5; // 扣分
    }

    // 使用率和评分 (权重: 10%)
    maxScore += 10;
    score += Math.min(10, voice.rating * 2); // 评分1-5转换为2-10分

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  recommendVoices(character: CharacterProfile, allVoices: TTSVoiceProfile[]): TTSVoiceProfile[] {
    return allVoices
      .filter(voice => voice.isAvailable)
      .map(voice => ({
        voice,
        score: this.calculateMatchScore(character, voice)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // 返回前10个最佳匹配
      .map(item => item.voice);
  }

  recommendVoiceAssignments(characters: CharacterProfile[], voices: TTSVoiceProfile[]): Map<string, TTSVoiceProfile> {
    const assignments = new Map<string, TTSVoiceProfile>();
    const usedVoices = new Set<string>();

    // 按角色重要性排序（主要角色优先）
    const sortedCharacters = characters.sort((a, b) => {
      const aImportance = this.calculateCharacterImportance(a);
      const bImportance = this.calculateCharacterImportance(b);
      return bImportance - aImportance;
    });

    for (const character of sortedCharacters) {
      const availableVoices = voices.filter(voice =>
        voice.isAvailable && !usedVoices.has(voice.id)
      );

      if (availableVoices.length === 0) {
        // 如果没有可用声线，允许重复使用
        const bestVoice = this.recommendVoices(character, voices)[0];
        if (bestVoice) {
          assignments.set(character.id, bestVoice);
        }
      } else {
        const bestVoice = this.recommendVoices(character, availableVoices)[0];
        if (bestVoice) {
          assignments.set(character.id, bestVoice);
          usedVoices.add(bestVoice.id);
        }
      }
    }

    return assignments;
  }

  private isAdjacentAgeRange(range1: string, range2: string): boolean {
    const ageOrder = ['young', 'adult', 'middle_aged', 'elderly'];
    const index1 = ageOrder.indexOf(range1);
    const index2 = ageOrder.indexOf(range2);
    return Math.abs(index1 - index2) === 1;
  }

  private calculateCharacterImportance(character: CharacterProfile): number {
    // 基于角色别名数量、性格复杂度等计算重要性
    let importance = character.aliases.length * 10;
    importance += character.characteristics.personality.length * 5;
    importance += character.emotionProfile.emotionVariability === 'high' ? 20 : 10;
    return importance;
  }
}
```

### 声线预览系统

**预览音频生成**
```typescript
interface VoicePreviewService {
  generatePreview(voiceProfileId: string, text?: string): Promise<VoicePreview>;
  getPreviewUrl(voiceProfileId: string): string;
  cachePreview(voiceProfileId: string, audioBuffer: Buffer): Promise<void>;
}

interface VoicePreview {
  voiceProfileId: string;
  audioUrl: string;
  duration: number;
  sampleText: string;
  generatedAt: Date;
}

class VoicePreviewServiceImpl implements VoicePreviewService {
  private ttsService: TTSService;
  private cache: Redis;

  constructor(ttsService: TTSService, redis: Redis) {
    this.ttsService = ttsService;
    this.cache = redis;
  }

  async generatePreview(voiceProfileId: string, customText?: string): Promise<VoicePreview> {
    // 检查缓存
    const cacheKey = `voice_preview:${voiceProfileId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached && !customText) {
      return JSON.parse(cached);
    }

    const voiceProfile = await this.getVoiceProfile(voiceProfileId);
    if (!voiceProfile) {
      throw new Error(`Voice profile not found: ${voiceProfileId}`);
    }

    // 选择合适的预览文本
    const sampleText = customText || this.selectOptimalPreviewText(voiceProfile);

    // 生成音频
    const audioBuffer = await this.ttsService.synthesize(
      sampleText,
      voiceProfile.voiceId,
      voiceProfile.provider,
      voiceProfile.defaultParameters
    );

    // 上传到存储
    const audioUrl = await this.uploadPreviewAudio(voiceProfileId, audioBuffer);

    const preview: VoicePreview = {
      voiceProfileId,
      audioUrl,
      duration: this.calculateAudioDuration(audioBuffer),
      sampleText,
      generatedAt: new Date()
    };

    // 缓存结果（24小时）
    if (!customText) {
      await this.cache.setex(cacheKey, 86400, JSON.stringify(preview));
    }

    return preview;
  }

  private selectOptimalPreviewText(voiceProfile: TTSVoiceProfile): string {
    const texts = [
      "你好，我是这个故事的叙述者。",
      "今天天气真好，适合讲故事。",
      "在这个充满魔法的世界里，一切皆有可能。",
      "月光洒在古老的城堡上，显得格外神秘。",
      "年轻人，你要记住这个重要的教训。"
    ];

    // 根据声线特征选择最合适的文本
    if (voiceProfile.characteristics.gender === 'female') {
      if (voiceProfile.characteristics.ageRange === 'young') {
        return texts[2]; // 魔法相关
      } else if (voiceProfile.characteristics.ageRange === 'elderly') {
        return texts[4]; // 教导语气
      }
    }

    if (voiceProfile.characteristics.gender === 'male') {
      if (voiceProfile.characteristics.ageRange === 'elderly') {
        return texts[4];
      }
    }

    return texts[0]; // 默认介绍文本
  }

  private async uploadPreviewAudio(voiceProfileId: string, audioBuffer: Buffer): Promise<string> {
    // 实现音频文件上传到云存储
    const filename = `voice_previews/${voiceProfileId}/${Date.now()}.mp3`;
    // 这里应该调用具体的存储服务
    return `https://your-storage.com/${filename}`;
  }

  private calculateAudioDuration(buffer: Buffer): number {
    // 实现音频时长计算
    return buffer.length / 16000; // 简化计算
  }
}
```

### 角色声线绑定界面

**声线选择组件**
```typescript
// src/components/VoiceAssignment.tsx
interface VoiceAssignmentProps {
  characters: CharacterProfile[];
  voiceProfiles: TTSVoiceProfile[];
  onBindingChange: (characterId: string, voiceProfileId: string, customParams?: any) => void;
  onPreviewVoice: (voiceProfileId: string, text: string) => Promise<void>;
}

export function VoiceAssignment({ characters, voiceProfiles, onBindingChange, onPreviewVoice }: VoiceAssignmentProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [recommendedVoices, setRecommendedVoices] = useState<Map<string, TTSVoiceProfile[]>>(new Map());
  const [previewText, setPreviewText] = useState("你好，很高兴认识你。");

  useEffect(() => {
    // 自动为所有角色推荐声线
    const matchingService = new VoiceMatchingServiceImpl();
    const recommendations = new Map<string, TTSVoiceProfile[]>();

    characters.forEach(character => {
      const recommendations = matchingService.recommendVoices(character, voiceProfiles);
      recommendations.set(character.id, recommendations);
    });

    setRecommendedVoices(recommendations);
  }, [characters, voiceProfiles]);

  const handleAutoAssign = () => {
    const matchingService = new VoiceMatchingServiceImpl();
    const assignments = matchingService.recommendVoiceAssignments(characters, voiceProfiles);

    assignments.forEach((voice, characterId) => {
      onBindingChange(characterId, voice.id);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">角色声线绑定</h3>
        <button
          onClick={handleAutoAssign}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          智能分配
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 角色列表 */}
        <div className="space-y-4">
          <h4 className="font-medium">角色列表</h4>
          {characters.map(character => (
            <div
              key={character.id}
              className={`p-4 border rounded cursor-pointer transition-colors ${
                selectedCharacter === character.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => setSelectedCharacter(character.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-medium">{character.canonicalName}</h5>
                  <p className="text-sm text-gray-600">
                    {character.characteristics.gender === 'unknown' ? '性别未知' :
                     character.characteristics.gender === 'male' ? '男' : '女'} ·
                    {character.characteristics.ageRange === 'unknown' ? '年龄未知' :
                     character.characteristics.ageRange === 'young' ? '年轻' :
                     character.characteristics.ageRange === 'adult' ? '成年' :
                     character.characteristics.ageRange === 'middle_aged' ? '中年' : '老年'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {character.characteristics.personality.slice(0, 3).map(trait => (
                      <span key={trait} className="px-2 py-1 bg-gray-100 text-xs rounded">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
                {character.currentVoiceBinding && (
                  <div className="text-sm text-green-600">
                    已绑定: {character.currentVoiceBinding.voiceProfile?.displayName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 声线选择 */}
        {selectedCharacter && (
          <div className="space-y-4">
            <h4 className="font-medium">可选声线</h4>

            {/* 预览文本输入 */}
            <div className="p-4 bg-gray-50 rounded">
              <label className="block text-sm font-medium mb-2">预览文本</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="输入要试听的文本"
                />
              </div>
            </div>

            {/* 推荐声线 */}
            <div className="space-y-3">
              {recommendedVoices.get(selectedCharacter)?.map(voice => (
                <div key={voice.id} className="p-4 border rounded hover:border-blue-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium">{voice.displayName}</h5>
                      <p className="text-sm text-gray-600">{voice.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-blue-100 rounded">
                          {voice.characteristics.gender === 'male' ? '男' :
                           voice.characteristics.gender === 'female' ? '女' : '中性'}
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-100 rounded">
                          {voice.characteristics.ageRange === 'young' ? '年轻' :
                           voice.characteristics.ageRange === 'adult' ? '成年' :
                           voice.characteristics.ageRange === 'middle_aged' ? '中年' : '老年'}
                        </span>
                        <div className="flex items-center">
                          <span className="text-yellow-500">★</span>
                          <span className="text-xs ml-1">{voice.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onPreviewVoice(voice.id, previewText)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      试听
                    </button>
                  </div>

                  {/* 声线特征标签 */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {voice.characteristics.style.map(style => (
                      <span key={style} className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {style}
                      </span>
                    ))}
                  </div>

                  {/* 参数调节 */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-12">音调:</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        defaultValue={voice.defaultParameters.pitch}
                        className="flex-1"
                      />
                      <span className="text-sm w-12">{voice.defaultParameters.pitch.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-12">语速:</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        defaultValue={voice.defaultParameters.rate}
                        className="flex-1"
                      />
                      <span className="text-sm w-12">{voice.defaultParameters.rate.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-12">音量:</label>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.1"
                        defaultValue={voice.defaultParameters.volume}
                        className="flex-1"
                      />
                      <span className="text-sm w-12">{voice.defaultParameters.volume.toFixed(1)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onBindingChange(selectedCharacter, voice.id)}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    绑定此声线
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 声线管理API

**声线管理路由**
```typescript
// src/app/api/tts/voices/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const gender = searchParams.get('gender');
    const ageRange = searchParams.get('ageRange');
    const language = searchParams.get('language');

    const voices = await prisma.tTSVoiceProfile.findMany({
      where: {
        isAvailable: true,
        ...(provider && { provider }),
        ...(gender && { characteristics: { path: ['gender'], equals: gender } }),
        ...(ageRange && { characteristics: { path: ['ageRange'], equals: ageRange } }),
        ...(language && { characteristics: { path: ['language'], equals: language } })
      },
      orderBy: [
        { rating: 'desc' },
        { usageCount: 'desc' }
      ]
    });

    return NextResponse.json(voices);
  } catch (error) {
    return handleAPIError(error, request);
  }
}

// src/app/api/tts/voices/[voiceId]/preview/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { voiceId: string } }
) {
  try {
    const { text } = await request.json();

    const previewService = new VoicePreviewServiceImpl();
    const preview = await previewService.generatePreview(params.voiceId, text);

    return NextResponse.json(preview);
  } catch (error) {
    return handleAPIError(error, request);
  }
}

// src/app/api/books/[id]/voice-bindings/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bindings = await prisma.characterVoiceBinding.findMany({
      where: { character: { bookId: params.id } },
      include: {
        character: true,
        voiceProfile: true
      }
    });

    return NextResponse.json(bindings);
  } catch (error) {
    return handleAPIError(error, request);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { characterId, voiceProfileId, customParameters, emotionMappings } = await request.json();

    const binding = await prisma.characterVoiceBinding.create({
      data: {
        characterId,
        voiceProfileId,
        customParameters,
        emotionMappings,
        isDefault: true
      },
      include: {
        character: true,
        voiceProfile: true
      }
    });

    return NextResponse.json(binding);
  } catch (error) {
    return handleAPIError(error, request);
  }
}

// src/app/api/books/[id]/voice-bindings/auto-assign/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const characters = await prisma.characterProfile.findMany({
      where: { bookId: params.id, isActive: true }
    });

    const voices = await prisma.tTSVoiceProfile.findMany({
      where: { isAvailable: true }
    });

    const matchingService = new VoiceMatchingServiceImpl();
    const assignments = matchingService.recommendVoiceAssignments(characters, voices);

    const bindings = [];
    for (const [characterId, voiceProfile] of assignments.entries()) {
      const binding = await prisma.characterVoiceBinding.create({
        data: {
          characterId,
          voiceProfileId: voiceProfile.id,
          isDefault: true
        },
        include: {
          character: true,
          voiceProfile: true
        }
      });
      bindings.push(binding);
    }

    return NextResponse.json({
      success: true,
      bindings,
      message: `成功为 ${bindings.length} 个角色分配声线`
    });
  } catch (error) {
    return handleAPIError(error, request);
  }
}
```

## 组件设计

### 前端组件架构

```mermaid
graph TB
    A[AppLayout] --> B[FileUploadComponent]
    A --> C[TextEditorComponent]
    A --> D[CharacterManagerComponent]
    A --> E[AudioPlayerComponent]
    A --> F[ProgressTrackerComponent]

    C --> G[SegmentViewer]
    C --> H[ScriptViewer]

    D --> I[CharacterList]
    D --> J[CharacterMergeTool]

    E --> K[AudioControls]
    E --> L[TimelineView]

    F --> M[TaskQueueStatus]
    F --> N[DownloadManager]
```

### 核心组件接口

**文件上传组件**
```typescript
interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  maxSize: number; // 20MB
  acceptedTypes: string[];
  uploadProgress: number;
}

interface UploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  segments: TextSegment[];
}
```

**文本编辑器组件**
```typescript
interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
  segments: TextSegment[];
  onSegmentChange: (segments: TextSegment[]) => void;
  readonly?: boolean;
}

interface TextSegment {
  id: number;
  start: number;
  end: number;
  content: string;
  script: ScriptSentence[];
}
```

**角色管理组件**
```typescript
interface CharacterManagerProps {
  characters: Character[];
  onCharacterMerge: (sourceId: string, targetId: string) => void;
  onVoiceProfileUpdate: (characterId: string, profile: TTSProfile) => void;
}

interface Character {
  id: string;
  canonicalName: string;
  aliases: CharacterAlias[];
  genderHint: 'male' | 'female' | 'unknown';
  ageHint: number;
  emotionBaseline: string;
  ttsProfile: TTSProfile;
  isActive: boolean;
}
```

## 数据模型

### 数据库设计

**核心表结构**

```sql
-- 书籍表
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    original_filename VARCHAR(255),
    file_size BIGINT,
    total_segments INTEGER DEFAULT 0,
    total_characters INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 角色特征表（扩展版）
CREATE TABLE character_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,

    -- 角色特征
    characteristics JSONB NOT NULL DEFAULT '{}', -- 存储性别、年龄、性格等信息

    -- 声线偏好
    voice_preferences JSONB DEFAULT '{}',

    -- 情绪特征
    emotion_profile JSONB DEFAULT '{}',

    -- 基础信息
    gender_hint VARCHAR(20) DEFAULT 'unknown',
    age_hint INTEGER,
    emotion_baseline VARCHAR(50) DEFAULT 'neutral',

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 别名表
CREATE TABLE character_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES character_profiles(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.8,
    source_sentence TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TTS声线配置表（扩展版）
CREATE TABLE tts_voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL, -- 'azure', 'openai', 'edge-tts', 'xtts'
    voice_id VARCHAR(255) NOT NULL,
    voice_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- 声线特征
    characteristics JSONB NOT NULL DEFAULT '{}', -- 性别、年龄、语言、风格等

    -- 默认音频参数
    default_parameters JSONB DEFAULT '{"pitch": 1.0, "rate": 1.0, "volume": 1.0}',

    -- 预览音频
    preview_audio JSONB, -- url, duration, sampleText

    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 3.0, -- 1-5 stars

    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 角色声线绑定表
CREATE TABLE character_voice_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES character_profiles(id) ON DELETE CASCADE,
    voice_profile_id UUID REFERENCES tts_voice_profiles(id) ON DELETE CASCADE,

    -- 自定义参数覆盖
    custom_parameters JSONB, -- pitch, rate, volume, style

    -- 情绪参数映射
    emotion_mappings JSONB DEFAULT '{}', -- 情绪到参数的映射

    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(character_id, voice_profile_id)
);

-- 文本分段表
CREATE TABLE text_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed
    created_at TIMESTAMP DEFAULT NOW()
);

-- 台本句子表
CREATE TABLE script_sentences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES text_segments(id) ON DELETE CASCADE,
    character_id UUID REFERENCES character_profiles(id),

    raw_speaker VARCHAR(255), -- 模型识别的原始说话人
    text TEXT NOT NULL,
    order_in_segment INTEGER,

    -- 台本生成信息
    tone VARCHAR(100),
    strength INTEGER CHECK (strength >= 0 AND strength <= 100),
    pause_after DECIMAL(3,1) DEFAULT 0.0,

    -- TTS参数（生成时使用）
    tts_parameters JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- 音频文件表
CREATE TABLE audio_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    sentence_id UUID REFERENCES script_sentences(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES text_segments(id) ON DELETE CASCADE,

    file_path VARCHAR(500),
    file_name VARCHAR(255),
    duration DECIMAL(5,2),
    file_size BIGINT,
    format VARCHAR(10), -- 'mp3', 'wav'

    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    provider VARCHAR(100), -- 使用的TTS提供商
    voice_profile_id UUID REFERENCES tts_voice_profiles(id),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 角色合并审计表
CREATE TABLE character_merge_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    source_character_id UUID REFERENCES character_profiles(id),
    target_character_id UUID REFERENCES character_profiles(id),
    merge_reason TEXT,
    merged_by VARCHAR(255), -- 'system' or user_id
    created_at TIMESTAMP DEFAULT NOW()
);

-- 任务队列表
CREATE TABLE processing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    task_type VARCHAR(100) NOT NULL, -- 'text_processing', 'script_generation', 'audio_render'
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,

    task_data JSONB DEFAULT '{}', -- 任务参数和状态
    error_message TEXT,

    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_character_profiles_book_id ON character_profiles(book_id);
CREATE INDEX idx_character_profiles_active ON character_profiles(book_id, is_active);
CREATE INDEX idx_character_aliases_character_id ON character_aliases(character_id);
CREATE INDEX idx_character_aliases_alias ON character_aliases(alias);
CREATE INDEX idx_tts_voice_profiles_provider ON tts_voice_profiles(provider);
CREATE INDEX idx_tts_voice_profiles_available ON tts_voice_profiles(is_available);
CREATE INDEX idx_character_voice_bindings_character_id ON character_voice_bindings(character_id);
CREATE INDEX idx_text_segments_book_id ON text_segments(book_id);
CREATE INDEX idx_script_sentences_segment_id ON script_sentences(segment_id);
CREATE INDEX idx_script_sentences_character_id ON script_sentences(character_id);
CREATE INDEX idx_audio_files_book_id ON audio_files(book_id);
CREATE INDEX idx_audio_files_status ON audio_files(status);
CREATE INDEX idx_processing_tasks_book_id ON processing_tasks(book_id);
CREATE INDEX idx_processing_tasks_status ON processing_tasks(status);
```

### TypeScript 类型定义

```typescript
// 核心数据类型
export interface Book {
  id: string;
  title: string;
  author?: string;
  originalFilename: string;
  fileSize: number;
  totalSegments: number;
  totalCharacters: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Character {
  id: string;
  bookId: string;
  canonicalName: string;
  genderHint: 'male' | 'female' | 'unknown';
  ageHint?: number;
  emotionBaseline: string;
  ttsProfileId?: string;
  isActive: boolean;
  aliases: CharacterAlias[];
  createdAt: Date;
}

export interface CharacterAlias {
  id: string;
  characterId: string;
  alias: string;
  confidence: number;
  sourceSentence?: string;
  createdAt: Date;
}

export interface TTSProfile {
  id: string;
  vendor: 'azure' | 'openai' | 'edge-tts';
  voiceName: string;
  pitch: number;
  rate: number;
  style?: string;
  createdAt: Date;
}

export interface ScriptSentence {
  id: string;
  bookId: string;
  segmentId: number;
  rawSpeaker?: string;
  characterId?: string;
  text: string;
  tone?: string;
  strength: number;
  pauseAfter: number;
  orderInSegment: number;
  createdAt: Date;
}

export interface TextSegment {
  id: number;
  start: number;
  end: number;
  content: string;
  script: ScriptSentence[];
}

export interface AudioFile {
  id: string;
  bookId: string;
  sentenceId?: string;
  filePath: string;
  duration: number;
  fileSize: number;
  format: 'mp3' | 'wav';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}
```

## API 设计

### Next.js API Routes + Hono 实现

**API路由结构**
```
src/app/api/
├── books/
│   ├── route.ts              # GET /api/books
│   ├── [id]/
│   │   ├── route.ts          # GET /api/books/[id]
│   │   ├── upload/
│   │   │   └── route.ts      # POST /api/books/[id]/upload
│   │   ├── segments/
│   │   │   └── route.ts      # GET /api/books/[id]/segments
│   │   ├── script/
│   │   │   └── route.ts      # GET /api/books/[id]/script
│   │   ├── characters/
│   │   │   ├── route.ts      # GET /api/books/[id]/characters
│   │   │   └── merge/
│   │   │       └── route.ts  # POST /api/books/[id]/characters/merge
│   │   ├── render/
│   │   │   ├── route.ts      # POST /api/books/[id]/render
│   │   │   └── progress/
│   │   │       └── route.ts  # GET /api/books/[id]/render/progress
│   │   └── download/
│   │       └── route.ts      # GET /api/books/[id]/download
├── script-agent/
│   └── route.ts              # POST /api/script-agent
└── tts/
    ├── providers/
    │   └── route.ts          # GET /api/tts/providers
    └── synthesize/
        └── route.ts          # POST /api/tts/synthesize
```

**Hono中间件配置**
```typescript
// src/lib/hono.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { errorHandler } from './error-handler';
import { rateLimiter } from './rate-limiter';

export const app = new Hono();

// 全局中间件
app.use('*', cors());
app.use('*', logger());
app.use('*', auth);
app.use('*', rateLimiter());
app.use('*', errorHandler);

// API路由
app.route('/api/books', booksRoutes);
app.route('/api/script-agent', scriptAgentRoutes);
app.route('/api/tts', ttsRoutes);
```

**文件上传与处理API**
```typescript
// src/app/api/books/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { HonoRequest } from 'hono';
import { prisma } from '@/lib/prisma';
import { FileUploadService } from '@/services/file-upload';
import { TextProcessingService } from '@/services/text-processing';

export async function GET(request: NextRequest) {
  const books = await prisma.book.findMany({
    include: {
      characters: {
        where: { isActive: true }
      },
      _count: {
        select: { segments: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(books);
}

// src/app/api/books/[id]/upload/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 文件大小和格式验证
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 20MB limit' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Only .txt and .md files are supported' },
        { status: 400 }
      );
    }

    // 处理文件上传
    const uploadService = new FileUploadService();
    const bookId = params.id;
    const result = await uploadService.processFile(file, bookId);

    // 异步启动文本处理
    const textService = new TextProcessingService();
    textService.processTextAsync(bookId, result.filePath);

    return NextResponse.json({
      success: true,
      bookId,
      message: 'File uploaded successfully, processing started'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**台本生成Agent API**
```typescript
// src/app/api/script-agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ScriptGenerationAgent } from '@/services/script-generation-agent';
import { Redis } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const { segmentId, bookId, options } = await request.json();

    if (!segmentId || !bookId) {
      return NextResponse.json(
        { error: 'Missing required parameters: segmentId, bookId' },
        { status: 400 }
      );
    }

    // 检查是否已在处理中
    const redis = new Redis();
    const processingKey = `script:processing:${bookId}:${segmentId}`;
    const isProcessing = await redis.get(processingKey);

    if (isProcessing) {
      return NextResponse.json(
        { error: 'Script generation already in progress' },
        { status: 409 }
      );
    }

    // 标记为处理中
    await redis.setex(processingKey, 600, 'processing'); // 10分钟超时

    // 启动异步台本生成
    const agent = new ScriptGenerationAgent();
    agent.generateScriptAsync(segmentId, bookId, options)
      .catch(error => {
        console.error('Script generation failed:', error);
        redis.del(processingKey);
      })
      .finally(() => {
        redis.del(processingKey);
      });

    return NextResponse.json({
      success: true,
      message: 'Script generation started',
      segmentId,
      bookId
    });

  } catch (error) {
    console.error('Script agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 批量台本生成
export async function PUT(request: NextRequest) {
  try {
    const { bookId, segmentIds, options } = await request.json();

    if (!bookId || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const agent = new ScriptGenerationAgent();
    const taskId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 启动批量处理
    agent.generateBatchAsync(segmentIds, bookId, options, taskId);

    return NextResponse.json({
      success: true,
      taskId,
      segmentCount: segmentIds.length,
      message: 'Batch script generation started'
    });

  } catch (error) {
    console.error('Batch script agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**文本处理**
```typescript
// src/app/api/books/[id]/segments/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const segments = await prisma.textSegment.findMany({
    where: { bookId: params.id },
    include: {
      scriptSentences: {
        include: {
          character: true,
          audioFile: true
        },
        orderBy: { orderInSegment: 'asc' }
      }
    },
    orderBy: { id: 'asc' }
  });

  return NextResponse.json(segments);
}

// src/app/api/books/[id]/script/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const script = await prisma.scriptSentence.findMany({
    where: { bookId: params.id },
    include: {
      character: true,
      audioFile: true,
      segment: {
        select: { id: true, content: true }
      }
    },
    orderBy: [
      { segmentId: 'asc' },
      { orderInSegment: 'asc' }
    ]
  });

  return NextResponse.json(script);
}

// src/app/api/books/[id]/reparse/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { force } = await request.json();

    const textService = new TextProcessingService();
    const taskId = await textService.reparseText(params.id, force);

    return NextResponse.json({
      success: true,
      taskId,
      message: force ? 'Text reparse started (forced)' : 'Text reparse started'
    });

  } catch (error) {
    console.error('Reparse error:', error);
    return NextResponse.json(
      { error: 'Failed to start text reparse' },
      { status: 500 }
    );
  }
}
```

**角色管理**
```typescript
// src/app/api/books/[id]/characters/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const characters = await prisma.character.findMany({
    where: {
      bookId: params.id,
      isActive: true
    },
    include: {
      aliases: true,
      ttsProfile: true,
      _count: {
        select: { scriptSentences: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json(characters);
}

// src/app/api/books/[id]/characters/merge/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { sourceId, targetId, reason } = await request.json();

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'Source and target character IDs are required' },
        { status: 400 }
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: 'Source and target characters cannot be the same' },
        { status: 400 }
      );
    }

    const mergeService = new CharacterMergeService();
    const result = await mergeService.mergeCharacters(
      params.id,
      sourceId,
      targetId,
      reason || 'Manual merge'
    );

    return NextResponse.json({
      success: true,
      mergedCharacter: result.targetCharacter,
      sentencesUpdated: result.sentencesUpdated,
      aliasesMerged: result.aliasesMerged
    });

  } catch (error) {
    console.error('Character merge error:', error);
    return NextResponse.json(
      { error: 'Failed to merge characters' },
      { status: 500 }
    );
  }
}

// src/app/api/books/[id]/characters/[characterId]/voice-profile/route.ts
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; characterId: string } }
) {
  try {
    const ttsProfile = await request.json();

    const updatedCharacter = await prisma.character.update({
      where: {
        id: params.characterId,
        bookId: params.id
      },
      data: {
        ttsProfile: {
          upsert: {
            create: ttsProfile,
            update: ttsProfile
          }
        }
      },
      include: {
        ttsProfile: true,
        aliases: true
      }
    });

    return NextResponse.json(updatedCharacter);

  } catch (error) {
    console.error('Voice profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update voice profile' },
      { status: 500 }
    );
  }
}
```

**音频生成**
```typescript
// src/app/api/books/[id]/render/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { segmentIds, voiceOverrides, options } = await request.json();

    const renderService = new AudioRenderService();
    const taskId = await renderService.startRender(
      params.id,
      segmentIds,
      voiceOverrides,
      options
    );

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Audio rendering started'
    });

  } catch (error) {
    console.error('Render start error:', error);
    return NextResponse.json(
      { error: 'Failed to start audio rendering' },
      { status: 500 }
    );
  }
}

// src/app/api/books/[id]/render/progress/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    );
  }

  const renderService = new AudioRenderService();
  const progress = await renderService.getRenderProgress(taskId);

  return NextResponse.json(progress);
}

// src/app/api/books/[id]/audio-files/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get('segmentId');
  const status = searchParams.get('status') as AudioStatus | null;

  const where: any = { bookId: params.id };
  if (segmentId) where.segmentId = parseInt(segmentId);
  if (status) where.status = status;

  const audioFiles = await prisma.audioFile.findMany({
    where,
    include: {
      scriptSentence: {
        include: {
          character: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json(audioFiles);
}

// src/app/api/books/[id]/download/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'zip';
    const includeSubtitles = searchParams.get('subtitles') === 'true';

    const downloadService = new DownloadService();
    const archiveBuffer = await downloadService.createDownloadPackage(
      params.id,
      format,
      includeSubtitles
    );

    const book = await prisma.book.findUnique({
      where: { id: params.id },
      select: { title: true }
    });

    const filename = `${book?.title || 'audiobook'}_${Date.now()}.${format}`;

    return new NextResponse(archiveBuffer, {
      headers: {
        'Content-Type': format === 'zip' ? 'application/zip' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to create download package' },
      { status: 500 }
    );
  }
}
```

**TTS服务API**
```typescript
// src/app/api/tts/providers/route.ts
export async function GET() {
  const providers = [
    {
      id: 'azure',
      name: 'Azure Speech',
      voices: await getAzureVoices(),
      features: ['SSML', 'neural', 'custom']
    },
    {
      id: 'openai',
      name: 'OpenAI TTS',
      voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      features: ['hd', 'multiple_languages']
    },
    {
      id: 'edge-tts',
      name: 'Edge TTS',
      voices: await getEdgeVoices(),
      features: ['free', 'browser_native']
    }
  ];

  return NextResponse.json(providers);
}

// src/app/api/tts/synthesize/route.ts
export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, provider, options } = await request.json();

    const ttsService = new TTSService();
    const audioBuffer = await ttsService.synthesize(
      text,
      voiceId,
      provider,
      options
    );

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('TTS synthesis error:', error);
    return NextResponse.json(
      { error: 'Failed to synthesize speech' },
      { status: 500 }
    );
  }
}
```

## 错误处理

### 错误分类与处理策略

**文件处理错误**
```typescript
class FileProcessingError extends Error {
  constructor(
    message: string,
    public code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'CORRUPTED_FILE',
    public details?: any
  ) {
    super(message);
  }
}

// 处理策略
const fileErrorHandlers = {
  FILE_TOO_LARGE: () => '文件大小超过20MB限制',
  INVALID_FORMAT: () => '不支持的文件格式，请上传.txt或.md文件',
  CORRUPTED_FILE: () => '文件损坏或无法读取，请检查文件完整性'
};
```

**TTS服务错误**
```typescript
class TTSError extends Error {
  constructor(
    message: string,
    public code: 'TTS_SERVICE_DOWN' | 'QUOTA_EXCEEDED' | 'VOICE_NOT_SUPPORTED',
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// 自动重试机制
const ttsRetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,
  retryableErrors: ['TTS_SERVICE_DOWN', 'NETWORK_ERROR']
};
```

**数据库错误**
```typescript
class DatabaseError extends Error {
  constructor(
    message: string,
    public code: 'CONNECTION_FAILED' | 'CONSTRAINT_VIOLATION' | 'QUERY_TIMEOUT',
    public query?: string
  ) {
    super(message);
  }
}
```

### Next.js 错误处理

**API错误处理器**
```typescript
// src/lib/error-handler.ts
import { NextRequest, NextResponse } from 'next/server';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class FileProcessingError extends APIError {
  constructor(
    message: string,
    public code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'CORRUPTED_FILE',
    details?: any
  ) {
    super(message, 400, code, details);
  }
}

export class TTSError extends APIError {
  constructor(
    message: string,
    public code: 'TTS_SERVICE_DOWN' | 'QUOTA_EXCEEDED' | 'VOICE_NOT_SUPPORTED',
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message, retryable ? 503 : 502, code);
  }
}

// 全局错误处理中间件
export function handleAPIError(error: unknown, request?: NextRequest): NextResponse {
  const logger = console; // 在实际项目中使用更完善的日志系统

  if (error instanceof FileProcessingError) {
    logger.warn('File processing error', {
      error: error.message,
      code: error.code,
      url: request?.url
    });
    return NextResponse.json({
      error: {
        message: getFileErrorMessage(error.code),
        code: error.code,
        details: error.details
      }
    }, { status: error.statusCode });
  }

  if (error instanceof TTSError) {
    logger.error('TTS service error', {
      error: error.message,
      provider: error.provider,
      retryable: error.retryable
    });

    return NextResponse.json({
      error: {
        message: error.retryable
          ? 'TTS服务暂时不可用，已加入重试队列'
          : 'TTS服务错误',
        code: error.code,
        provider: error.provider,
        retryable: error.retryable
      }
    }, { status: error.statusCode });
  }

  if (error instanceof APIError) {
    logger.error('API error', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
    return NextResponse.json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    }, { status: error.statusCode });
  }

  // 默认服务器错误
  logger.error('Unexpected error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: request?.url
  });

  return NextResponse.json({
    error: {
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    }
  }, { status: 500 });
}

function getFileErrorMessage(code: string): string {
  const messages = {
    'FILE_TOO_LARGE': '文件大小超过20MB限制',
    'INVALID_FORMAT': '不支持的文件格式，请上传.txt或.md文件',
    'CORRUPTED_FILE': '文件损坏或无法读取，请检查文件完整性'
  };
  return messages[code as keyof typeof messages] || '文件处理错误';
}

// API路由包装器
export function withErrorHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return handleAPIError(error, request);
    }
  };
}
```

**Next.js App Router错误页面**
```typescript
// src/app/error.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // 记录错误到监控服务
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          应用程序错误
        </h2>
        <p className="text-gray-600 mb-4">
          抱歉，应用程序遇到了一个错误。请稍后再试。
        </p>
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors"
          >
            返回首页
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-4 bg-gray-100 rounded">
            <summary className="cursor-pointer font-semibold">错误详情</summary>
            <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-4">页面未找到</p>
        <a
          href="/"
          className="bg-blue-500 text-white py-2 px-6 rounded hover:bg-blue-600 transition-colors"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
```

**任务队列错误处理**
```typescript
// src/lib/queue-error-handler.ts
import { Queue, Job } from 'bull';
import { ScriptGenerationAgent } from './script-generation-agent';
import { logger } from './logger';

export class QueueErrorHandler {
  constructor(private queue: Queue) {
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    // 处理任务失败
    this.queue.on('failed', async (job: Job, err: Error) => {
      const { bookId, segmentId, type } = job.data;

      logger.error('Queue job failed', {
        jobId: job.id,
        type,
        bookId,
        segmentId,
        error: err.message,
        stack: err.stack
      });

      // 根据错误类型决定是否重试
      if (this.isRetryableError(err)) {
        const delay = this.calculateRetryDelay(job.attemptsMade);
        await job.moveToDelayed(Date.now() + delay);
        logger.info(`Job ${job.id} scheduled for retry`, { delay });
      } else {
        // 标记为永久失败，通知用户
        await this.handlePermanentFailure(job, err);
      }
    });

    // 处理任务完成
    this.queue.on('completed', (job: Job, result: any) => {
      logger.info('Queue job completed', {
        jobId: job.id,
        type: job.data.type,
        bookId: job.data.bookId,
        segmentId: job.data.segmentId
      });
    });

    // 处理任务停滞
    this.queue.on('stalled', (job: Job) => {
      logger.warn('Queue job stalled', {
        jobId: job.id,
        type: job.data.type,
        bookId: job.data.bookId
      });
    });
  }

  private isRetryableError(error: Error): boolean {
    // 可重试的错误类型
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'TTS_SERVICE_DOWN',
      'NETWORK_ERROR',
      'LLM_RATE_LIMIT'
    ];

    return retryableErrors.some(code =>
      error.message.includes(code) ||
      (error as any).code === code
    );
  }

  private calculateRetryDelay(attemptsMade: number): number {
    // 指数退避策略
    const baseDelay = 1000; // 1秒
    const maxDelay = 300000; // 5分钟
    const delay = Math.min(baseDelay * Math.pow(2, attemptsMade), maxDelay);

    // 添加随机抖动
    return delay + Math.random() * 1000;
  }

  private async handlePermanentFailure(job: Job, error: Error) {
    const { bookId, segmentId, type } = job.data;

    // 更新数据库状态
    if (type === 'script_generation') {
      await this.markScriptGenerationFailed(bookId, segmentId, error);
    } else if (type === 'audio_render') {
      await this.markAudioRenderFailed(bookId, segmentId, error);
    }

    // 发送通知（在实际项目中可以是邮件、WebSocket等）
    await this.notifyUserOfFailure(bookId, error);
  }

  private async markScriptGenerationFailed(bookId: string, segmentId: string, error: Error) {
    // 实现标记台本生成失败的逻辑
    logger.error('Script generation permanently failed', {
      bookId,
      segmentId,
      error: error.message
    });
  }

  private async markAudioRenderFailed(bookId: string, segmentId: string, error: Error) {
    // 实现标记音频渲染失败的逻辑
    logger.error('Audio render permanently failed', {
      bookId,
      segmentId,
      error: error.message
    });
  }

  private async notifyUserOfFailure(bookId: string, error: Error) {
    // 实现用户通知逻辑
    logger.info('User notified of failure', { bookId, error: error.message });
  }
}
```

## 测试策略

### 测试层次结构

**单元测试 (Jest + Testing Library)**
- 组件渲染测试
- 业务逻辑函数测试
- API路由处理函数测试
- 数据库模型验证测试

**集成测试**
- API端到端测试
- 数据库操作测试
- 文件上传处理测试
- TTS服务集成测试

**端到端测试 (Playwright)**
- 完整工作流程测试
- 多浏览器兼容性测试
- 大文件处理性能测试
- 用户体验流程测试

### 关键测试用例

**文件上传与处理**
```typescript
describe('File Upload', () => {
  test('should accept valid TXT file under 20MB', async () => {
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const result = await uploadFile(mockFile);
    expect(result.success).toBe(true);
    expect(result.bookId).toBeDefined();
  });

  test('should reject file larger than 20MB', async () => {
    const largeFile = new File(['x'.repeat(21 * 1024 * 1024)], 'large.txt');
    await expect(uploadFile(largeFile)).rejects.toThrow('FILE_TOO_LARGE');
  });

  test('should detect and clean text formatting', async () => {
    const dirtyText = "  \n\n  Chapter 1\n\n  \"Hello,\" she said.  \n\n  ";
    const cleaned = await cleanText(dirtyText);
    expect(cleaned).toBe('Chapter 1\n"Hello," she said.');
  });
});
```

**角色识别与合并**
```typescript
describe('Character Recognition', () => {
  test('should identify character names from dialogue', async () => {
    const text = '林黛玉说道："宝玉，你来了。"宝玉微笑道："是的，我来了。"';
    const characters = await extractCharacters(text);
    expect(characters).toContain('林黛玉');
    expect(characters).toContain('宝玉');
  });

  test('should merge character aliases correctly', async () => {
    const aliases = ['林黛玉', '黛玉', '林姑娘'];
    const merged = await mergeCharacterAliases(aliases);
    expect(merged.canonicalName).toBe('林黛玉');
    expect(merged.aliases).toContain('黛玉');
  });
});
```

**音频生成**
```typescript
describe('Audio Generation', () => {
  test('should generate audio for single sentence', async () => {
    const sentence: ScriptSentence = {
      text: '你好，世界！',
      characterId: 'narrator',
      tone: 'neutral',
      strength: 50,
      pauseAfter: 0.5
    };

    const audioFile = await generateAudio(sentence, 'azure-tts');
    expect(audioFile.duration).toBeGreaterThan(0);
    expect(audioFile.format).toBe('mp3');
  });

  test('should handle TTS service failure gracefully', async () => {
    jest.spyOn(ttsService, 'synthesize').mockRejectedValue(new Error('Service down'));

    const sentence: ScriptSentence = { text: 'test', characterId: 'test', tone: 'neutral', strength: 50, pauseAfter: 0 };
    await expect(generateAudio(sentence, 'azure-tts')).rejects.toThrow('TTS_SERVICE_DOWN');
  });
});
```

**性能测试**
```typescript
describe('Performance Tests', () => {
  test('should handle large file processing within time limit', async () => {
    const largeText = 'x'.repeat(1000000); // 1MB text
    const startTime = Date.now();

    await processText(largeText);

    const processingTime = Date.now() - startTime;
    expect(processingTime).toBeLessThan(30000); // 30 seconds max
  });

  test('should not exceed memory limits during processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    await processLargeBatch(sentences);

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // 500MB max
  });
});
```

### 测试环境配置

**测试数据库**
```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

// tests/setup.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

beforeAll(async () => {
  // 创建测试数据库
  execSync('createdb txt2audio_test', { stdio: 'ignore' });

  // 运行迁移
  execSync('npx prisma migrate deploy --preview-feature', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  execSync('dropdb txt2audio_test', { stdio: 'ignore' });
});

beforeEach(async () => {
  // 清理测试数据
  await prisma.audioFile.deleteMany();
  await prisma.scriptSentence.deleteMany();
  await prisma.characterAlias.deleteMany();
  await prisma.character.deleteMany();
  await prisma.book.deleteMany();
});
```

## 部署架构

### 容器化部署

**Docker Compose 配置**
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/txt2audio
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./audio:/app/audio

  worker:
    build: .
    command: npm run worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/txt2audio
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./audio:/app/audio

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=txt2audio
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web

volumes:
  postgres_data:
  redis_data:
```

### 监控与日志

**应用监控**
```typescript
// monitoring.ts
import { createPrometheusMetrics } from 'prom-client';

const metrics = createPrometheusMetrics({
  httpRequestsTotal: 'counter',
  httpRequestDuration: 'histogram',
  ttsProcessingTime: 'histogram',
  fileProcessingTime: 'histogram',
  activeJobs: 'gauge'
});

// 集成到Express应用
app.use(metrics.middleware);
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});
```

**健康检查端点**
```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      tts: await checkTTSServices(),
      storage: await checkStorage()
    }
  };

  const allHealthy = Object.values(health.services).every(s => s.status === 'ok');
  res.status(allHealthy ? 200 : 503).json(health);
});
```

这个设计文档涵盖了系统的完整架构、数据模型、API设计、错误处理和测试策略。系统采用现代化的技术栈，支持高并发处理和水平扩展，能够满足大规模文本转有声书的需求。