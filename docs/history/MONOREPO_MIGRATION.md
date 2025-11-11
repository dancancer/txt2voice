# Monorepo 迁移指南

本文档说明如何将当前项目迁移到 monorepo 结构。

## 项目结构

迁移后的 monorepo 结构如下：

```
txt2voice-monorepo/
├── apps/
│   └── web/                    # Next.js 应用
│       ├── src/
│       ├── prisma/
│       ├── public/
│       ├── package.json
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── next.config.js
│       ├── tsconfig.json
│       └── ...
├── packages/                   # 共享包（未来扩展）
│   └── shared/
├── docker-compose.yml          # Docker Compose 配置
├── pnpm-workspace.yaml         # PNPM workspace 配置
├── package.json                # 根 package.json
├── .env                        # 环境变量
└── .env.docker                 # Docker 环境变量模板
```

## 迁移步骤

### 1. 备份当前项目

```bash
# 创建备份
cp -r /Users/xupeng/mycode/txt2voice /Users/xupeng/mycode/txt2voice-backup
```

### 2. 创建 apps/web 目录

```bash
mkdir -p apps/web
```

### 3. 移动现有文件到 apps/web

```bash
# 移动应用相关文件和目录
mv src apps/web/
mv prisma apps/web/
mv public apps/web/
mv next.config.js apps/web/
mv tsconfig.json apps/web/
mv tailwind.config.js apps/web/
mv postcss.config.js apps/web/
mv eslint.config.mjs apps/web/
mv prisma.config.ts apps/web/

# 移动测试文件
mv test-*.js apps/web/
mv debug-*.js apps/web/

# 移动数据文件
mv 1.txt apps/web/
mv 1_utf8.txt apps/web/

# 将当前的 package.json 移动到 web 应用
mv package.json apps/web/package.json
mv package-lock.json apps/web/

# 移动环境变量示例
mv .env.example apps/web/
```

### 4. 更新根目录配置

```bash
# 将 package.root.json 重命名为 package.json
mv package.root.json package.json
```

### 5. 安装 PNPM（如果尚未安装）

```bash
# 使用 npm 安装 pnpm
npm install -g pnpm@8.15.0

# 或使用 Homebrew (macOS)
brew install pnpm
```

### 6. 安装依赖

```bash
# 安装所有 workspace 的依赖
pnpm install
```

### 7. 更新 Next.js 配置以支持 standalone 输出

编辑 `apps/web/next.config.js`，添加以下配置：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ... 其他配置
}

module.exports = nextConfig
```

### 8. 配置环境变量

```bash
# 复制 Docker 环境变量模板
cp .env.docker .env

# 编辑 .env 文件，填入你的实际配置
nano .env
```

### 9. 验证本地开发

```bash
# 启动开发服务器
pnpm dev

# 或者进入 web 应用目录
cd apps/web
pnpm dev
```

## Docker 部署

### 构建和启动所有服务

```bash
# 构建 Docker 镜像
pnpm docker:build

# 启动所有服务（PostgreSQL, Redis, Web）
pnpm docker:up

# 查看日志
pnpm docker:logs
```

### 单独管理服务

```bash
# 启动特定服务
docker-compose up -d postgres redis

# 停止所有服务
pnpm docker:down

# 重启 web 服务
docker-compose restart web

# 查看服务状态
docker-compose ps
```

### 数据库迁移

```bash
# 在 Docker 容器中运行 Prisma 迁移
docker-compose exec web npx prisma migrate deploy

# 或者在本地运行（需要配置 DATABASE_URL）
cd apps/web
npx prisma migrate deploy
```

## 常用命令

### 开发命令

```bash
# 启动所有应用的开发服务器
pnpm dev

# 构建所有应用
pnpm build

# 运行所有应用的 lint
pnpm lint

# 运行所有应用的类型检查
pnpm typecheck
```

### Docker 命令

```bash
# 查看容器日志
docker-compose logs -f web
docker-compose logs -f postgres
docker-compose logs -f redis

# 进入容器 shell
docker-compose exec web sh
docker-compose exec postgres psql -U txt2voice -d txt2voice

# 清理所有容器和数据卷
docker-compose down -v
```

## 添加新的应用或包

### 添加新应用

```bash
# 创建新应用目录
mkdir -p apps/new-app

# 初始化 package.json
cd apps/new-app
pnpm init

# 返回根目录并安装
cd ../..
pnpm install
```

### 添加共享包

```bash
# 创建共享包
mkdir -p packages/shared

# 初始化
cd packages/shared
pnpm init

# 在 package.json 中设置包名
{
  "name": "@txt2voice/shared",
  "version": "1.0.0",
  "main": "index.ts"
}
```

### 在应用中使用共享包

```bash
# 在 web 应用中添加共享包依赖
cd apps/web
pnpm add @txt2voice/shared@workspace:*
```

## 故障排除

### 端口冲突

如果端口 3000、5432 或 6379 已被占用：

```bash
# 修改 docker-compose.yml 中的端口映射
# 例如：将 "3000:3000" 改为 "3001:3000"
```

### 数据库连接问题

```bash
# 检查 PostgreSQL 服务状态
docker-compose ps postgres

# 查看 PostgreSQL 日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec postgres psql -U txt2voice -d txt2voice -c "SELECT 1"
```

### 构建失败

```bash
# 清理 Docker 缓存并重新构建
docker-compose down
docker-compose build --no-cache web
docker-compose up -d
```

### 依赖安装问题

```bash
# 清理 node_modules 和锁文件
rm -rf node_modules apps/*/node_modules
rm -rf pnpm-lock.yaml

# 重新安装
pnpm install
```

## 环境变量说明

### 必需的环境变量

- `NEXTAUTH_SECRET`: NextAuth 密钥（生产环境必须修改）
- `LLM_API_KEY`: LLM 服务的 API 密钥

### 可选的环境变量

- `AZURE_SPEECH_KEY`: Azure 语音服务密钥
- `AZURE_SPEECH_REGION`: Azure 服务区域
- `LLM_BASE_URL`: LLM API 基础 URL
- `LLM_MODEL`: 使用的 LLM 模型

## 生产部署建议

1. **安全性**
   - 修改所有默认密码和密钥
   - 使用强密码生成器生成 `NEXTAUTH_SECRET`
   - 不要将 `.env` 文件提交到版本控制

2. **性能优化**
   - 为 PostgreSQL 配置适当的资源限制
   - 启用 Redis 持久化
   - 配置 nginx 作为反向代理

3. **监控和日志**
   - 配置日志聚合服务
   - 设置健康检查和告警
   - 定期备份数据库

4. **扩展性**
   - 使用 Docker Swarm 或 Kubernetes 进行编排
   - 配置负载均衡
   - 实现水平扩展

## 下一步

1. 完成项目迁移
2. 测试所有功能是否正常
3. 创建 CI/CD 流程
4. 编写单元测试和集成测试
5. 部署到生产环境

## 参考资料

- [PNPM Workspaces](https://pnpm.io/workspaces)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prisma with Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
