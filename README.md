# txt2voice

txt2voice 是一个面向长文本生产场景的 LLM 驱动有声书平台。系统把“原始文本 -> 章节/段落 -> 台本 -> 多引擎音频 -> 质检复核 -> 合并交付”拆成可观测、可重试、可局部重跑的生产流水线。

## 当前版本重点（2026-03-29）

- 单体 Web 应用承载 UI、API、任务编排、队列 Worker 与 Prisma 数据访问
- 台本生产已经接入文件化 Agent Runtime，定义层位于 `agents/`、`skills/`、`workflows/`
- 音频链路统一收口到远端 `Qwen3 Voice` 服务
- 提供 Fast Gate + Deep Gate 质检、人工复核工作台、任务中心和 SLO/派单监控
- 既支持手动分步处理，也支持一键 `Auto Pipeline`

## 核心业务链路

1. 上传 `.txt` / `.md` 书稿
2. 执行文本处理：编码检测、清洗、章节识别、段落切分
3. 执行台本生产：角色发现、分段生成、修复、质量判断、持久化
4. 配置角色、Speaker 与 Voice 绑定
5. 生成音频：父任务编排 + 单句合成子任务 + 章节/整书合并
6. 执行质量闭环：音频质检、人工复核、重生、最终组装
7. 在播放页、章节页和任务中心查看结果与进度

## 仓库结构

```text
txt2voice/
├── apps/web/                 # Next.js 16 Web、App Router API、Prisma schema
├── agents/                   # 文件化 Agent 定义
├── skills/                   # 运行时 Skill 定义
├── workflows/                # 运行时 Workflow 定义
├── docs/                     # 业务、专题、计划、评审与历史文档
├── ops/remote-tts-stack/     # 远端 TTS 服务部署说明
├── docker-compose.yml        # 开发环境（web + postgres + redis + 管理工具）
├── docker-compose.prod.yml   # 生产环境
├── DEV_GUIDE.md              # 本地 / 容器开发指南
├── ARCHITECTURE.md           # 技术架构文档
└── AGENTS.md                 # Agent 协作说明
```

## 技术栈

- 前端与 API：Next.js 16、React 19、App Router
- 数据层：PostgreSQL、Prisma 6
- 异步任务：Redis、Bull
- LLM：OpenAI SDK 兼容接入，当前常用配置为 `DeepSeek` 风格网关
- TTS：Qwen3 Voice
- UI：Tailwind CSS 4、Radix UI、Zustand、Sonner

## 快速开始

### 方式一：本地开发（推荐）

前置条件：

- Node.js `>= 18`
- pnpm `>= 8`
- Docker / Docker Compose

```bash
pnpm install
cp .env.local.example .env.local
pnpm docker:services
pnpm --filter web dev
```

访问地址：

- Web: [http://localhost:3000](http://localhost:3000)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 方式二：Docker 一体化开发

```bash
cp .env.docker .env
pnpm docker:build
pnpm docker:up
```

访问地址：

- Web: [http://localhost:3001](http://localhost:3001)
- pgAdmin: [http://localhost:5050](http://localhost:5050)
- RedisInsight: [http://localhost:18002](http://localhost:18002)

## 关键环境变量

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串，Bull 队列依赖它启动 |
| `LLM_DEFAULT_MODEL_ID` / `LLM_MODELS_JSON` | 可选的环境变量配置；数据库里没有持久化模型时才会使用 |
| `TASK_QUEUE_NAMESPACE` | 队列命名空间，用于多实例隔离 |
| `QWEN3VOICE_API_URL` | Qwen3 Voice 服务地址 |
| `UPLOAD_DIR` / `AUDIO_DIR` | 上传文件与音频产物落盘目录 |

如果本地 `3000` 与 Docker `3001` 会同时运行，请为两个实例配置不同的 `TASK_QUEUE_NAMESPACE`，例如：

- 本地：`txt2voice:3000`
- Docker：`txt2voice:3001`

LLM 配置说明：

- 主入口是产品内设置页 `/settings/llm`，配置会落库持久化
- 高级台本工作台会优先读取数据库里已配置的模型列表
- `LLM_DEFAULT_MODEL_ID` + `LLM_MODELS_JSON` 只作为“数据库为空时”的配置来源
- 当前远端 `http://192.168.88.9:8028/v1/models` 实际返回的模型名是 `Qwen3.5-9B-GGUF-Q4_K_M`
- 如果后续把远端服务切成 4B，只需要改配置里的 `model`，不需要改代码

## 常用命令

```bash
# 开发
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm qc
pnpm qc:quick

# Docker
pnpm docker:services
pnpm docker:services:down
pnpm docker:up
pnpm docker:down
pnpm docker:logs
pnpm docker:web:health

# 远端发布
pnpm deploy:remote:web
```

## 主要页面与工作台

- `/`：书籍管理与上传
- `/books/[id]`：书籍详情、章节入口、流程总览
- `/books/[id]/studio/script`：高级台本工作台
- `/books/[id]/characters`：角色管理与 Speaker 绑定
- `/books/[id]/studio/audio`：高级音频工作台
- `/books/[id]/review`：人工复核与 SLO 看板
- `/tasks`：任务中心与失败任务重试
- `/settings/llm`：LLM 模型配置中心

## 文档入口

- [技术架构](./ARCHITECTURE.md)
- [业务架构](./docs/BUSINESS_ARCHITECTURE.md)
- [开发指南](./DEV_GUIDE.md)
- [文档索引](./docs/README.md)
- [Agent 协作说明](./AGENTS.md)
- [远端 TTS 栈](./ops/remote-tts-stack/README.md)

## 许可证

ISC
