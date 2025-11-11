# Docker 部署说明

## 📦 Dockerfile 说明

项目使用多阶段构建来优化 Docker 镜像大小和安全性。

### 构建阶段

1. **deps** - 安装依赖
2. **builder** - 构建应用
3. **runner** - 运行时环境

### 基础镜像

使用 `node:20-alpine` 作为基础镜像：
- 轻量级（约 40MB）
- 包含 Node.js 20 LTS
- 基于 Alpine Linux

## ⚠️ 关于安全警告

你可能会在 IDE 中看到 Dockerfile 的安全警告：

```
The image contains 1 high vulnerability
```

### 这是正常的

这些警告来自 Docker linter 对基础镜像的安全扫描。原因：

1. **Alpine 包管理器**: Alpine Linux 使用 apk，有时会包含已知的 CVE
2. **Node.js 版本**: 即使是 LTS 版本也可能有未修复的漏洞
3. **过渡性依赖**: 某些系统库可能有安全问题

### 如何处理

#### 开发环境
- 这些警告不影响开发
- 可以安全地忽略

#### 生产环境
采取以下措施：

1. **定期更新基础镜像**
```dockerfile
# 使用特定版本
FROM node:20.10.0-alpine

# 定期更新到最新的补丁版本
```

2. **扫描镜像**
```bash
# 使用 Trivy 扫描
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image txt2voice-web:latest

# 使用 Snyk 扫描
snyk container test txt2voice-web:latest
```

3. **更新系统包**
```dockerfile
FROM node:20-alpine
RUN apk update && apk upgrade
RUN apk add --no-cache libc6-compat
```

4. **使用 Distroless 镜像（高级）**
```dockerfile
# 更安全但更复杂
FROM gcr.io/distroless/nodejs20-debian12
```

## 🔧 优化建议

### 1. 固定版本

当前 Dockerfile 使用 `node:20-alpine`，这会获取最新的 20.x 版本。

生产环境建议固定版本：

```dockerfile
# 推荐：使用特定版本
FROM node:20.10.0-alpine

# 不推荐：使用浮动版本
FROM node:20-alpine
```

### 2. 多阶段构建优化

当前已经使用了多阶段构建，但可以进一步优化：

```dockerfile
# 使用构建缓存
RUN --mount=type=cache,target=/root/.npm \
    pnpm install --frozen-lockfile

# 使用 buildkit
# docker build --progress=plain --no-cache .
```

### 3. 添加安全扫描到 CI/CD

```yaml
# .github/workflows/docker.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'txt2voice-web:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

## 📊 镜像大小

当前配置的镜像大小（估计）：

- **未压缩**: ~300-400MB
- **压缩**: ~100-150MB

这主要包含：
- Node.js 运行时
- Next.js 应用代码
- node_modules (生产依赖)
- Prisma Client

### 减小镜像大小

1. **移除开发依赖**
```bash
pnpm install --prod --frozen-lockfile
```

2. **使用 .dockerignore**
已经配置了 `.dockerignore`，确保排除不必要的文件。

3. **清理构建缓存**
```dockerfile
RUN pnpm install && pnpm cache clean
```

## 🚀 部署最佳实践

### 1. 使用 Docker Compose 标签

```yaml
services:
  web:
    image: txt2voice-web:${VERSION:-latest}
    labels:
      - "com.example.version=${VERSION}"
      - "com.example.environment=${ENV}"
```

### 2. 健康检查

已经配置了健康检查：

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get(...)"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 3. 资源限制

生产环境建议添加资源限制：

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 4. 日志管理

```yaml
services:
  web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 🔐 安全加固

### 1. 非 Root 用户

已经配置了非 root 用户：

```dockerfile
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
```

### 2. 只读文件系统（可选）

```yaml
services:
  web:
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache
```

### 3. 删除不必要的能力

```yaml
services:
  web:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 4. 使用 Secrets

```yaml
services:
  web:
    secrets:
      - llm_api_key
      - nextauth_secret

secrets:
  llm_api_key:
    file: ./secrets/llm_api_key.txt
  nextauth_secret:
    file: ./secrets/nextauth_secret.txt
```

## 📝 环境变量管理

### 开发环境

```bash
# 使用 .env 文件
docker-compose --env-file .env.development up
```

### 生产环境

```bash
# 使用 secrets 或环境变量注入
docker-compose --env-file .env.production up

# 或通过 CI/CD 平台注入
export LLM_API_KEY=xxx
docker-compose up
```

## 🔄 更新策略

### 滚动更新

```bash
# 零停机更新
docker-compose up -d --no-deps --build web
```

### 蓝绿部署

```bash
# 启动新版本
docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d

# 切换流量
# 停止旧版本
docker-compose -f docker-compose.yml -f docker-compose.green.yml down
```

## 📚 参考资料

- [Docker 安全最佳实践](https://docs.docker.com/develop/security-best-practices/)
- [Node.js Docker 最佳实践](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Next.js Docker 部署](https://nextjs.org/docs/deployment#docker-image)
- [Alpine Linux 安全](https://alpinelinux.org/posts/Alpine-Linux-has-switched-to-openssl.html)

## 🆘 故障排除

### 镜像构建失败

```bash
# 清理构建缓存
docker builder prune -a

# 使用 buildkit
DOCKER_BUILDKIT=1 docker build .
```

### 容器启动失败

```bash
# 查看日志
docker-compose logs web

# 进入容器调试
docker-compose run --rm web sh
```

### 性能问题

```bash
# 查看资源使用
docker stats

# 查看容器详情
docker inspect txt2voice-web
```

---

**总结**: Dockerfile 的安全警告是正常的，通过定期更新、安全扫描和遵循最佳实践可以确保生产环境的安全性。
