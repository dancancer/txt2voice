# Docker 开发环境快速启动

## 🚀 首次启动

```bash
# 1. 构建开发镜像
pnpm docker:build

# 2. 启动所有服务
pnpm docker:up

# 3. 查看日志（可选）
docker logs txt2voice-web -f
```

访问: http://localhost:3001

## 🔄 日常开发

```bash
# 启动
pnpm docker:up

# 停止
pnpm docker:down

# 查看日志
pnpm docker:logs
```

## ✅ 热更新已启用

- ✨ 修改代码自动重新编译（Turbopack）
- 🔄 浏览器自动刷新
- ⚡ 无需重启容器

## 🔨 何时需要重新构建

```bash
# 以下情况需要重新构建镜像：
# - 修改 package.json 或 pnpm-lock.yaml
# - 修改 prisma/schema.prisma
# - 修改 Dockerfile.dev

pnpm docker:build
```

## 🐛 故障排查

### 容器不断重启

```bash
# 查看错误日志
docker logs txt2voice-web --tail 100

# 常见解决方案：
# 1. 重新构建镜像
# 2. 清理并重启
pnpm docker:down
pnpm docker:up
```

### 热更新不工作

```bash
# 1. 确认容器运行正常
docker ps | grep txt2voice-web

# 2. 查看编译日志（应该看到 "Compiling ..." 消息）
docker logs txt2voice-web -f

# 3. 清理缓存并重启
docker restart txt2voice-web
```

### 端口被占用

```bash
# 查找占用进程
lsof -i :3001

# 或修改 docker-compose.yml 中的端口
ports:
  - "3002:3001"  # 改为其他端口
```

## 📚 详细文档

- [Docker 开发环境配置总结](docs/technical/DOCKER_DEV_SETUP_SUMMARY.md)
- [Docker 热更新配置](docs/technical/DOCKER_HOT_RELOAD.md)
- [开发指南](DEV_GUIDE.md)

## 🎯 关键文件

- `apps/web/Dockerfile.dev` - 开发环境 Dockerfile
- `apps/web/next.config.dev.js` - 开发环境 Next.js 配置
- `docker-compose.yml` - 开发环境 Docker Compose 配置（默认）
- `docker-compose.prod.yml` - 生产环境 Docker Compose 配置
- `apps/web/prisma/schema.prisma` - 数据库 Schema（包含二进制目标配置）

## 💡 提示

- **推荐**: 本地开发使用 `pnpm dev:local`（更快的热更新）
- **Docker 开发**: 适合需要完整容器化环境的场景，使用 `pnpm docker:up`
- **生产测试**: 使用 `pnpm docker:prod`（不支持热更新，优化性能）
