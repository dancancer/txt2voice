# 异步任务架构设计

## 概述

为解决长文本角色识别时的接口超时问题，系统采用了**异步任务模式**，将耗时的识别工作从同步HTTP请求中解耦。

## 架构设计

### 1. 整体流程

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────────────┐
│   前端页面   │ ───> │  Web 服务     │ ───> │ Character-Recognition  │
│  (Browser)  │      │  (Next.js)   │      │      服务 (Python)      │
└─────────────┘      └──────────────┘      └─────────────────────────┘
       │                    │                           │
       │ 1. 提交识别任务      │                           │
       │ ─────────────────> │                           │
       │                    │ 2. 异步提交任务             │
       │                    │ ─────────────────────────> │
       │                    │ <─────────────────────────│
       │ <──────────────────│    返回任务ID              │
       │    返回任务ID       │                           │
       │                    │                           │ 3. 后台处理
       │ 4. 轮询任务状态     │                           │    (异步)
       │ ─────────────────> │                           │
       │                    │ 5. 查询外部任务状态         │
       │                    │ ─────────────────────────> │
       │                    │ <─────────────────────────│
       │ <──────────────────│    返回进度/结果           │
       │    返回进度/结果    │                           │
       │                    │                           │
       │                    │ 6. 回调通知 (可选)         │
       │                    │ <─────────────────────────│
       │                    │    任务完成                │
```

### 2. 组件职责

#### 2.1 Character-Recognition 服务

**新增功能：**
- **任务管理器** (`src/task_manager.py`)
  - 管理异步任务的生命周期
  - 维护任务状态（pending, processing, completed, failed）
  - 支持任务进度跟踪
  - 自动清理过期任务

- **异步接口** (`main.py`)
  - `POST /api/recognize/async` - 提交异步识别任务
  - `GET /api/recognize/async/{task_id}` - 查询任务状态
  - 支持回调通知机制

**工作流程：**
1. 接收异步识别请求，立即创建任务并返回任务ID
2. 使用 FastAPI BackgroundTasks 在后台执行识别
3. 识别完成后更新任务状态
4. 如果提供了回调URL，主动通知 Web 服务

#### 2.2 Web 服务 (Next.js)

**数据库变更：**
- `ProcessingTask` 表新增 `externalTaskId` 字段
  - 存储 character-recognition 服务返回的任务ID
  - 用于关联本地任务和外部任务

**接口变更：**
- `POST /api/books/[id]/characters/recognize`
  - 改为异步提交模式
  - 调用 `characterRecognitionClient.recognizeAsync()`
  - 启动轮询机制检查任务状态

- `GET /api/books/[id]/characters/recognize`
  - 保持不变，返回本地任务状态

- **新增** `POST /api/books/[id]/characters/recognize/callback`
  - 接收 character-recognition 服务的回调通知
  - 处理识别结果并更新数据库

**工作流程：**
1. 接收前端请求，创建本地任务
2. 提交异步任务到 character-recognition 服务
3. 保存外部任务ID
4. 启动后台轮询（5秒间隔，最多10分钟）
5. 定期查询外部任务状态并更新本地进度
6. 任务完成后保存结果到数据库

#### 2.3 前端页面

**变更：**
- 提交任务后立即返回
- 通过轮询 `GET /api/books/[id]/characters/recognize` 获取进度
- 显示实时进度条和状态信息

## 技术实现

### 1. Character-Recognition 任务管理器

```python
class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.callbacks: Dict[str, Callable] = {}
    
    def create_task(self, callback_url: Optional[str] = None) -> str:
        """创建新任务"""
        task_id = str(uuid.uuid4())
        task_info = TaskInfo(
            task_id=task_id,
            status=TaskStatus.PENDING,
            created_at=datetime.now()
        )
        self.tasks[task_id] = task_info
        return task_id
    
    def update_task(self, task_id: str, status, progress, message, result, error):
        """更新任务状态"""
        # ...
```

### 2. 异步识别接口

```python
@app.post("/api/recognize/async")
async def recognize_characters_async(
    request: RecognitionRequest,
    background_tasks: BackgroundTasks,
    callback_url: Optional[str] = None
):
    # 创建任务
    task_id = task_manager.create_task(callback_url)
    
    # 添加后台任务
    background_tasks.add_task(
        process_recognition_task,
        task_id,
        request
    )
    
    return {"task_id": task_id, "message": "任务已创建"}
```

### 3. Web 服务轮询机制

```typescript
async function pollTaskStatus(bookId: string, taskId: string, externalTaskId: string) {
  const maxAttempts = 120 // 10 分钟
  const pollInterval = 5000 // 5 秒
  
  while (attempts < maxAttempts) {
    await sleep(pollInterval)
    
    // 查询外部任务状态
    const externalTask = await characterRecognitionClient.getTaskStatus(externalTaskId)
    
    // 更新本地进度
    await updateTaskProgress(taskId, progress, message)
    
    // 检查是否完成
    if (externalTask.status === 'completed') {
      await handleRecognitionComplete(bookId, taskId, externalTask.result)
      return
    }
  }
}
```

### 4. 回调通知机制

**Character-Recognition 发送回调：**
```python
async def send_callback(callback_url: str, task_id: str, result: dict):
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {
            "task_id": task_id,
            "status": "completed",
            "result": result
        }
        await client.post(callback_url, json=payload)
```

**Web 服务接收回调：**
```typescript
// POST /api/books/[id]/characters/recognize/callback
export const POST = async (request) => {
  const { task_id, status, result, error } = await request.json()
  
  // 查找本地任务
  const task = await prisma.processingTask.findFirst({
    where: { externalTaskId: task_id }
  })
  
  // 处理结果
  if (status === 'completed') {
    await handleRecognitionComplete(bookId, task.id, result)
  }
}
```

## 优势

### 1. 解决超时问题
- HTTP 请求立即返回，不会因长时间处理而超时
- 支持处理任意长度的文本

### 2. 更好的用户体验
- 实时进度反馈
- 用户可以离开页面，稍后回来查看结果

### 3. 系统解耦
- Web 服务和识别服务独立部署
- 识别服务可以水平扩展
- 支持任务队列和负载均衡

### 4. 容错性
- 轮询机制作为备份，即使回调失败也能获取结果
- 任务状态持久化，服务重启不丢失

### 5. 可扩展性
- 易于添加更多异步任务类型
- 支持批量处理和优先级队列

## 配置

### Character-Recognition 服务

无需额外配置，服务启动时自动初始化任务管理器。

### Web 服务

**环境变量：**
```bash
# 回调URL基础地址
APP_URL=http://localhost:3000
# 或
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Character Recognition 服务地址
CHARACTER_RECOGNITION_URL=http://localhost:8001
```

**数据库迁移：**
```bash
cd apps/web
npx prisma migrate dev --name add_external_task_id
```

## 部署说明

### 1. 更新 Character-Recognition 服务

```bash
# 方式1: 重新构建镜像（推荐）
docker compose build character-recognition
docker compose up -d character-recognition

# 方式2: 热更新（临时）
docker cp apps/character-recognition/main.py txt2voice-character-recognition:/app/main.py
docker cp apps/character-recognition/src/task_manager.py txt2voice-character-recognition:/app/src/task_manager.py
docker compose restart character-recognition
```

### 2. 更新 Web 服务

```bash
# 运行数据库迁移
cd apps/web
npx prisma migrate deploy

# 重新生成 Prisma Client
npx prisma generate

# 重启服务
docker compose restart web
```

### 3. 使用代理（如遇网络问题）

```bash
# 设置 Docker 代理
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 或在 ~/.docker/config.json 中配置
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:7890",
      "httpsProxy": "http://127.0.0.1:7890"
    }
  }
}

# 重新构建
docker compose build character-recognition
```

## 监控和调试

### 1. 查看任务统计

```bash
curl http://localhost:8001/api/stats
```

返回：
```json
{
  "service": "Character Recognition Service",
  "version": "1.0.0",
  "tasks": {
    "total": 5,
    "pending": 0,
    "processing": 1,
    "completed": 3,
    "failed": 1
  }
}
```

### 2. 查看任务状态

```bash
curl http://localhost:8001/api/recognize/async/{task_id}
```

### 3. 查看日志

```bash
# Character-Recognition 服务
docker logs txt2voice-character-recognition -f

# Web 服务
docker logs txt2voice-web -f
```

## 故障排查

### 1. 任务一直处于 processing 状态

**可能原因：**
- Character-Recognition 服务崩溃
- 识别过程中出现异常

**解决方法：**
```bash
# 查看服务日志
docker logs txt2voice-character-recognition --tail=100

# 重启服务
docker compose restart character-recognition
```

### 2. 回调失败

**可能原因：**
- 回调URL不可访问
- Web 服务未启动

**解决方法：**
- 轮询机制会自动获取结果，无需担心
- 检查 `APP_URL` 环境变量配置

### 3. 轮询超时

**可能原因：**
- 文本过长，处理时间超过10分钟
- 服务资源不足

**解决方法：**
- 增加 `maxAttempts` 值
- 优化服务器资源配置
- 考虑文本分块处理

## 未来优化

1. **消息队列**：使用 Redis/RabbitMQ 替代轮询
2. **WebSocket**：实时推送进度更新
3. **任务优先级**：支持紧急任务优先处理
4. **批量处理**：支持多个文本同时识别
5. **进度细化**：更详细的进度信息（如当前处理的句子）
6. **任务取消**：支持用户取消正在进行的任务

## 相关文件

- `apps/character-recognition/src/task_manager.py` - 任务管理器
- `apps/character-recognition/main.py` - 异步接口实现
- `apps/web/src/lib/character-recognition-client.ts` - 客户端SDK
- `apps/web/src/app/api/books/[id]/characters/recognize/route.ts` - 识别接口
- `apps/web/src/app/api/books/[id]/characters/recognize/callback/route.ts` - 回调接口
- `apps/web/prisma/schema.prisma` - 数据库模型
