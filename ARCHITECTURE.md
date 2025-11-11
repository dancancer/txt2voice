# Text to Voice - 项目架构文档

## 项目概述

Text to Voice 是一个基于 Next.js 16 的智能文本转语音平台，采用 **monorepo** 架构组织代码。项目支持上传书籍文件，自动识别角色，生成台本，并通过 TTS 服务将文本转换为自然流畅的语音。

### Monorepo 结构

```
txt2voice/
├── apps/
│   ├── web/                        # Next.js Web 应用
│   └── character-recognition/      # Python 人物识别服务 (FastAPI)
├── packages/                       # 共享包（未来扩展）
├── docs/                          # 文档目录
├── scripts/                       # 工具脚本
└── docker-compose.yml             # Docker 编排配置
```

## 技术栈

### 前端技术
- **框架**: Next.js 16.0.1 (App Router)
- **语言**: TypeScript 5.9.3
- **UI 框架**: React 19.2.0
- **样式**: Tailwind CSS 4.1.17
- **UI 组件**: Radix UI (Dialog, Dropdown Menu, Select, Tabs, Toast)
- **图标**: Lucide React
- **状态管理**: Zustand 5.0.8
- **工具库**: 
  - clsx - 条件类名组合
  - class-variance-authority - 组件变体管理
  - tailwind-merge - Tailwind 类名合并

### 后端技术
- **API 框架**: Next.js API Routes + Hono 4.10.4
- **数据库**: PostgreSQL (通过 Prisma)
- **ORM**: Prisma 6.19.0
- **任务队列**: Bull 4.16.5 + Redis (IORedis 5.8.2)
- **文件处理**: Formidable 3.5.4, Multer 2.0.2
- **压缩**: JSZip 3.10.1
- **验证**: Zod 4.1.12

### AI 服务
- **LLM 服务**: OpenAI SDK 6.8.1 (支持 OpenAI, DeepSeek 等兼容 API)
- **TTS 服务**: 多提供商支持架构

### Python 服务 (character-recognition)
- **框架**: FastAPI
- **NLP 库**: HanLP (人名识别)
- **向量模型**: Text2Vec (语义聚类)
- **容器**: Docker
- **端口**: 8001

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (apps/web - Next.js)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  页面组件     │  │  UI 组件库   │  │  状态管理     │      │
│  │  (App Router)│  │  (Radix UI)  │  │  (Zustand)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/API
┌─────────────────────────────────────────────────────────────┐
│                 API 层 (apps/web - API Routes)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Books API   │  │  TTS API     │  │  Characters  │      │
│  │  /api/books  │  │  /api/tts    │  │  API         │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  业务逻辑层 (apps/web - Services)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Text         │  │ LLM          │  │ Script       │      │
│  │ Processor    │  │ Service      │  │ Generator    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Audio        │  │ TTS          │  │ Task         │      │
│  │ Generator    │  │ Service      │  │ Manager      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (Prisma ORM)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │  Redis       │  │  File System │      │
│  │  (主数据库)   │  │  (任务队列)   │  │  (文件存储)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      外部服务层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  LLM API     │  │  TTS API     │  │  Python 服务  │      │
│  │ (OpenAI/     │  │ (多提供商)    │  │ (FastAPI)    │      │
│  │  DeepSeek)   │  │              │  │ :8001        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                       │ - 人物识别    │      │
│                                       │ - 别名识别    │      │
│                                       │ - 关系抽取    │      │
│                                       └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 文本处理模块 (Text Processor)

**文件**: `apps/web/src/lib/text-processor.ts`

**功能**:
- 文件编码检测 (UTF-8, UTF-16LE, Latin1)
- 文本清洗和格式化
- 智能文本分段 (按段落、长度)
- 字数统计 (支持中英文混合)
- 段落类型识别 (章节、场景、对话、普通段落)

**核心接口**:
```typescript
interface ProcessedText {
  content: string
  wordCount: number
  characterCount: number
  encoding: string
  detectedFormat: 'txt' | 'md'
}

interface TextSegmentData {
  order: number
  content: string
  wordCount: number
  type: 'paragraph' | 'dialogue' | 'scene' | 'chapter'
  metadata?: Record<string, any>
}
```

**处理流程**:
1. 检测文件编码
2. 解码并清洗文本
3. 智能分段 (默认最大 1000 字，最小 50 字)
4. 识别段落类型
5. 生成数据库记录

### 2. LLM 服务模块 (LLM Service)

**文件**: `apps/web/src/lib/llm-service.ts`

**功能**:
- 统一的 LLM API 调用接口
- 支持多种 LLM 提供商 (OpenAI, DeepSeek 等)
- 角色识别和分析
- 情感分析
- 对话识别和分配

**核心接口**:
```typescript
interface CharacterInfo {
  name: string
  aliases: string[]
  description: string
  age?: number
  gender: 'male' | 'female' | 'unknown'
  personality: string[]
  relationships: Record<string, string>
  dialogueStyle: string
  emotionalTone: string[]
  frequency: number
  importance: 'main' | 'secondary' | 'minor'
}

interface ScriptAnalysisResult {
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
```

**特性**:
- 自动分块处理长文本 (最大 8000 字符)
- 角色信息合并和去重
- 错误处理和重试机制
- 支持自定义 baseURL

### 3. 台本生成模块 (Script Generator)

**文件**: `apps/web/src/lib/script-generator.ts`

**功能**:
- 自动识别角色
- 对话分配
- 情感分析
- 台词生成
- JSON 格式修复

**核心接口**:
```typescript
interface DialogueLine {
  id: string
  characterName: string
  text: string
  emotion: string
  context: string
  segmentId: string
  orderInSegment: number
  isNarration: boolean
  metadata?: Record<string, any>
}

interface GeneratedScript {
  dialogueLines: DialogueLine[]
  summary: {
    totalLines: number
    dialogueCount: number
    narrationCount: number
    characterDistribution: Record<string, number>
    emotionDistribution: Record<string, number>
  }
  segments: Array<{
    segmentId: string
    lineCount: number
    characters: string[]
  }>
}
```

**处理流程**:
1. 检查并识别角色 (如无角色则自动识别)
2. 构建角色映射表 (包含别名)
3. 逐段处理文本
4. 调用 LLM 生成台词
5. JSON 格式修复 (本地修复 → LLM 修复)
6. 实时写入数据库
7. 生成统计信息

**特殊功能**:
- 三级 JSON 修复机制
- 角色别名自动映射
- 默认角色创建 (旁白、男主角、女主角)
- 增量生成支持

### 4. 音频生成模块 (Audio Generator)

**文件**: `apps/web/src/lib/audio-generator.ts`

**功能**:
- 单个台词音频生成
- 批量音频生成
- 整本书音频生成
- 失败音频重新生成

**核心接口**:
```typescript
interface AudioGenerationRequest {
  scriptSentenceId: string
  voiceProfileId?: string
  overrides?: {
    speed?: number
    pitch?: number
    volume?: number
    emotion?: string
    style?: string
  }
  outputFormat?: 'mp3' | 'wav' | 'ogg'
}

interface AudioGenerationResult {
  success: boolean
  audioFileId?: string
  duration?: number
  fileSize?: number
  error?: string
  metadata?: Record<string, any>
}
```

**处理流程**:
1. 获取台词和角色信息
2. 检查是否已存在音频 (可选)
3. 确定声音配置 (角色绑定或指定)
4. 构建 TTS 请求
5. 调用 TTS 服务
6. 保存音频文件
7. 创建数据库记录

**特性**:
- 批量处理 (默认每批 5 个)
- 跳过已存在的音频
- 自动重试机制
- 音频时长估算

### 5. TTS 服务模块 (TTS Service)

**文件**: `apps/web/src/lib/tts-service.ts`

**功能**:
- 多 TTS 提供商管理
- 统一的 TTS 调用接口
- 声音配置管理
- 错误处理

**架构**:
```typescript
interface TTSProvider {
  name: string
  synthesize(request: TTSRequest): Promise<TTSResponse>
  getVoices(): Promise<TTSVoice[]>
  getVoice(voiceId: string): Promise<TTSVoice | null>
}

class TTSServiceManager {
  private providers: Map<string, TTSProvider>
  
  registerProvider(name: string, provider: TTSProvider): void
  synthesize(request: TTSRequest, providerName?: string): Promise<TTSResponse>
  getVoices(providerName?: string): Promise<TTSVoice[]>
}
```

### 6. 任务管理模块 (Task Manager)

**文件**: `apps/web/src/lib/processing-task-utils.ts`

**功能**:
- 任务创建和更新
- 进度跟踪
- 状态管理
- 错误记录

**任务类型**:
- `text_processing` - 文本处理
- `character_analysis` - 角色分析
- `script_generation` - 台本生成
- `audio_generation` - 音频生成

## 数据库设计

### 核心数据表

#### Book (书籍)
```prisma
model Book {
  id                String
  title             String
  author            String?
  originalFilename  String?
  uploadedFilePath  String?
  fileSize          BigInt?
  totalWords        Int?
  totalCharacters   Int
  totalSegments     Int
  encoding          String?
  fileFormat        String?
  status            String  // uploaded, processing, processed, script_generated, audio_generated
  metadata          Json
  createdAt         DateTime
  updatedAt         DateTime
}
```

#### TextSegment (文本段落)
```prisma
model TextSegment {
  id              String
  bookId          String
  segmentIndex    Int
  startPosition   Int
  endPosition     Int
  content         String
  wordCount       Int?
  segmentType     String?  // paragraph, dialogue, scene, chapter
  orderIndex      Int
  metadata        Json?
  status          String
}
```

#### CharacterProfile (角色配置)
```prisma
model CharacterProfile {
  id                String
  bookId            String
  canonicalName     String
  characteristics   Json    // description, personality, importance, relationships
  voicePreferences  Json    // dialogueStyle
  emotionProfile    Json
  genderHint        String  // male, female, unknown
  ageHint           Int?
  emotionBaseline   String
  isActive          Boolean
}
```

#### CharacterAlias (角色别名)
```prisma
model CharacterAlias {
  id             String
  characterId    String
  alias          String
  confidence     Decimal
  sourceSentence String?
}
```

#### ScriptSentence (台词)
```prisma
model ScriptSentence {
  id             String
  bookId         String
  segmentId      String
  characterId    String?
  rawSpeaker     String?
  text           String
  orderInSegment Int
  tone           String?
  strength       Int?
  pauseAfter     Decimal?
  ttsParameters  Json?
}
```

#### AudioFile (音频文件)
```prisma
model AudioFile {
  id             String
  bookId         String
  sentenceId     String?
  segmentId      String?
  filePath       String
  fileName       String?
  duration       Decimal?
  fileSize       BigInt?
  format         String?
  status         String  // pending, processing, completed, failed
  errorMessage   String?
  retryCount     Int
  provider       String?
  voiceProfileId String?
}
```

#### TTSVoiceProfile (TTS 声音配置)
```prisma
model TTSVoiceProfile {
  id                String
  provider          String
  voiceId           String
  voiceName         String
  displayName       String
  description       String?
  characteristics   Json
  defaultParameters Json
  previewAudio      Json?
  usageCount        Int
  rating            Decimal
  isAvailable       Boolean
}
```

#### ProcessingTask (处理任务)
```prisma
model ProcessingTask {
  id             String
  bookId         String
  taskType       String
  status         String  // pending, processing, completed, failed
  progress       Int
  totalItems     Int
  processedItems Int
  taskData       Json
  errorMessage   String?
  startedAt      DateTime?
  completedAt    DateTime?
}
```

## API 接口设计

### Books API

#### GET /api/books
获取书籍列表
- 查询参数: page, limit, status
- 返回: 书籍列表 + 分页信息

#### POST /api/books
创建新书籍
- 请求体: { title, author, originalFilename }
- 返回: 创建的书籍对象

#### GET /api/books/[id]
获取书籍详情
- 返回: 书籍详细信息 + 关联数据

#### POST /api/books/[id]/upload
上传书籍文件
- 请求: multipart/form-data
- 返回: 上传结果

#### POST /api/books/[id]/process
处理书籍文件
- 请求体: { maxSegmentLength, minSegmentLength, preserveFormatting }
- 返回: 处理结果

#### POST /api/books/[id]/characters/analyze
分析角色
- 返回: 识别的角色列表

#### GET /api/books/[id]/characters
获取角色列表
- 返回: 角色列表

#### POST /api/books/[id]/script/generate
生成台本
- 请求体: ScriptGenerationOptions
- 返回: 生成的台本

#### POST /api/books/[id]/audio/generate
生成音频
- 请求体: AudioGenerationOptions
- 返回: 生成结果

### TTS API

#### GET /api/tts/providers
获取 TTS 提供商列表

#### GET /api/tts/voices
获取可用声音列表
- 查询参数: provider

## 工作流程

### 完整的书籍处理流程

```
1. 上传书籍
   ↓
2. 创建书籍记录
   ↓
3. 上传文件到服务器
   ↓
4. 文本处理
   - 检测编码
   - 清洗文本
   - 智能分段
   - 保存段落
   ↓
5. 角色分析
   - 提取样本文本
   - LLM 识别角色
   - 创建角色配置
   - 生成别名
   ↓
6. 台本生成
   - 逐段处理文本
   - LLM 生成台词
   - 分配角色
   - 情感分析
   - 保存台词
   ↓
7. 声音配置
   - 为角色绑定声音
   - 设置语音参数
   ↓
8. 音频生成
   - 批量生成音频
   - 调用 TTS 服务
   - 保存音频文件
   - 更新进度
   ↓
9. 完成
```

## 前端架构

### 页面结构

```
apps/web/src/app/
├── page.tsx              # 首页 (书籍列表)
├── layout.tsx            # 根布局
├── globals.css           # 全局样式
└── books/
    └── [id]/
        ├── layout.tsx    # 书籍详情布局 (包含 BookNavigation)
        └── page.tsx      # 书籍详情页
```

### 组件结构

```
apps/web/src/components/
├── ui/                   # 基础 UI 组件
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── progress.tsx
├── Navigation.tsx        # 全局导航组件
├── BookNavigation.tsx    # 书籍导航组件
├── ErrorBoundary.tsx     # 错误边界组件
├── BookList.tsx          # 书籍列表组件
├── BookCard.tsx          # 书籍卡片组件
├── BookUpload.tsx        # 书籍上传组件
└── TextInput.tsx         # 文本输入组件
```

### 状态管理

使用 Zustand 进行全局状态管理:

```typescript
interface AppStore {
  books: Book[]
  currentBook: Book | null
  uploading: boolean
  error: string | null
  
  setBooks: (books: Book[]) => void
  addBook: (book: Book) => void
  setCurrentBook: (book: Book | null) => void
  setUploading: (uploading: boolean) => void
  setError: (error: string | null) => void
}
```

## 错误处理

### 错误类型

```typescript
class TTSError extends Error {
  code: string
  provider?: string
  retryable: boolean
}

class ValidationError extends Error {
  field: string
}

class FileProcessingError extends Error {
  code: string
  details?: any
}
```

### 错误处理策略

1. **API 层**: 统一错误处理中间件 (`withErrorHandler`)
2. **服务层**: 特定错误类型抛出
3. **前端**: 错误状态管理和用户提示
4. **重试机制**: 可重试错误自动重试

## 性能优化

### 后端优化
- 文本分块处理 (避免内存溢出)
- 批量数据库操作
- 任务队列异步处理
- Redis 缓存

### 前端优化
- Next.js App Router (服务端渲染)
- 组件懒加载
- 图片优化
- 代码分割

## 部署架构

### 环境变量

```env
# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# LLM 服务
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-3.5-turbo

# TTS 服务
TTS_PROVIDER=...
TTS_API_KEY=...
```

### 部署要求

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- 存储空间 (音频文件)

## 扩展性设计

### 插件化架构

1. **TTS 提供商**: 实现 `TTSProvider` 接口即可添加新提供商
2. **LLM 服务**: 支持任何 OpenAI 兼容的 API
3. **文件格式**: 扩展 `text-processor` 支持更多格式
4. **任务类型**: 添加新的 `ProcessingTask` 类型

### 水平扩展

- API 服务无状态，可水平扩展
- 任务队列支持多 worker
- 数据库读写分离
- 文件存储可迁移到对象存储 (S3, OSS)

## Python 人物识别服务 (character-recognition)

### 服务概述

独立的 FastAPI 服务，位于 `apps/character-recognition/`，提供高精度的中文小说人物识别能力。

### 核心功能

#### 1. 人名识别 (NER)
- **基础识别**: HanLP 预训练模型
- **规则补充**: 姓氏+名字模式 (2-4字中文名)
- **准确率**: 结合深度学习和规则的混合方法

#### 2. 别名识别与归一化
- **前缀识别**: 老张、小李、阿月
- **后缀识别**: 王叔、宝玉哥、大小姐
- **儿化音**: 月儿、旺财儿
- **语义聚类**: 基于 Text2Vec 句向量

#### 3. 指代消解
- **代词识别**: 他/她/他们/她们
- **启发式回指**: 最近出现 + 性别匹配
- **对话上下文优先**: 对话场景中优先考虑

#### 4. 对话归因
- **三种模式**: 直接引语、间接引语、对话标记
- **说话者标注**: 自动识别说话人
- **台词统计**: 统计每个角色的对话数量

#### 5. 关系抽取
- **共现关系**: 统计角色在相同场景中出现的频率
- **对话关系**: 分析角色之间的对话互动
- **权重计算**: 基于共现频率和对话次数

### 技术实现

**位置**: `apps/character-recognition/`

**主要文件**:
- `src/core/ner.py` - 人名识别核心
- `src/core/alias_merge.py` - 别名识别和归一化
- `src/core/coreference.py` - 指代消解
- `src/core/dialogue_attribution.py` - 对话归因
- `src/core/relation_extraction.py` - 关系抽取
- `main.py` - FastAPI 服务入口

**API 端点**:
```
POST /api/v1/recognize
  - 输入: 小说文本
  - 输出: 人物列表、别名、关系等完整信息
  
GET /health
  - 健康检查端点
```

**依赖**:
- HanLP 2.1+ (人名识别)
- Text2Vec (句向量模型)
- FastAPI (Web 框架)
- Pydantic (数据验证)

### Docker 部署

```yaml
# docker-compose.yml
character-recognition:
  build: ./apps/character-recognition
  ports:
    - "8001:8001"
  environment:
    - MODEL_PATH=/app/models
```

### 与 Web 应用集成

Web 应用可以通过 HTTP 调用 Python 服务：

```typescript
// apps/web/src/lib/character-recognition-client.ts
const response = await fetch('http://character-recognition:8001/api/v1/recognize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: novelText })
})
```

### 性能优化

- **模型缓存**: 预加载 HanLP 和 Text2Vec 模型
- **批处理**: 支持批量文本处理
- **异步处理**: FastAPI 异步 handler
- **轻量容器**: 基于 Python 3.11-slim 镜像

## 安全性

### 数据安全
- API Key 环境变量存储
- 文件上传大小限制 (20MB)
- 文件类型验证
- SQL 注入防护 (Prisma)

### 访问控制
- API 路由权限控制 (待实现)
- 用户认证 (待实现)
- 资源隔离

## 监控和日志

### 日志记录
- 控制台日志 (开发环境)
- 结构化日志 (生产环境)
- 错误追踪

### 监控指标

**Web 应用 (apps/web)**:
- API 响应时间
- 任务处理进度
- 错误率
- 资源使用情况
- LLM API 调用次数和延迟
- TTS API 调用次数和延迟

**Python 服务 (character-recognition)**:
- 服务健康状态
- 识别请求处理时间
- 模型推理性能
- 内存使用情况

## 未来规划

### 功能扩展
- [ ] 用户认证和授权
- [ ] 多用户支持
- [ ] 音频编辑功能
- [ ] 实时预览
- [ ] 批量导出
- [ ] 更多 TTS 提供商
- [ ] 声音克隆
- [ ] 情感微调

### 技术优化
- [ ] WebSocket 实时通信
- [ ] 流式音频生成
- [ ] 分布式任务处理
- [ ] CDN 加速
- [ ] 容器化部署
- [ ] 自动化测试

## 总结

Text to Voice 采用现代化的 **monorepo** 全栈架构：

- **前端**: Next.js 16 + React 19 + TypeScript (位于 `apps/web/`)
- **后端**: Next.js API Routes + Prisma + PostgreSQL
- **AI 服务**: 集成 LLM (OpenAI/DeepSeek) 和多提供商 TTS
- **Python 服务**: FastAPI + HanLP + Text2Vec (位于 `apps/character-recognition/`)

系统实现了从文本上传、角色识别、台本生成到音频合成的完整自动化工作流。设计注重模块化、可扩展性和性能优化，采用微服务架构，支持独立部署和水平扩展，为未来的功能扩展和规模化部署奠定了良好的基础。

---

## 文档更新日志

### 2024-11-11 - Monorepo 架构更新
- ✅ 添加 monorepo 结构说明
- ✅ 更新所有文件路径引用 (`src/` → `apps/web/src/`)
- ✅ 添加 Python 服务 (character-recognition) 完整说明
- ✅ 更新架构图，包含 Python 服务层
- ✅ 更新页面和组件结构说明
- ✅ 更新监控指标，包含 Python 服务
- ✅ 补充 Docker 部署和服务集成说明
