# CLAUDE.md

This repository hosts **txt2voice**, a Next.js-based text-to-audiobook system.

## Current reality

- Monorepo workspace root: `txt2voice/`
- Main app: `apps/web`
- Role recognition: **LLM-only** (Python `apps/character-recognition` removed)
- Infra: PostgreSQL + Redis + Next.js web service

## Primary workflows

1. Upload book text
2. Process text into chapters/segments
3. Extract characters via LLM
4. Generate script lines
5. Bind voices
6. Generate audio

## Key commands

```bash
pnpm install
pnpm --filter web dev
pnpm docker:services
pnpm docker:services:down
pnpm docker:up
pnpm docker:down
pnpm lint
pnpm typecheck
```

## Key files

- `apps/web/src/lib/text-processor.ts`
- `apps/web/src/lib/script-generator.ts`
- `apps/web/src/lib/audio-generator.ts`
- `apps/web/src/lib/llm-service.ts`
- `apps/web/prisma/schema.prisma`
