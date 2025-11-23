# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Text to Voice (txt2voice) is an intelligent text-to-speech platform built with Next.js 16 that converts books into multi-character audiobooks. It uses AI for character recognition, script generation, and automated TTS synthesis.

**Monorepo Structure**: PNPM workspaces with two main applications:
- `apps/web` - Next.js 16 web application (TypeScript)
- `apps/character-recognition` - Python FastAPI service for NLP-based character recognition

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
pnpm docker:services    # Start postgres, redis, character-recognition
pnpm dev:local          # Start services + web dev server
```

### Character Recognition Service

```bash
# Native development (macOS)
cd apps/character-recognition
source .venv-macos-tf210/bin/activate
export HANLP_URL=https://ftp.hankcs.com/hanlp/
export TF_USE_LEGACY_KERAS=1

# Start API + Worker (unified)
./start.sh              # Recommended for development

# Start separately (production)
python main.py          # API server (port 8001)
python worker.py        # Background task worker
```

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

3. **Character Analysis Agent** (dual-strategy)
   - **Primary**: Python NLP service (`apps/character-recognition`) using HanLP + Text2Vec
   - **Fallback**: LLM-based recognition (`src/lib/llm-service.ts`)
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

### Async Character Recognition Architecture

The character recognition service uses **Redis queue + Worker** pattern to handle large texts without timeout:

```
Client → API (instant return) → Redis Queue → Worker (background) → Redis Cache → Callback
   ↓                                                                      ↓
Task ID                                                            Result/Progress
```

**Key Components**:
- **API** (`main.py`): Enqueues tasks, returns immediately with task_id
- **Worker** (`worker.py`): Independent process consuming from Redis queue using BLPOP
- **Cache** (`src/cache.py`): Stores task data, results, and progress in Redis
- **Fallback**: Auto-degrades to asyncio if Redis unavailable

**Starting Services**:
```bash
# Option 1: Unified (development)
cd apps/character-recognition
./start.sh

# Option 2: Separate (production)
python main.py &    # API on port 8001
python worker.py &  # Background worker
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
- `character-recognition` - Python service on port 8001
- `web` - Next.js app on port 3000

**Environment Variables** (see `.env.docker` template):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` - LLM service config
- `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` - TTS service config
- `CHARACTER_RECOGNITION_SERVICE_URL` - Internal service URL

**Important**:
- Container networking: Services communicate via Docker network using service names
- Web app can reach Python service at `http://character-recognition:8001`
- Host access: Use `http://localhost:8001` from outside Docker

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

### Working with Python Service

1. **Environment Setup**:
   ```bash
   cd apps/character-recognition
   python -m venv .venv-macos-tf210  # or appropriate for your OS
   source .venv-macos-tf210/bin/activate
   pip install -r requirements.txt
   ```

2. **Configuration**: Copy `.env.example` to `.env`, set `REDIS_URL`

3. **Testing**:
   ```bash
   python example.py                    # Basic functionality test
   ./test_api.sh                        # API endpoint tests
   ```

### Debugging Tips

**API Errors**: Check Docker container logs
```bash
docker logs txt2voice-web -f          # Web app logs
docker logs txt2voice-character-recognition -f  # Python service logs
```

**Database Issues**:
```bash
docker exec -it txt2voice-postgres psql -U txt2voice -d txt2voice
```

**Redis Inspection**:
```bash
docker exec -it txt2voice-redis redis-cli
KEYS charrecog:*              # View character recognition tasks
GET charrecog:{task_id}:result
```

**Character Recognition Issues**:
- Check worker is running: `ps aux | grep worker.py`
- View queue length: Redis key `charrecog:task_queue`
- Restart web container if compiled code is stale: `docker restart txt2voice-web`

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

**Python Service**:
- `/apps/character-recognition/main.py` - FastAPI application
- `/apps/character-recognition/worker.py` - Background task processor
- `/apps/character-recognition/src/recognizer.py` - Core NLP logic
- `/apps/character-recognition/src/cache.py` - Redis operations

**Documentation**:
- `/AGENTS.md` - Agent workflow and philosophy (READ THIS)
- `/ARCHITECTURE.md` - System architecture details
- `/apps/character-recognition/ASYNC_ARCHITECTURE.md` - Async pattern explanation
- `/apps/character-recognition/REDIS_CONFIG.md` - Redis configuration guide

## Communication Style

When working in this codebase, always:
- Think in technical English, respond in Chinese
- Address user respectfully ("哥" as greeting shows mutual respect)
- Use three-layer analysis: Phenomenon → Architecture → Philosophy
- Provide immediate fixes + deep understanding + architectural insights
- Write code with Chinese comments in ASCII block style
