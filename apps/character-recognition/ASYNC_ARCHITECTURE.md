# 异步角色识别架构说明

## 概述

角色识别服务已重构为**完全解耦的异步架构**，解决了大文本识别时的超时问题。

## 架构变更

### 之前的问题

1. **FastAPI BackgroundTasks 的限制**：虽然任务在后台执行，但仍需等待请求体完全接收和解析
2. **大文本超时**：277KB 文本会导致 5 分钟超时
3. **阻塞响应**：客户端需要等待任务提交完成

### 现在的解决方案

使用 **Redis 队列 + 独立 Worker** 架构：

```
Client → API (立即返回) → Redis 队列 → Worker (后台处理) → Redis 缓存结果
          ↓                                  ↓
      任务ID                            完成后回调
```

## 核心组件

### 1. Redis 队列 (`src/cache.py`)

- `enqueue_task()` - 将任务推入队列
- `dequeue_task()` - Worker 阻塞式获取任务
- `get_queue_length()` - 查询队列长度

### 2. API 接口 (`main.py`)

```python
POST /api/recognize/async
```

**行为**：
- 立即将任务数据存入 Redis 队列
- 返回任务 ID（不等待处理）
- 超时控制：30 秒（仅用于提交任务）

**响应示例**：
```json
{
  "success": true,
  "task_id": "a2d1cf7b-e976-49a9-a0d0-721a4bbbadf8",
  "message": "任务已创建，正在队列中等待处理",
  "queue_length": 0
}
```

### 3. Worker 进程 (`worker.py`)

独立的后台进程，负责：
- 从 Redis 队列中获取任务
- 执行角色识别
- 将结果存储到 Redis
- 调用回调 URL（如果提供）

**启动方式**：
```bash
python apps/character-recognition/worker.py
```

### 4. 结果查询

```python
GET /api/recognize/async/{task_id}
```

**返回内容**：
- 任务状态（pending/processing/completed/failed）
- 进度百分比
- 识别结果（如果完成）
- 从 Redis 缓存读取

## 工作流程

### 正常流程

1. **客户端提交任务**
   ```
   POST /api/recognize/async
   → 任务入队
   → 立即返回任务ID（< 1秒）
   ```

2. **Worker 处理**
   ```
   Worker 从队列取任务
   → 执行识别（可能需要几分钟）
   → 存储结果到 Redis
   → 调用回调（可选）
   ```

3. **结果获取**
   - **方式 1**：回调（推荐）
     - Worker 完成后自动调用 `callback_url`
   - **方式 2**：轮询
     - 客户端定期调用 `GET /api/recognize/async/{task_id}`
     - 从 Redis 读取最新状态和结果

### 故障恢复

- **Worker 崩溃**：重启 Worker 后继续处理队列中的任务
- **回调失败**：结果已存储在 Redis，可通过 API 查询
- **Redis 不可用**：自动降级到内存模式（asyncio.create_task）

## 前端客户端更新

### `character-recognition-client.ts`

添加了超时控制：

```typescript
async recognizeAsync(request, callbackUrl) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒

  const response = await fetch(url, {
    signal: controller.signal  // 超时控制
  })

  clearTimeout(timeoutId)
  // ...
}
```

### Web 服务轮询逻辑

`pollTaskStatus()` 函数：
- 每 5 秒查询一次任务状态
- 最多轮询 10 分钟
- 支持双重保障（回调 + 轮询）

## 配置

### 环境变量

```bash
# Redis 配置
REDIS_URL=redis://localhost:6379/0
ENABLE_CACHE=True
CACHE_TTL=3600  # 结果缓存时间（秒）

# 回调配置
CHARACTER_RECOGNITION_CALLBACK_BASE_URL=http://web:3001
```

### Docker Compose

确保 Redis 服务正常运行：

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

## 性能优化

### 优势

1. **非阻塞响应**：API 立即返回，不受文本大小影响
2. **可扩展性**：可以启动多个 Worker 并行处理
3. **容错性**：任务持久化在 Redis，Worker 可重启
4. **可观测性**：实时进度追踪

### 监控指标

- 队列长度：`get_queue_length()`
- 任务状态：Redis 缓存
- Worker 日志：标准输出

## 使用示例

### 启动服务

```bash
# 1. 启动 Redis（如果未运行）
docker-compose up -d redis

# 2. 启动 API 服务
python apps/character-recognition/main.py

# 3. 启动 Worker（独立进程）
python apps/character-recognition/worker.py
```

### 提交任务

```bash
curl -X POST http://localhost:8001/api/recognize/async \
  -H "Content-Type: application/json" \
  -d '{
    "text": "大段文本...",
    "book_id": "book-123",
    "options": {
      "enable_coreference": true,
      "enable_dialogue": true,
      "enable_relations": true
    }
  }'
```

### 查询结果

```bash
curl http://localhost:8001/api/recognize/async/{task_id}
```

## 故障排查

### 常见问题

1. **任务一直 pending**
   - 检查 Worker 是否运行：`ps aux | grep worker.py`
   - 检查 Redis 连接：`redis-cli ping`

2. **结果未保存**
   - 查看 Worker 日志
   - 检查 Redis 缓存：`redis-cli keys "charrecog:*"`

3. **回调失败**
   - 结果仍在 Redis，可通过 API 查询
   - 检查回调 URL 是否可达

### 日志位置

- API 日志：标准输出
- Worker 日志：标准输出
- 建议使用日志管理工具（如 loguru、ELK）

## 迁移指南

### 从旧架构迁移

1. **更新代码**：无需更改，API 接口保持兼容
2. **启动 Worker**：添加 Worker 进程到部署流程
3. **配置 Redis**：确保 Redis 可用并正确配置

### 向后兼容

- API 接口签名未变
- 如果 Redis 不可用，自动降级到内存模式
- 现有客户端代码无需修改

## 总结

通过引入 Redis 队列和独立 Worker，角色识别服务实现了：

- ✅ **真正的异步**：API 立即返回，不阻塞
- ✅ **解决超时**：大文本不再超时
- ✅ **高可用性**：任务持久化，Worker 可重启
- ✅ **可扩展性**：多 Worker 并行处理
- ✅ **易监控**：进度实时追踪，结果持久化

这是一个生产级的异步任务处理架构！
