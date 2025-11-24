# Text to Voice - 智能文本转语音平台

一个基于 Next.js 16 的智能文本转语音平台，支持书籍上传、角色识别、台本生成和多角色朗读。

## 🎯 核心功能

- **智能文本处理** - 自动分段、编码检测、格式清理
- **AI 角色识别** - 由 Gemini 等 LLM 直接驱动，统一 JSON 输出
- **台本生成** - 自动生成对话台本，分配角色和情感
- **多角色朗读** - 为不同角色配置不同声音
- **批量音频生成** - 支持整本书批量生成音频

## 🏗️ 项目结构

这是一个基于 PNPM Workspaces 的 monorepo 项目：

```
txt2voice/
├── apps/
│   ├── web/                        # Next.js Web 应用
│   │   ├── src/                    # 源代码
│   │   ├── prisma/                 # 数据库模式
│   │   └── package.json
│   └── character-recognition/      # 已归档的 Python 人物识别服务（仅作历史参考）
│       ├── src/                    # FastAPI 服务
│       ├── tests/                  # 测试
│       └── requirements.txt
├── docs/                           # 文档目录
│   ├── history/                    # 历史记录和迁移文档
│   └── technical/                  # 技术文档
├── scripts/                        # 工具脚本
├── docker-compose.yml              # Docker 开发环境配置（默认）
├── docker-compose.prod.yml         # Docker 生产环境配置
├── pnpm-workspace.yaml             # PNPM workspace 配置
├── package.json                    # 根 package.json
└── ARCHITECTURE.md                 # 架构文档
```

## 🧠 Agent 架构

多 Agent 协同驱动整条生产链路：

- **任务协调 Agent**：接收用户操作、拆分任务、编排状态流转并兜底异常。
- **文本处理 Agent**：完成文件解析、编码识别、章节/段落切分与统计。
- **角色分析 Agent**：直接调用 Gemini/DeepSeek/OpenAI LLM 完成角色识别，输出结构化 JSON。
- **台本生成 Agent**：按章节分段、补齐角色映射，并带三级 JSON 修复流程。
- **音频生成 Agent**：批量调用 TTS，负责并行、分批、失败重试与章节拼接。

以上 Agent 由同一套任务系统驱动，`pending → processing → completed/failed` 状态在前端实时反馈。

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 运行 lint
pnpm lint

# 类型检查
pnpm typecheck
```

### Docker 部署

#### 开发环境（默认，支持热更新）

```bash
# 1. 配置环境变量（首次部署）
cp .env.docker .env
# 编辑 .env 文件填入你的配置（LLM_API_KEY、AZURE_SPEECH_KEY 等）

# 2. 构建并启动开发环境
pnpm docker:build
pnpm docker:up

# 3. 查看日志
pnpm docker:logs

# 4. 停止服务
pnpm docker:down
```

#### 生产环境

```bash
# 1. 配置环境变量（首次部署）
cp .env.docker .env
# 编辑 .env 文件填入你的配置（LLM_API_KEY、AZURE_SPEECH_KEY 等）

# 2. 构建并启动生产环境
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 3. 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 4. 停止服务
docker-compose -f docker-compose.prod.yml down
```

**注意**：
- 开发环境使用 `docker-compose.yml`，支持热更新和调试
- 生产环境使用 `docker-compose.prod.yml`，优化了性能和安全性
- Docker Compose 会自动读取项目根目录的 `.env` 文件。确保该文件存在并包含所有必需的配置。

## 🐳 Docker 服务

- **postgres** - PostgreSQL 16 数据库 (端口 5432)
- **redis** - Redis 7 缓存和队列 (端口 6379)
- **redisinsight** - Redis 可视化运维 (端口 5540)
- **web** - Next.js Web 应用 (端口 3000/3001)

## 🛠️ 技术栈

### 前端
- **框架**: Next.js 16.0.1 (App Router)
- **语言**: TypeScript 5.9.3
- **UI**: React 19.2.0 + Tailwind CSS 4.1.17 + Radix UI
- **状态管理**: Zustand 5.0.8

### 后端
- **API**: Next.js API Routes + Hono 4.10.4
- **数据库**: PostgreSQL 16 + Prisma 6.19.0
- **任务队列**: Bull 4.16.5 + Redis
- **AI 服务**: OpenAI SDK (支持 OpenAI, DeepSeek 等)

### LLM 服务
- **角色识别**: Gemini 2.5 Pro（可切换 DeepSeek、OpenAI 等）
- **台本与修复**: DeepSeek Chat，可自定义 Provider

## ⚙️ 配置

创建 `.env` 文件并配置以下变量：

```bash
# 数据库 (Docker环境自动配置)
DATABASE_URL=postgresql://txt2voice:txt2voice_password@postgres:5432/txt2voice

# Redis (Docker环境自动配置)
REDIS_URL=redis://redis:6379

# LLM 服务 (必需)
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# NextAuth (必需)
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# TTS 服务 (可选)
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=eastasia

# 角色识别 LLM (必需)
CHARREG_LLM_PROVIDER=google
CHARREG_LLM_API_KEY=your-gemini-api-key
CHARREG_LLM_MODEL=gemini-2.5-pro
CHARREG_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
CHARREG_LLM_MAX_CHARS=20000
```

## 📚 可用命令

### 根目录命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建所有项目
pnpm start        # 启动生产服务器
pnpm lint         # 运行 lint
pnpm typecheck    # 运行类型检查
```

### Docker 命令

#### 开发环境命令

```bash
pnpm docker:up      # 启动开发环境 Docker 服务
pnpm docker:down    # 停止开发环境 Docker 服务
pnpm docker:build   # 构建开发环境 Docker 镜像
pnpm docker:logs    # 查看开发环境 Docker 日志
```

#### 生产环境命令

```bash
pnpm docker:prod        # 启动生产环境 Docker 服务
pnpm docker:prod:down   # 停止生产环境 Docker 服务
pnpm docker:prod:build # 构建生产环境 Docker 镜像
pnpm docker:prod:logs  # 查看生产环境 Docker 日志
```

### 针对特定应用

```bash
# 在 web 应用中运行命令
pnpm --filter web dev
pnpm --filter web build

# 或者进入应用目录
cd apps/web
pnpm dev
```

## 📖 文档

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 系统架构详细说明
- **[docs/technical/](./docs/technical/)** - 技术文档和优化记录
- **[docs/history/](./docs/history/)** - 历史记录和迁移文档
- **[apps/character-recognition/README.md](./apps/character-recognition/README.md)** - 旧版 Python 服务（Legacy，仅供参考）

## 🔍 核心工作流

```
1. 用户上传 → 任务协调 Agent 创建 Book 与处理任务
2. 文本处理 Agent → 编码检测、章节切分、逐章分段
3. 任务协调 Agent → 创建角色分析任务（可按章节采样）
4. 角色分析 Agent → LLM 识别角色，统一 JSON 结果
5. 任务协调 Agent → 创建台本生成任务（书籍/章节/段落粒度）
6. 台本生成 Agent → 逐段生成台词并写入 chapterId
7. 用户配置声音 → 绑定角色声音，可批量操作
8. 任务协调 Agent → 创建音频生成任务
9. 音频生成 Agent → 批量生成音轨并章节拼接
10. 完成 → 用户下载章节或整书音频
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 许可证

ISC

## 🆘 问题排查

### 端口冲突

修改 `docker-compose.yml` 中的端口映射

### 依赖问题

```bash
# 清理并重新安装
rm -rf node_modules apps/*/node_modules
rm -rf pnpm-lock.yaml
pnpm install
```

### Docker 构建失败

```bash
# 清理 Docker 缓存
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

### 角色识别策略

系统采用 **LLM 优先 + 默认角色兜底** 策略：

1. **主要方法：Gemini/DeepSeek/OpenAI 等 LLM**  
   通过 `CharacterRecognitionClient` 统一调用，自动裁剪文本、生成 JSON、并写入统计信息。
2. **兜底：默认角色集合**  
   当 LLM 调用失败或返回空结果时，仍会创建“旁白 / 男主角 / 女主角”，保证台本和音频流程可继续。

环境变量示例：

```env
LLM_PROVIDER=custom
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
CHARREG_LLM_PROVIDER=google
CHARREG_LLM_API_KEY=your-gemini-api-key
CHARREG_LLM_MODEL=gemini-2.5-pro
CHARREG_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
CHARREG_LLM_MAX_CHARS=20000
```

任务协调 Agent 会在 `processing_tasks` 中记录识别耗时，你可以通过前端或数据库查看任务历史。
