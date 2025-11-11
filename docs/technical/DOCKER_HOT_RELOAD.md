# Docker 开发环境热更新配置

## 问题描述

在使用 `npm run docker:dev` 启动后，web 项目的代码修改无法实时生效，需要重启容器才能看到变化。

## 解决方案

### 1. 关键配置更改

#### a. 创建开发专用的 Dockerfile

创建了 `apps/web/Dockerfile.dev`，与生产 Dockerfile 的主要区别：
- **完整的开发环境**：包含 pnpm 和完整的 node_modules
- **不使用 standalone 模式**：保留完整的 Next.js 开发功能
- **删除 prisma.config.ts**：避免 dotenv 依赖问题

```dockerfile
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install --filter=web... --frozen-lockfile
CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "-p", "3001"]
```

#### b. 创建开发专用的 Next.js 配置

创建了 `apps/web/next.config.dev.js`，与生产配置的主要区别：
- **移除 `output: 'standalone'`**：standalone 模式会影响热更新
- **启用 webpack 轮询**：Docker 环境需要轮询来检测文件变化

```javascript
webpack: (config, { dev }) => {
  if (dev) {
    config.watchOptions = {
      poll: 1000,           // 每秒检查一次文件变化
      aggregateTimeout: 300, // 延迟 300ms 后触发重新编译
    }
  }
  return config
}
```

#### c. 更新 docker-compose.dev.yml

**文件挂载优化**：
- 挂载所有配置文件（next.config.js, tsconfig.json, tailwind.config.ts 等）
- 使用开发配置覆盖生产配置：`next.config.dev.js:/app/apps/web/next.config.js`

**环境变量**：
```yaml
environment:
  NODE_ENV: development
  PORT: 3001
  WATCHPACK_POLLING: "true"      # Next.js 文件监听轮询
  CHOKIDAR_USEPOLLING: "true"    # Chokidar 文件监听轮询
```

**指定开发 Dockerfile**：
```yaml
build:
  context: .
  dockerfile: apps/web/Dockerfile.dev
```

### 2. 使用方法

#### 首次启动或 Dockerfile 变更后

```bash
# 停止现有容器
npm run docker:dev:down

# 重新构建开发镜像
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web

# 启动开发环境
npm run docker:dev
```

#### 日常开发（仅代码变更）

```bash
# 直接启动，不需要重新构建
npm run docker:dev
```

#### 验证热更新

1. 启动开发环境后，访问 http://localhost:3001
2. 修改 `apps/web/src` 下的任意文件
3. 保存后，浏览器应该在 1-2 秒内自动刷新显示变化
4. 查看容器日志确认编译：
   ```bash
   npm run docker:logs
   ```

### 3. 技术原理

#### 为什么 Docker 需要轮询？

Docker 在 macOS 和 Windows 上使用虚拟化，文件系统事件（inotify）无法从宿主机传递到容器。因此需要：

1. **Webpack 轮询**：定期检查文件时间戳
2. **环境变量**：
   - `WATCHPACK_POLLING`: Next.js 内部使用的 watchpack 库
   - `CHOKIDAR_USEPOLLING`: 文件监听库 chokidar

#### 性能影响

- **轮询间隔**：1000ms（1秒）是平衡性能和响应速度的推荐值
- **CPU 使用**：轮询会增加少量 CPU 使用，但在开发环境可接受
- **延迟**：文件变化到重新编译约 1-2 秒

### 4. 故障排查

#### 热更新仍不工作

1. **检查容器日志**：
   ```bash
   docker logs txt2voice-web -f
   ```
   应该看到 "compiled successfully" 消息

2. **验证文件挂载**：
   ```bash
   docker exec txt2voice-web ls -la /app/apps/web/src
   ```
   确认文件时间戳在修改后更新

3. **检查端口**：
   确保访问 http://localhost:3001（不是 3000）

4. **清理缓存**：
   ```bash
   npm run docker:dev:down
   docker volume rm txt2voice_uploads_data
   npm run docker:dev
   ```

#### 编译很慢

- 轮询间隔可以调整（在 next.config.dev.js 中）
- 减少挂载的文件/目录
- 考虑使用本地开发：`npm run dev:local`

### 5. 生产环境

生产环境使用原始的 `next.config.js`（包含 standalone 输出），不受此配置影响：

```bash
npm run docker:up  # 使用生产配置
```

## 相关文件

- `apps/web/Dockerfile.dev` - 开发环境 Dockerfile
- `apps/web/Dockerfile` - 生产环境 Dockerfile
- `apps/web/next.config.dev.js` - 开发环境 Next.js 配置
- `apps/web/next.config.js` - 生产环境 Next.js 配置
- `docker-compose.dev.yml` - 开发环境 Docker Compose 配置
- `docker-compose.yml` - 基础/生产环境 Docker Compose 配置

## 常见问题

### Q: 为什么需要单独的开发 Dockerfile？

A: 生产 Dockerfile 使用 multi-stage build 和 standalone 模式，最终镜像只包含编译后的代码，不包含 pnpm 和完整的 node_modules。开发模式需要这些工具来运行 `next dev` 和支持热更新。

### Q: 修改依赖后需要重新构建吗？

A: 是的。如果修改了 `package.json` 或 `pnpm-lock.yaml`，需要重新构建镜像：
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web
```

### Q: 可以同时运行生产和开发容器吗？

A: 不建议。它们使用相同的容器名和端口（3001）。如果需要同时运行，请修改 `docker-compose.dev.yml` 中的端口映射。
