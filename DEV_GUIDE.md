# 本地开发指南

## 快速开始

### 方式一：推荐 - 本地运行Web应用 + Docker运行依赖服务

这是最推荐的开发方式，可以获得最佳的开发体验（热更新、快速调试）。

```bash
# 1. 创建本地环境变量文件
cp .env.local.example apps/web/.env.local
# 编辑 apps/web/.env.local，填入必要的配置（如LLM_API_KEY）

# 2. 启动依赖服务（PostgreSQL, Redis, Character Recognition）
pnpm docker:services

# 3. 在另一个终端启动Web应用
cd apps/web
pnpm dev

# 或者使用一条命令（需要等待服务启动完成）
pnpm dev:local
```

访问 http://localhost:3000

**停止服务：**
```bash
# 停止依赖服务
pnpm docker:services:down

# Web应用在终端按 Ctrl+C 停止
```

### 方式二：完整Docker开发环境（支持热更新）

如果需要在Docker中运行所有服务并支持代码热更新：

```bash
# 首次启动或依赖变更后，需要构建镜像
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web

# 启动开发环境
pnpm docker:dev

# 查看日志
pnpm docker:logs

# 停止
pnpm docker:dev:down
```

访问 http://localhost:3001

**热更新说明：**
- 修改 `apps/web/src` 下的代码会自动触发 Turbopack 重新编译
- 浏览器会自动刷新显示变化
- 无需重启容器

**何时需要重新构建：**
- 修改 `package.json` 或 `pnpm-lock.yaml`
- 修改 `prisma/schema.prisma`
- 修改 `Dockerfile.dev`

详细文档：[Docker 开发环境配置总结](docs/technical/DOCKER_DEV_SETUP_SUMMARY.md)

### 方式三：生产模式Docker（需要重新构建）

适用于测试生产环境配置：

```bash
# 构建并启动所有服务
pnpm docker:build
pnpm docker:up

# 查看日志
pnpm docker:logs

# 停止
pnpm docker:down
```

## 环境变量配置

### 本地开发 (apps/web/.env.local)

```env
DATABASE_URL="postgresql://txt2voice:txt2voice_password@localhost:5432/txt2voice"
REDIS_URL="redis://localhost:6379"
CHARACTER_RECOGNITION_URL="http://localhost:8001"
LLM_API_KEY="your-api-key-here"
```

### Docker环境 (docker-compose.yml)

环境变量在 `docker-compose.yml` 中配置，或通过 `.env` 文件传递。

## 常用命令

```bash
# 开发
pnpm dev                    # 本地运行Web应用（需要先启动依赖服务）
pnpm dev:local              # 自动启动依赖服务并运行Web应用

# Docker依赖服务
pnpm docker:services        # 启动PostgreSQL, Redis, Character Recognition
pnpm docker:services:down   # 停止依赖服务

# Docker完整环境
pnpm docker:up              # 启动所有服务（生产模式）
pnpm docker:down            # 停止所有服务
pnpm docker:build           # 重新构建镜像
pnpm docker:logs            # 查看日志

# Docker开发环境
pnpm docker:dev             # 启动开发环境（支持热更新）
pnpm docker:dev:down        # 停止开发环境

# 代码检查
pnpm lint                   # 运行ESLint
pnpm typecheck              # 运行TypeScript类型检查
```

## 数据库迁移

```bash
cd apps/web

# 生成Prisma客户端
npx prisma generate

# 运行迁移
npx prisma migrate dev

# 查看数据库
npx prisma studio
```

## 服务端口

- Web应用（本地）: http://localhost:3000
- Web应用（Docker）: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Character Recognition: http://localhost:8001

## 故障排查

### 数据库连接失败

确保Docker服务已启动：
```bash
docker ps | grep txt2voice
```

### 端口被占用

检查端口占用：
```bash
lsof -i :3000  # Web应用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

### 代码修改不生效

- **本地开发**: Next.js会自动热更新
- **Docker生产模式**: 需要重新构建镜像
  ```bash
  pnpm docker:build
  pnpm docker:up
  ```

## 推荐开发流程

1. **首次启动**:
   ```bash
   cp .env.local.example apps/web/.env.local
   # 编辑 .env.local 填入配置
   pnpm docker:services
   cd apps/web && pnpm dev
   ```

2. **日常开发**:
   - 依赖服务保持运行（`docker ps`查看状态）
   - 只需启动/停止Web应用（`pnpm dev`）
   - 代码修改自动热更新

3. **测试生产环境**:
   ```bash
   pnpm docker:build
   pnpm docker:up
   ```
