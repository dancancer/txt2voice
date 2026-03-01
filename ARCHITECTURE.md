# Text to Voice 架构说明

## 1. 系统概览

Text to Voice 采用单体 Web 架构：

- **应用层**：`apps/web`（Next.js App Router）
- **数据层**：PostgreSQL + Prisma
- **任务/缓存层**：Redis（任务状态、队列辅助）
- **AI 层**：统一走 LLM（角色抽取 + 台本生成）
- **语音层**：TTS Provider（Azure / IndexTTS 等）

> 当前版本已移除独立 Python `character-recognition` 服务。

## 2. 目录与边界

```text
apps/web/src/
├── app/                 # 页面与 API Route
├── components/          # UI 组件
├── hooks/               # React Hooks
├── store/               # Zustand 状态管理
├── lib/                 # 核心业务服务层
└── generated/prisma/    # Prisma Client
```

核心边界约定：

- `app/api/**`：请求编排、参数校验、响应结构
- `lib/**`：可复用业务逻辑（文本、角色、台本、音频）
- `prisma`：数据模型与持久化

## 3. 核心业务链路

### 3.1 文本处理

入口：`POST /api/books/[id]/process`

- 读取上传文件
- 编码检测与文本清洗
- 章节识别与段落切分
- 写入 `Chapter` 与 `TextSegment`
- 更新 `Book` 统计字段与状态

关键实现：

- `apps/web/src/lib/text-processor.ts`
- `apps/web/src/app/api/books/[id]/process/route.ts`

### 3.2 角色抽取（LLM）

角色抽取已经并入台本生成流程，统一由 LLM 完成：

- 根据段落内容识别角色、别名、特征
- 归一化并写入 `CharacterProfile` / `CharacterAlias`

关键实现：

- `apps/web/src/lib/script-generator.ts`
- `apps/web/src/lib/llm-service.ts`

### 3.3 台本生成

入口：`POST /api/books/[id]/script/generate`

- 按段落生成 `ScriptSentence`
- 识别说话人、情绪、强度、停顿
- 任务进度写入 `ProcessingTask`
- 支持全量、增量、局部重生成功能

关键实现：

- `apps/web/src/app/api/books/[id]/script/generate/route.ts`
- `apps/web/src/lib/script-generator.ts`
- `apps/web/src/lib/processing-task-utils.ts`

### 3.4 音频生成

入口：`POST /api/books/[id]/audio/generate`

- 读取台词并选择角色声音
- 调用 TTS 生成单句音频
- 写入 `AudioFile` 并更新状态
- 支持章节级合并

关键实现：

- `apps/web/src/lib/audio-generator.ts`
- `apps/web/src/lib/tts-service.ts`
- `apps/web/src/app/api/books/[id]/audio/generate/route.ts`

## 4. 状态模型

### 4.1 书籍状态（Book.status）

典型流转：

`uploaded -> processing -> processed -> generating_script -> script_generated -> generating_audio -> completed`

### 4.2 任务状态（ProcessingTask.status）

`pending -> processing -> completed | failed`

任务类型主要包括：

- `TEXT_PROCESSING`
- `SCRIPT_GENERATION`
- `AUDIO_GENERATION`

## 5. 错误与可观测性

- API 层统一通过 `withErrorHandler` 处理
- 业务层抛出 `ValidationError` / `TTSError` 等标准异常
- 任务进度与失败信息持久化到 `ProcessingTask`

关键实现：

- `apps/web/src/lib/error-handler.ts`
- `apps/web/src/lib/logger.ts`

## 6. 部署拓扑

### 开发环境 `docker-compose.yml`

- `web`（Next.js 开发模式）
- `postgres`
- `redis`
- 可选 `pgadmin`、`redisinsight`

### 生产环境 `docker-compose.prod.yml`

- `web`（Next.js 生产镜像）
- `postgres`
- `redis`

## 7. 设计决策（当前）

1. **单体化优先**：将角色抽取统一到 LLM 业务链，减少跨服务复杂度。
2. **任务化执行**：长链路通过 `ProcessingTask` 做进度与失败管理。
3. **章节粒度管理**：文本、台本、音频都带 `chapterId`，便于局部重跑。
4. **API 与服务解耦**：路由只负责编排，核心逻辑沉淀在 `lib/`。
