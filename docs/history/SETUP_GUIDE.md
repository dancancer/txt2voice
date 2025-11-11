# Monorepo 设置指南

## 📋 已创建的文件

### 根目录配置
- ✅ `pnpm-workspace.yaml` - PNPM workspace 配置
- ✅ `package.root.json` - 根 package.json（需要重命名为 package.json）
- ✅ `docker-compose.yml` - Docker 编排配置
- ✅ `.env.docker` - Docker 环境变量模板
- ✅ `.gitignore.monorepo` - Monorepo 的 .gitignore

### Web 应用配置
- ✅ `apps/web/Dockerfile` - Next.js 应用的 Docker 配置
- ✅ `apps/web/.dockerignore` - Docker 忽略文件
- ✅ `apps/web/next.config.js` - Next.js 配置（支持 standalone 输出）
- ✅ `apps/web/src/app/api/health/route.ts` - 健康检查 API

### 文档和脚本
- ✅ `MONOREPO_MIGRATION.md` - 完整迁移指南
- ✅ `README.monorepo.md` - Monorepo 使用说明
- ✅ `scripts/migrate-to-monorepo.sh` - 自动迁移脚本

## 🚀 快速设置（推荐）

### 方法 1：使用自动迁移脚本

```bash
# 1. 给脚本添加执行权限
chmod +x scripts/migrate-to-monorepo.sh

# 2. 运行迁移脚本（会自动备份）
./scripts/migrate-to-monorepo.sh

# 3. 配置环境变量
cp .env.docker .env
nano .env  # 编辑填入你的配置

# 4. 测试本地开发
pnpm dev

# 5. 测试 Docker 部署
pnpm docker:build
pnpm docker:up
```

### 方法 2：手动迁移

```bash
# 1. 备份项目
cp -r . ../txt2voice-backup

# 2. 创建目录结构
mkdir -p apps/web

# 3. 移动文件到 apps/web
mv src apps/web/
mv prisma apps/web/
mv public apps/web/
mv next.config.js apps/web/  # 注意：会覆盖已创建的文件
mv tsconfig.json apps/web/
mv tailwind.config.js apps/web/
mv postcss.config.js apps/web/
mv eslint.config.mjs apps/web/
mv prisma.config.ts apps/web/
mv package.json apps/web/package.json
mv .env.example apps/web/

# 4. 更新根目录配置
mv package.root.json package.json
mv .gitignore.monorepo .gitignore

# 5. 安装 pnpm（如果未安装）
npm install -g pnpm@8.15.0

# 6. 安装依赖
pnpm install

# 7. 配置环境变量
cp .env.docker .env
nano .env

# 8. 测试
pnpm dev
```

## 🐳 Docker 部署

### 首次部署

```bash
# 1. 确保环境变量已配置
cat .env

# 2. 构建 Docker 镜像
docker-compose build

# 3. 启动所有服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f web

# 6. 运行数据库迁移
docker-compose exec web npx prisma migrate deploy

# 7. 访问应用
open http://localhost:3000
```

### 日常使用

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart web

# 查看日志
docker-compose logs -f

# 进入容器
docker-compose exec web sh

# 清理所有数据（危险！）
docker-compose down -v
```

## 📝 重要说明

### 1. Next.js 配置

`apps/web/next.config.js` 已配置为支持 Docker 部署：

```javascript
{
  output: 'standalone',  // 启用独立输出模式
  reactStrictMode: true,
  swcMinify: true,
}
```

如果你的原始配置有其他设置，请合并它们。

### 2. 环境变量

Docker 和本地开发使用不同的环境变量：

- **本地开发**: `apps/web/.env` 或 `apps/web/.env.local`
- **Docker 部署**: 根目录的 `.env` 文件

### 3. 数据库连接

- **本地开发**: `DATABASE_URL=postgresql://user:password@localhost:5432/txt2voice`
- **Docker**: `DATABASE_URL=postgresql://txt2voice:txt2voice_password@postgres:5432/txt2voice`

### 4. 文件路径

迁移后，所有 web 应用相关的文件都在 `apps/web/` 目录下。

### 5. Docker 镜像安全

Dockerfile 中使用的 `node:20-alpine` 镜像可能会触发安全警告。这是正常的：

- 这些是基础镜像的常规安全扫描结果
- 通过定期更新镜像版本来保持安全
- 在生产环境中，考虑使用特定的版本标签（如 `node:20.10.0-alpine`）

## ✅ 验证清单

部署前请确认：

- [ ] 已创建 `apps/web/` 目录
- [ ] 所有文件已移动到 `apps/web/`
- [ ] `package.root.json` 已重命名为 `package.json`
- [ ] 已配置 `.env` 文件
- [ ] pnpm 已安装
- [ ] 依赖已安装 (`pnpm install`)
- [ ] 本地开发可以运行 (`pnpm dev`)
- [ ] Docker 镜像已构建 (`docker-compose build`)
- [ ] Docker 服务可以启动 (`docker-compose up`)
- [ ] 应用可以访问 (http://localhost:3000)
- [ ] 健康检查通过 (http://localhost:3000/api/health)

## 🔧 故障排除

### 问题：pnpm 命令未找到

```bash
npm install -g pnpm@8.15.0
```

### 问题：端口被占用

修改 `docker-compose.yml` 中的端口：

```yaml
services:
  web:
    ports:
      - "3001:3000"  # 改为其他端口
```

### 问题：Docker 构建失败

```bash
# 清理缓存
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

### 问题：数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启服务
docker-compose restart postgres
```

### 问题：文件未找到

确保所有文件都在正确的位置：

```bash
# 检查目录结构
tree -L 2 apps/

# 应该看到：
# apps/
# └── web/
#     ├── src/
#     ├── prisma/
#     ├── public/
#     ├── package.json
#     └── ...
```

## 📚 下一步

1. 阅读 [MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md) 了解详细信息
2. 阅读 [README.monorepo.md](./README.monorepo.md) 了解使用方法
3. 配置 CI/CD 流程
4. 添加更多应用或共享包
5. 部署到生产环境

## 🆘 需要帮助？

如果遇到问题：

1. 检查 [MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md) 的故障排除部分
2. 查看 Docker 日志：`docker-compose logs -f`
3. 检查环境变量配置是否正确
4. 确认所有服务都在运行：`docker-compose ps`

---

**提示**: 始终保持备份！迁移脚本会自动创建备份，但手动迁移时请务必先备份。
