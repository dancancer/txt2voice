# 异步任务模式部署指南

## 变更概述

为解决长文本角色识别时的接口超时问题，系统已升级为**异步任务模式**。

> ⚠️ **2025-02 更新**：角色识别现已完全由 LLM 完成，该文档描述的 Python 异步部署仅作历史记录保留。

### 主要变更

1. **Character-Recognition 服务**
   - 新增异步任务管理器
   - 新增异步识别接口
   - 支持回调通知机制

2. **Web 服务**
   - 数据库新增 `externalTaskId` 字段
   - 识别接口改为异步提交模式
   - 新增回调接口
   - 实现轮询机制

3. **前端页面**
   - 需要支持轮询显示进度（待实现）

## 部署步骤

### 方式一：完整重新构建（推荐）

#### 1. 设置代理（如遇网络问题）

```bash
# 临时设置
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 或永久配置 Docker 代理
mkdir -p ~/.docker
cat > ~/.docker/config.json <<EOF
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:7890",
      "httpsProxy": "http://127.0.0.1:7890"
    }
  }
}
EOF
```

#### 2. 停止现有服务

```bash
docker compose down
```

#### 3. 重新构建镜像

```bash
# 构建 character-recognition 服务
docker compose build character-recognition

# 构建 web 服务
docker compose build web
```

#### 4. 启动服务

```bash
docker compose up -d
```

#### 5. 运行数据库迁移

```bash
# 进入 web 容器
docker compose exec web sh

# 运行迁移
cd apps/web
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 退出容器
exit

# 重启 web 服务
docker compose restart web
```

### 方式二：热更新（临时方案）

**适用场景：** Docker Hub 网络问题导致无法重新构建镜像

#### 1. 更新 Character-Recognition 服务

```bash
# 复制新文件到容器
docker cp apps/character-recognition/main.py txt2voice-character-recognition:/app/main.py
docker cp apps/character-recognition/src/task_manager.py txt2voice-character-recognition:/app/src/task_manager.py

# 重启服务
docker compose restart character-recognition
```

#### 2. 更新 Web 服务

```bash
# 复制新文件到容器
docker cp apps/web/src/lib/character-recognition-client.ts txt2voice-web:/app/apps/web/src/lib/character-recognition-client.ts
docker cp apps/web/src/app/api/books/[id]/characters/recognize/route.ts txt2voice-web:/app/apps/web/src/app/api/books/[id]/characters/recognize/route.ts
docker cp apps/web/src/app/api/books/[id]/characters/recognize/callback txt2voice-web:/app/apps/web/src/app/api/books/[id]/characters/recognize/

# 进入容器运行迁移
docker compose exec web sh
cd apps/web

# 手动执行 SQL（因为 migrate dev 需要交互）
# 连接到数据库
psql $DATABASE_URL

# 执行 SQL
ALTER TABLE processing_tasks ADD COLUMN IF NOT EXISTS "externalTaskId" TEXT;
CREATE INDEX IF NOT EXISTS "processing_tasks_externalTaskId_idx" ON "processing_tasks"("externalTaskId");
\q

# 生成 Prisma Client
npx prisma generate

exit

# 重启服务
docker compose restart web
```

### 方式三：使用本地代理构建

如果 Docker Hub 连接超时，可以使用代理：

```bash
# 1. 启动本地代理（如 Clash、V2Ray 等）
# 确保代理运行在 127.0.0.1:7890

# 2. 配置 Docker 使用代理
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
export NO_PROXY=localhost,127.0.0.1

# 3. 重新构建
docker compose build character-recognition

# 4. 如果仍然失败，尝试使用 Docker 配置文件
# 编辑 ~/.docker/config.json
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:7890",
      "httpsProxy": "http://127.0.0.1:7890",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}

# 5. 重启 Docker Desktop 并重试
```

## 验证部署

### 1. 检查服务状态

```bash
# 查看所有服务
docker compose ps

# 应该看到所有服务都是 Up 状态
```

### 2. 检查 Character-Recognition 服务

```bash
# 健康检查
curl http://localhost:8001/health

# 查看统计信息
curl http://localhost:8001/api/stats

# 应该返回包含 tasks 信息的 JSON
```

### 3. 检查 Web 服务

```bash
# 检查数据库迁移
docker compose exec web npx prisma migrate status

# 应该显示所有迁移都已应用
```

### 4. 查看日志

```bash
# Character-Recognition 服务
docker logs txt2voice-character-recognition --tail=50

# Web 服务
docker logs txt2voice-web --tail=50

# 不应该有错误信息
```

## 测试异步任务

### 1. 提交测试任务

```bash
# 直接测试 character-recognition 服务
curl -X POST http://localhost:8001/api/recognize/async \
  -H "Content-Type: application/json" \
  -d '{
    "text": "张三和李四是好朋友。王五也认识他们。",
    "options": {
      "enable_coreference": true,
      "enable_dialogue": true,
      "enable_relations": true
    }
  }'

# 应该返回 task_id
```

### 2. 查询任务状态

```bash
# 使用上一步返回的 task_id
curl http://localhost:8001/api/recognize/async/{task_id}

# 应该返回任务状态和进度
```

### 3. 通过 Web 界面测试

1. 访问 http://localhost:3000
2. 上传一个文本文件
3. 点击"识别角色"
4. 观察进度条和状态更新
5. 等待识别完成

## 故障排查

### 问题1：Character-Recognition 服务启动失败

**症状：**
```bash
docker logs txt2voice-character-recognition
# 显示 ModuleNotFoundError: No module named 'task_manager'
```

**解决方法：**
```bash
# 确认文件已复制
docker compose exec character-recognition ls -la /app/src/task_manager.py

# 如果文件不存在，重新复制
docker cp apps/character-recognition/src/task_manager.py txt2voice-character-recognition:/app/src/task_manager.py
docker compose restart character-recognition
```

### 问题2：数据库迁移失败

**症状：**
```
Error: Environment variable not found: DATABASE_URL
```

**解决方法：**
```bash
# 检查环境变量
docker compose exec web env | grep DATABASE_URL

# 如果没有，检查 .env 文件
cat .env.local

# 确保包含：
# DATABASE_URL="postgresql://txt2voice:txt2voice_password@postgres:5432/txt2voice"
```

### 问题3：回调失败

**症状：**
日志显示 "发送回调失败: Connection refused"

**解决方法：**
```bash
# 检查 APP_URL 配置
docker compose exec web env | grep APP_URL

# 在 Docker 环境中，应该使用容器名称
# 修改 .env 文件：
# APP_URL=http://web:3000

# 重启服务
docker compose restart web
```

### 问题4：TypeScript 编译错误

**症状：**
```
Object literal may only specify known properties, and 'externalTaskId' does not exist
```

**解决方法：**
```bash
# 重新生成 Prisma Client
docker compose exec web sh
cd apps/web
npx prisma generate
exit

# 重启服务
docker compose restart web
```

## 回滚方案

如果新版本出现问题，可以回滚到之前的版本：

```bash
# 1. 停止服务
docker compose down

# 2. 恢复旧代码
git checkout HEAD~1 apps/character-recognition/main.py
git checkout HEAD~1 apps/web/src/app/api/books/[id]/characters/recognize/route.ts

# 3. 回滚数据库迁移
docker compose exec web npx prisma migrate resolve --rolled-back add_external_task_id

# 4. 重新启动
docker compose up -d
```

## 性能优化建议

### 1. 调整轮询间隔

如果服务器负载较高，可以增加轮询间隔：

```typescript
// apps/web/src/app/api/books/[id]/characters/recognize/route.ts
const pollInterval = 10000 // 改为 10 秒
```

### 2. 增加超时时间

对于超长文本，可以增加超时时间：

```typescript
const maxAttempts = 240 // 改为 20 分钟
```

### 3. 启用回调优先

确保 `APP_URL` 正确配置，优先使用回调而不是轮询：

```bash
# .env.local
APP_URL=http://web:3000  # Docker 内部
# 或
APP_URL=http://localhost:3000  # 本地开发
```

## 监控建议

### 1. 定期检查任务统计

```bash
# 每小时检查一次
watch -n 3600 'curl -s http://localhost:8001/api/stats | jq .tasks'
```

### 2. 监控失败任务

```bash
# 查询失败的任务
docker compose exec web npx prisma studio

# 在 ProcessingTask 表中筛选 status = 'failed'
```

### 3. 清理过期任务

Character-Recognition 服务会自动清理 24 小时前的任务，无需手动干预。

## 下一步

1. **前端页面优化**：实现更友好的进度显示
2. **WebSocket 支持**：替代轮询，实现实时推送
3. **任务队列**：使用 Redis 实现更可靠的任务管理
4. **监控告警**：集成 Prometheus + Grafana

## 相关文档

- [异步任务架构设计](../technical/ASYNC_TASK_ARCHITECTURE.md)
- [开发指南](../../DEV_GUIDE.md)
- [Docker 部署文档](../../ARCHITECTURE.md)
