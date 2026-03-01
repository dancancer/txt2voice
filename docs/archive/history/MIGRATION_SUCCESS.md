# ✅ Monorepo 迁移成功

## 📋 迁移总结

项目已成功从单一 Next.js 应用转换为 monorepo 结构！

### 完成的工作

- ✅ 创建了 PNPM workspace 配置
- ✅ 所有文件已移动到 `apps/web/` 目录
- ✅ Docker 配置已创建（Dockerfile + docker-compose.yml）
- ✅ 环境变量已配置（.env）
- ✅ 依赖已安装
- ✅ Prisma Client 已生成
- ✅ 开发服务器已验证正常运行

### 备份位置

原始项目备份在：`../txt2voice-backup-20251111-161925`

## 📁 新的项目结构

```
txt2voice-monorepo/
├── apps/
│   └── web/                    # Next.js 应用
│       ├── src/                # 源代码
│       ├── prisma/             # 数据库模式
│       ├── package.json        # Web 应用依赖
│       ├── Dockerfile          # Docker 配置
│       └── ...
├── docker-compose.yml          # Docker 编排
├── pnpm-workspace.yaml         # Workspace 配置
├── package.json                # 根 package.json
└── .env                        # 环境变量
```

## 🚀 可用命令

### 本地开发

```bash
# 启动开发服务器
pnpm dev
# 访问: http://localhost:3001 (端口可能不同)

# 构建项目
pnpm build

# 类型检查
pnpm typecheck

# Lint
pnpm lint
```

### Docker 部署

```bash
# 构建 Docker 镜像
pnpm docker:build
# 或
docker-compose build

# 启动所有服务（PostgreSQL + Redis + Web）
pnpm docker:up
# 或
docker-compose up -d

# 查看日志
pnpm docker:logs
# 或
docker-compose logs -f

# 停止服务
pnpm docker:down
# 或
docker-compose down
```

### 针对 web 应用的命令

```bash
# 进入 web 应用目录
cd apps/web

# 运行任何命令
pnpm dev
pnpm build
npx prisma studio
```

## 🐳 Docker 服务

### 包含的服务

1. **postgres** - PostgreSQL 16 数据库
   - 端口: 5432
   - 用户: txt2voice
   - 密码: txt2voice_password
   - 数据库: txt2voice

2. **redis** - Redis 7 缓存
   - 端口: 6379

3. **web** - Next.js 应用
   - 端口: 3000
   - 健康检查: http://localhost:3000/api/health

### 首次 Docker 部署

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 运行数据库迁移
docker-compose exec web npx prisma migrate deploy

# 4. 查看状态
docker-compose ps

# 5. 访问应用
open http://localhost:3000
```

## ⚙️ 配置说明

### 环境变量 (.env)

已从 `.env.docker` 复制创建，主要变量：

```bash
# 必需配置
NEXTAUTH_SECRET=your-secret-key-here    # 需要修改！
LLM_API_KEY=your-llm-api-key-here       # 需要填写你的 API key

# 可选配置
AZURE_SPEECH_KEY=                       # Azure TTS (可选)
AZURE_SPEECH_REGION=                    # Azure 区域 (可选)
LLM_BASE_URL=https://api.deepseek.com  # LLM API 地址
LLM_MODEL=deepseek-chat                 # LLM 模型
```

### 数据库连接

- **本地开发**: 使用 `apps/web/.env` 配置
- **Docker**: 自动配置为 `postgres:5432`

## 📝 重要提示

### 1. 端口使用

开发服务器现在使用 **端口 3001**（因为 3000 被占用）。

如需修改，编辑 `apps/web/package.json`:
```json
{
  "scripts": {
    "dev": "next dev -p 3002"
  }
}
```

### 2. Package.json 名称

Web 应用的 `package.json` 名称已改为 `"web"`，这样 `pnpm --filter web` 命令才能正常工作。

### 3. Lockfile

已删除 `apps/web/package-lock.json`，现在统一使用根目录的 `pnpm-lock.yaml`。

### 4. Next.js 配置

`apps/web/next.config.js` 已配置：
- `output: 'standalone'` - 支持 Docker 部署
- `experimental.turbo.root` - 指定 monorepo 根目录

## 🔍 验证清单

- [x] 项目结构已转换为 monorepo
- [x] 依赖已安装
- [x] Prisma Client 已生成
- [x] 开发服务器可以运行
- [x] Docker 配置已创建
- [x] 环境变量已配置
- [ ] 更新 .env 中的敏感信息（NEXTAUTH_SECRET, LLM_API_KEY）
- [ ] 测试 Docker 部署
- [ ] 运行数据库迁移

## 🎯 下一步操作

### 立即需要做的

1. **更新环境变量**
   ```bash
   nano .env
   # 修改 NEXTAUTH_SECRET 和 LLM_API_KEY
   ```

2. **测试应用功能**
   - 访问 http://localhost:3001
   - 验证所有功能正常

3. **测试 Docker 部署**
   ```bash
   pnpm docker:build
   pnpm docker:up
   ```

### 可选操作

4. **添加更多服务/应用**
   - 创建 `apps/api` - 独立的 API 服务
   - 创建 `apps/worker` - 后台任务处理器
   - 创建 `packages/shared` - 共享代码库

5. **配置 CI/CD**
   - GitHub Actions
   - Docker 镜像自动构建
   - 自动化测试

6. **优化 Docker 配置**
   - 添加 nginx 反向代理
   - 配置 SSL 证书
   - 设置资源限制

## 📚 参考文档

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 详细设置指南
- [MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md) - 迁移详细说明
- [README.md](../../../README.md) - 使用说明
- [DOCKER_NOTES.md](../../technical/DOCKER_NOTES.md) - Docker 部署和安全

## ⚠️ 注意事项

### Docker 安全警告

Dockerfile 中的安全警告是正常的（来自基础镜像扫描）：
- 不影响开发和功能
- 通过定期更新基础镜像来保持安全
- 详见 [DOCKER_NOTES.md](../../technical/DOCKER_NOTES.md)

### 路径变化

所有代码现在在 `apps/web/` 目录下，记得更新：
- IDE 配置
- Git hooks
- 脚本路径引用

## 🆘 问题排查

### 问题：端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000

# 或修改端口
cd apps/web
pnpm dev -p 3002
```

### 问题：依赖问题

```bash
# 清理并重新安装
rm -rf node_modules apps/*/node_modules
rm pnpm-lock.yaml
pnpm install
```

### 问题：Docker 构建失败

```bash
# 清理 Docker 缓存
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

## ✨ 成功！

你的项目现在是一个完整的 monorepo，支持：
- 🚀 多应用管理
- 🐳 Docker 容器化部署
- 📦 共享依赖和代码
- 🔧 统一的工具链

享受新的开发体验！🎉
