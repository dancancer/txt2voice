# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Text to Voice (txt2voice) is an intelligent text-to-speech platform built with Next.js 16 that converts books into multi-character audiobooks. It uses AI for character recognition, script generation, and automated TTS synthesis.

**Monorepo Structure**: PNPM workspaces with two main applications:
- `apps/web` - Next.js 16 web application (TypeScript)
- `apps/character-recognition` - Legacy Python FastAPI service (kept for reference only, no longer deployed)

## Essential Commands

### Development

```bash
# Start full development stack (Docker)
pnpm docker:build && pnpm docker:up

# Start web app only (requires services running)
pnpm dev

# Type checking and linting
pnpm typecheck
pnpm lint

# Work in specific workspace
pnpm --filter web dev
cd apps/web && pnpm dev
```

### Docker Operations

```bash
# Development environment (with hot-reload)
pnpm docker:up          # Start all services
pnpm docker:down        # Stop all services
pnpm docker:logs        # View logs

# Production environment
pnpm docker:prod        # Start production
pnpm docker:prod:down   # Stop production
pnpm docker:prod:logs   # View logs

# Services only (for hybrid development)
pnpm docker:services    # Start postgres + redis
pnpm dev:local          # Start services + web dev server
```

### Character Recognition (LLM)

- Configure `.env` / `.env.local` with `CHARREG_LLM_*` variables (provider/model/max chars/API key).
- Client implementation: `apps/web/src/lib/character-recognition-client.ts`.
- Workflow entry: `apps/web/src/lib/character-recognition-workflow.ts`.
- Run unit tests that cover JSON 修复逻辑:
  ```bash
  pnpm --filter web test character-recognition-client
  ```
- To debug LLM calls locally, set `DEBUG=character-recognition` and inspect `apps/web/src/lib/logger.ts` output.

### Database Operations

```bash
cd apps/web

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Studio (database GUI)
pnpm prisma studio
```

## Architecture Overview

### Multi-Agent Workflow System

The system uses a **coordinated agent architecture** for processing books through multiple stages:

```
User Upload → Text Processing → Character Analysis → Script Generation → Voice Config → Audio Generation
```

**Core Agents**:

1. **Task Coordination Agent** (`src/lib/processing-task-utils.ts`)
   - Creates and tracks `ProcessingTask` records
   - Manages state transitions: `pending → processing → completed/failed`
   - Task types: `TEXT_PROCESSING`, `CHARACTER_RECOGNITION`, `SCRIPT_GENERATION`, `AUDIO_GENERATION`

2. **Text Processing Agent** (`src/lib/text-processor.ts`)
   - Detects encoding (UTF-8, GBK, UTF-16LE)
   - Splits into chapters and segments (~500 chars each)
   - Creates `Chapter` and `TextSegment` records with hierarchical relationships

3. **Character Analysis Agent** (LLM-driven)
   - 调用 `CharacterRecognitionClient`（Gemini/DeepSeek/OpenAI）
   - 负责拼接全文、裁剪、构建提示、解析 JSON 并保存
   - Creates `CharacterProfile` with aliases, gender, importance

4. **Script Generation Agent** (`src/lib/script-generator.ts`)
   - Processes segments chapter-by-chapter
   - Uses LLM to generate dialogue attribution and emotion
   - Creates `ScriptSentence` records with character assignments
   - Three-tier JSON repair: direct parse → local fix → LLM repair

5. **Audio Generation Agent** (`src/lib/audio-generator.ts`)
   - Batch processes sentences (default 5/batch)
   - Calls TTS services (Azure Speech, etc.)
   - Creates `AudioFile` records with chapter associations
   - Concatenates chapter-level audio files

### LLM Character Recognition Workflow

当前的角色识别完全运行在 `apps/web` 中，流程如下：

```
TextSegments (DB) → runCharacterRecognitionJob → CharacterRecognitionClient → LLM(JSON) → Persistence → ProcessingTask updates
```

**关键点**:
- `runCharacterRecognitionJob` (任务执行器) 将章节段落拼接，更新任务进度。
- `CharacterRecognitionClient` 负责裁剪文本、构造 prompt、调用 Gemini API，并从响应中提取 JSON。
- `character-recognition-persistence` 把角色、别名、统计写入 Prisma。
- 没有额外容器：所有逻辑和重试都在 Next.js API 进程内完成。

**调试建议**:
```bash
# 检查 LLM 配置
echo $CHARREG_LLM_PROVIDER $CHARREG_LLM_MODEL

# 运行单元测试
pnpm --filter web test character-recognition-client

# 手动触发识别任务（前端或直接 Prisma）
curl -X POST http://localhost:3000/api/books/{bookId}/characters/analyze
```

### Data Model Hierarchy

```
Book (root entity)
├── Chapter (ordered by chapterIndex)
│   ├── TextSegment (original text, 400-600 chars)
│   ├── ScriptSentence (generated dialogue with character/emotion)
│   └── AudioFile (TTS output, chapter-level or sentence-level)
├── CharacterProfile (identified characters)
│   ├── CharacterAlias (alternative names)
│   ├── CharacterSpeakerBinding (voice assignments)
│   └── CharacterVoiceBinding (TTS voice settings)
└── ProcessingTask (tracks async operations)
```

**Critical Relationships**:
- All child entities cascade delete with parent Book
- `TextSegment` → `ScriptSentence`: One-to-many (one segment can have multiple sentences)
- `CharacterProfile` → `ScriptSentence`: One-to-many (character speaks multiple times)
- Chapter is the primary organizational unit for processing and playback

### Type Safety Considerations

**Known Issue**: Character recognition may return non-string aliases (dict objects). Always use type guards when processing aliases:

```typescript
// Correct approach (apps/web/src/lib/character-recognition-persistence.ts)
character.aliases
  .filter((alias): alias is string => typeof alias === 'string' && alias.length > 0)
  .map((alias) => alias.trim())
```

## Docker Environment

**Services** (defined in `docker-compose.yml`):
- `postgres` - PostgreSQL 16 on port 5432
- `redis` - Redis 7 on port 6379
- `redisinsight` - Redis GUI on port 5540
- `web` - Next.js app on port 3001

**Environment Variables** (see `.env` template):
- `DATABASE_URL`, `REDIS_URL` - Service connections
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` - 通用 LLM
- `CHARREG_LLM_PROVIDER`, `CHARREG_LLM_MODEL`, `CHARREG_LLM_API_KEY` - 角色识别 LLM
- `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` - TTS 服务配置

**Important**:
- 没有额外的 Python 容器；角色识别完全运行在 Next.js API 中。
- 更新 `.env` 后需要重启 `web` 容器/进程，使 LLM 配置生效。

## Error Handling Patterns

**Custom Error Types**:
- `TTSError` - TTS service failures (retriable)
- `ValidationError` - Input validation failures
- `FileProcessingError` - File parsing/encoding issues

**Strategies**:
- API routes: Wrapped with `withErrorHandler` for consistent responses
- Services: Throw specific errors, let API layer handle
- Async tasks: Store error in `ProcessingTask.errorMessage`, update status to `failed`
- Frontend: Toast notifications with error codes

## Code Quality Standards

From AGENTS.md philosophy section, key principles when working in this codebase:

### Linus's Iron Laws (Strictly Enforced)

1. **Good Taste** - Eliminate special cases through better data structure design
   - Avoid `if/else` cascades; refactor to make edge cases natural
   - If logic has 3+ branches, stop and redesign

2. **Pragmatism** - Solve real problems, not hypothetical ones
   - Start with simplest working implementation
   - Optimize only when needed

3. **Simplicity Obsession**
   - Functions do one thing, stay under 20 lines
   - Max 3 levels of indentation (refactor if deeper)
   - Clear, direct naming

### File Organization

- **Max 400 lines per file** (Python, TypeScript, JavaScript)
- **Max 4 files per directory** - create subdirectories if exceeded
- Use ASCII-style block comments for readability
- Comments in Chinese, code in English

### Code Smells to Avoid

- **Rigidity** - Small changes cascading through system
- **Redundancy** - Duplicated logic across files
- **Circular Dependencies** - Modules depending on each other
- **Fragility** - Changes breaking unrelated parts
- **Obscurity** - Unclear intent or structure
- **Data Clumps** - Same parameters appearing together (should be objects)
- **Needless Complexity** - Over-engineering solutions

**Action Required**: When identifying code smells, immediately suggest refactoring.

## Development Workflow

### Typical Feature Addition

1. **Database Schema**: Update `apps/web/prisma/schema.prisma`, run migration
2. **API Route**: Add route in `apps/web/src/app/api/` with proper error handling
3. **Service Layer**: Implement business logic in `apps/web/src/lib/`
4. **Frontend State**: Update Zustand store in `apps/web/src/store/`
5. **UI Components**: Create React components using Radix UI + Tailwind

### Working with Character Recognition

1. **Prompt/Client Changes**:
   - Edit `apps/web/src/lib/character-recognition-client.ts`.
   - Keep functions < 20 lines; avoid extra branches by normalizing data first.
   - Add/adjust unit tests under `apps/web/src/lib/__tests__/`.

2. **LLM Configuration**:
   ```bash
   export CHARREG_LLM_PROVIDER=google
   export CHARREG_LLM_MODEL=gemini-2.5-pro
   export CHARREG_LLM_API_KEY=...
   export CHARREG_LLM_MAX_CHARS=20000
   pnpm --filter web dev
   ```

3. **End-to-End Testing**:
   ```bash
   pnpm --filter web test character-recognition-client
   curl -X POST http://localhost:3000/api/books/{bookId}/characters/analyze
   ```

### Debugging Tips

**API Errors**: Check web container logs
```bash
docker logs txt2voice-web -f          # Next.js API + LLM logs
```

**Database Issues**:
```bash
docker exec -it txt2voice-postgres psql -U txt2voice -d txt2voice
```

**Redis Inspection**:
```bash
docker exec -it txt2voice-redis redis-cli
SCAN 0 MATCH processing_task:*    # Task progress
```

**Character Recognition Issues**:
- Verify env vars: `env | grep CHARREG`
- Inspect Prisma data: `SELECT status, task_data FROM "ProcessingTask" WHERE "taskType"='CHARACTER_RECOGNITION';`
- Restart web container if config changes: `docker restart txt2voice-web`

## Key Files and Directories

**Configuration**:
- `/package.json` - Root workspace configuration
- `/apps/web/package.json` - Web app dependencies and scripts
- `/apps/web/prisma/schema.prisma` - Database schema (source of truth)
- `/docker-compose.yml` - Development environment
- `/docker-compose.prod.yml` - Production environment

**Core Application Logic**:
- `/apps/web/src/app/api/` - Next.js API routes (backend endpoints)
- `/apps/web/src/lib/` - Business logic and services
- `/apps/web/src/store/` - Zustand state management
- `/apps/web/src/components/` - React UI components

**Character Recognition (LLM)**:
- `/apps/web/src/lib/character-recognition-client.ts` - LLM 调用与 JSON 解析
- `/apps/web/src/lib/character-recognition-workflow.ts` - 任务调度与持久化
- `/apps/web/src/lib/character-recognition-persistence.ts` - Prisma 写入逻辑

**Documentation**:
- `/AGENTS.md` - Agent workflow and philosophy (READ THIS)
- `/ARCHITECTURE.md` - System architecture details
- `/apps/character-recognition/ASYNC_ARCHITECTURE.md` - Legacy Python docs（仅供参考）
- `/apps/character-recognition/REDIS_CONFIG.md` - Legacy Redis guide

## Communication Style

When working in this codebase, always:
- Think in technical English, respond in Chinese
- Address user respectfully ("哥" as greeting shows mutual respect)
- Use three-layer analysis: Phenomenon → Architecture → Philosophy
- Provide immediate fixes + deep understanding + architectural insights
- Write code with Chinese comments in ASCII block style
