# Text to Voice - 智能文本转语音平台

一个基于 Next.js 16 的智能文本转语音平台，支持书籍上传、角色识别、台本生成和多角色朗读。

## 🎯 核心功能

- **智能文本处理** - 自动分段、编码检测、格式清理
- **AI 角色识别** - 基于 LLM 自动识别书籍中的角色
- **台本生成** - 自动生成对话台本，分配角色和情感
- **多角色朗读** - 为不同角色配置不同声音
- **批量音频生成** - 支持整本书批量生成音频
- **Python 人物识别服务** - 独立的 FastAPI 服务，提供高精度人物识别

## 🏗️ 项目结构

这是一个基于 PNPM Workspaces 的 monorepo 项目：

```
txt2voice/
├── apps/
│   ├── web/                        # Next.js Web 应用
│   │   ├── src/                    # 源代码
│   │   ├── prisma/                 # 数据库模式
│   │   └── package.json
│   └── character-recognition/      # Python 人物识别服务
│       ├── src/                    # FastAPI 服务
│       ├── tests/                  # 测试
│       └── requirements.txt
├── docs/                           # 文档目录
│   ├── history/                    # 历史记录和迁移文档
│   └── technical/                  # 技术文档
├── scripts/                        # 工具脚本
├── docker-compose.yml              # Docker 编排配置
├── pnpm-workspace.yaml             # PNPM workspace 配置
├── package.json                    # 根 package.json
└── ARCHITECTURE.md                 # 架构文档
```

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

```bash
# 1. 配置环境变量（首次部署）
cp .env.docker .env
# 编辑 .env 文件填入你的配置（LLM_API_KEY、AZURE_SPEECH_KEY 等）

# 2. 构建并启动所有服务
pnpm docker:build
pnpm docker:up

# 3. 查看日志
pnpm docker:logs

# 4. 停止服务
pnpm docker:down
```

**注意**：Docker Compose 会自动读取项目根目录的 `.env` 文件。确保该文件存在并包含所有必需的配置。

## 🐳 Docker 服务

- **postgres** - PostgreSQL 16 数据库 (端口 5432)
- **redis** - Redis 7 缓存和队列 (端口 6379)
- **character-recognition** - Python 人物识别服务 (端口 8001)
- **web** - Next.js Web 应用 (端口 3000)

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

### Python 服务
- **框架**: FastAPI
- **NLP**: HanLP + Text2Vec
- **容器**: Docker

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

```bash
pnpm docker:up      # 启动 Docker 服务
pnpm docker:down    # 停止 Docker 服务
pnpm docker:build   # 构建 Docker 镜像
pnpm docker:logs    # 查看 Docker 日志
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
- **[apps/character-recognition/README.md](./apps/character-recognition/README.md)** - Python 服务文档

## 🔍 核心工作流

```
1. 上传书籍文件
   ↓
2. 文本处理（编码检测、清洗、分段）
   ↓
3. 角色分析（LLM 识别角色和特征）
   ↓
4. 台本生成（逐段生成对话台本）
   ↓
5. 声音配置（为角色绑定声音）
   ↓
6. 音频生成（批量调用 TTS）
   ↓
7. 完成（下载音频文件）
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