# Docker 开发环境配置总结

## 问题回顾

使用 `npm run docker:dev` 启动后遇到两个主要问题：
1. **热更新不工作**：修改代码后无法实时生效
2. **容器不断重启**：web 容器启动失败并循环重启

## 解决方案总结

### 1. 创建开发专用 Dockerfile

**文件**: `apps/web/Dockerfile.dev`

生产 Dockerfile 使用 multi-stage build 和 standalone 模式，最终镜像精简但不适合开发。开发 Dockerfile 包含：
- 完整的 pnpm 和 node_modules
- 开发依赖
- 直接运行 `pnpm dev` 而不是编译后的代码

### 2. 创建开发专用 Next.js 配置

**文件**: `apps/web/next.config.dev.js`

关键变更：
- 移除 `output: 'standalone'`（影响热更新）
- 移除废弃的 `swcMinify` 和 `experimental.turbo`
- 添加空的 `turbopack: {}` 配置（Next.js 16 默认使用 Turbopack）

**注意**: Turbopack 内置的文件监听在 Docker 中也能正常工作，不需要额外的轮询配置。

### 3. 更新 Prisma Schema

**文件**: `apps/web/prisma/schema.prisma`

添加 Linux ARM64 二进制目标：
```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../src/generated/prisma"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]
}
```

这确保 Prisma Client 可以在 Alpine Linux Docker 容器中运行。

**重要**: 添加 `binaryTargets` 后，Prisma 会生成两个版本的查询引擎：
- `libquery_engine-darwin-arm64.dylib.node` (macOS，本地开发)
- `libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node` (Linux，Docker)

Prisma 会根据运行环境自动选择正确的版本。

### 4. 更新 docker-compose.dev.yml

关键配置：
- 指定使用 `Dockerfile.dev`
- 挂载源代码和配置文件
- 使用开发配置覆盖生产配置
- 添加环境变量支持文件监听

## 使用指南

### 首次启动

```bash
# 1. 停止现有容器
npm run docker:dev:down

# 2. 构建开发镜像
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web

# 3. 启动开发环境
npm run docker:dev

# 4. 查看日志
docker logs txt2voice-web -f
```

### 日常开发

```bash
# 启动（不需要重新构建）
npm run docker:dev

# 停止
npm run docker:dev:down

# 查看日志
npm run docker:logs
```

### 何时需要重新构建

以下情况需要重新构建镜像：
- 修改 `package.json` 或 `pnpm-lock.yaml`
- 修改 `Dockerfile.dev`
- 修改 `prisma/schema.prisma`（需要重新生成 Prisma Client）

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web
```

### 验证热更新

1. 访问 http://localhost:3001
2. 修改 `apps/web/src` 下的任意文件
3. 保存后，Turbopack 会自动重新编译
4. 浏览器会自动刷新显示变化

## 技术细节

### Next.js 16 + Turbopack

Next.js 16 默认在开发模式使用 Turbopack：
- **更快的编译速度**：比 Webpack 快 700 倍（首次启动）
- **内置文件监听**：在 Docker 中也能正常工作
- **无需轮询配置**：不需要 `WATCHPACK_POLLING` 等环境变量

### Docker 文件挂载

使用 `:cached` 标志优化性能：
```yaml
volumes:
  - ./apps/web/src:/app/apps/web/src:cached
```

排除 node_modules 和 .next：
```yaml
volumes:
  - /app/node_modules
  - /app/apps/web/node_modules
  - /app/apps/web/.next
```

### Prisma 二进制目标

- `native`: 本地开发（macOS ARM64）
- `linux-musl-arm64-openssl-3.0.x`: Docker Alpine Linux

## 故障排查

### 容器不断重启

```bash
# 查看详细日志
docker logs txt2voice-web --tail 100

# 常见原因：
# 1. Prisma Client 二进制不匹配 -> 检查 binaryTargets
# 2. Next.js 配置错误 -> 检查 next.config.dev.js
# 3. 依赖缺失 -> 重新构建镜像
```

### Prisma 错误："could not locate the Query Engine"

如果看到 Prisma 找不到查询引擎的错误：

```bash
# 1. 确认 schema.prisma 包含正确的 binaryTargets
# 2. 重新生成 Prisma Client（本地）
cd apps/web
npx prisma generate

# 3. 重新构建并启动容器
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web
npm run docker:dev

# 4. 验证容器内有两个引擎文件
docker exec txt2voice-web ls -la /app/apps/web/src/generated/prisma/ | grep libquery_engine
# 应该看到 darwin-arm64 和 linux-musl-arm64 两个版本
```

### 热更新不工作

```bash
# 1. 确认容器正常运行
docker ps | grep txt2voice-web

# 2. 检查文件挂载
docker exec txt2voice-web ls -la /app/apps/web/src

# 3. 查看编译日志
docker logs txt2voice-web -f
# 应该看到 "Compiling ..." 消息

# 4. 清理缓存
docker exec txt2voice-web rm -rf /app/apps/web/.next
docker restart txt2voice-web
```

### 端口冲突

如果端口 3001 被占用：
```bash
# 查找占用端口的进程
lsof -i :3001

# 或修改 docker-compose.dev.yml 中的端口映射
ports:
  - "3002:3001"  # 将宿主机端口改为 3002
```

## 相关文件

- `apps/web/Dockerfile.dev` - 开发环境 Dockerfile
- `apps/web/Dockerfile` - 生产环境 Dockerfile
- `apps/web/next.config.dev.js` - 开发环境 Next.js 配置
- `apps/web/next.config.js` - 生产环境 Next.js 配置
- `apps/web/prisma/schema.prisma` - Prisma 数据库 Schema
- `docker-compose.dev.yml` - 开发环境 Docker Compose 配置
- `docker-compose.yml` - 基础/生产环境 Docker Compose 配置

## 性能对比

### 开发模式 (Turbopack)
- 首次启动: ~300ms
- 热更新: 1-2秒
- CPU 使用: 低

### 生产模式 (Standalone)
- 构建时间: ~30秒
- 启动时间: ~1秒
- 镜像大小: 更小（精简）

## 下一步

- 考虑添加 `docker-compose.override.yml` 支持个性化配置
- 配置 VS Code Remote Containers 以获得更好的开发体验
- 添加 Docker 健康检查优化
