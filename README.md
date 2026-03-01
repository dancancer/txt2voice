# Text to Voice

Text to Voice 是一个基于 Next.js 的文本转有声书平台，支持从文本处理、角色抽取、台本生成到批量语音合成的完整链路。

## 核心能力

- 文本处理：编码检测、清洗、章节识别、段落切分
- 角色抽取：基于 LLM 的角色/别名/特征识别
- 台本生成：按段落生成台词、情绪、停顿等朗读参数
- 音频生成：按角色绑定声音并批量生成音频
- 章节管理：支持章节级状态追踪与音频产物管理

## 当前架构（2026-03）

项目已统一为 **LLM 角色识别方案**，不再依赖独立 Python `character-recognition` 服务。

```text
txt2voice/
├── apps/
│   └── web/                  # Next.js Web + API + Prisma
├── docs/                     # 技术与历史文档
├── docker-compose.yml        # 开发环境（web + postgres + redis）
├── docker-compose.prod.yml   # 生产环境（web + postgres + redis）
├── DEV_GUIDE.md              # 本地/容器开发指南
├── ARCHITECTURE.md           # 架构说明
└── AGENTS.md                 # Agent 工作流说明
```

## 快速开始

### 1) 本地开发（推荐）

```bash
pnpm install
cp .env.local.example apps/web/.env.local
pnpm docker:services
pnpm --filter web dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 2) Docker 一体化开发

```bash
cp .env.docker .env
pnpm docker:build
pnpm docker:up
```

- Web: [http://localhost:3001](http://localhost:3001)

## 常用命令

```bash
# monorepo
pnpm dev
pnpm build
pnpm lint
pnpm typecheck

# docker
pnpm docker:up
pnpm docker:down
pnpm docker:build
pnpm docker:logs
pnpm docker:services
pnpm docker:services:down
```

## 处理流程

1. 上传文本文件
2. 文本处理（章节与段落切分）
3. LLM 角色抽取
4. 台本生成（角色分配 + 情绪）
5. 配置角色声音
6. 批量生成音频

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEV_GUIDE.md](./DEV_GUIDE.md)
- [AGENTS.md](./AGENTS.md)
- [docs/README.md](./docs/README.md)

## 许可证

ISC
