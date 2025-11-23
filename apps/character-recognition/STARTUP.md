# Character Recognition 启动指南

## 快速开始

### 方式 1：一键启动（推荐用于开发/单机部署）

使用统一启动脚本，自动启动 API 和 Worker：

#### Python 版本
```bash
cd apps/character-recognition
python start.py
```

#### Shell 版本
```bash
cd apps/character-recognition
./start.sh
```

**特点**：
- ✅ 一条命令启动所有服务
- ✅ 自动管理进程生命周期
- ✅ Ctrl+C 同时停止所有服务
- ✅ 适合开发和简单部署

---

### 方式 2：分开启动（推荐用于生产环境）

分别启动 API 和 Worker，便于独立扩展和管理：

#### 终端 1 - 启动 API 服务
```bash
cd apps/character-recognition
python main.py
```

#### 终端 2 - 启动 Worker
```bash
cd apps/character-recognition
python worker.py
```

**特点**：
- ✅ 完全解耦，独立扩展
- ✅ 可以启动多个 Worker 实例
- ✅ 便于容器化部署
- ✅ 适合生产环境

---

## 不同场景的推荐方案

### 场景 1：本地开发

**推荐**: 方式 1（一键启动）

```bash
# 启动所有服务
python start.py

# 或使用 shell 脚本
./start.sh
```

### 场景 2：Docker 部署

**推荐**: 方式 2（分开启动）+ Docker Compose

```yaml
# docker-compose.yml
services:
  character-recognition-api:
    command: python main.py
    ports:
      - "8001:8001"

  character-recognition-worker:
    command: python worker.py
    depends_on:
      - redis
```

### 场景 3：生产环境（高并发）

**推荐**: 方式 2 + 进程管理器

#### 使用 Supervisor

```ini
# /etc/supervisor/conf.d/character-recognition.conf

[program:character-recognition-api]
command=/path/to/python /path/to/main.py
directory=/path/to/apps/character-recognition
autostart=true
autorestart=true
stdout_logfile=/var/log/character-recognition-api.log
stderr_logfile=/var/log/character-recognition-api-error.log

[program:character-recognition-worker]
command=/path/to/python /path/to/worker.py
directory=/path/to/apps/character-recognition
autostart=true
autorestart=true
numprocs=3  # 启动 3 个 Worker 实例
process_name=%(program_name)s_%(process_num)02d
stdout_logfile=/var/log/character-recognition-worker.log
stderr_logfile=/var/log/character-recognition-worker-error.log
```

#### 使用 systemd

```ini
# /etc/systemd/system/character-recognition-api.service
[Unit]
Description=Character Recognition API
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/apps/character-recognition
ExecStart=/path/to/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/character-recognition-worker@.service
[Unit]
Description=Character Recognition Worker %i
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/apps/character-recognition
ExecStart=/path/to/python worker.py
Restart=always

[Install]
WantedBy=multi-user.target
```

启动多个 Worker：
```bash
sudo systemctl start character-recognition-worker@1
sudo systemctl start character-recognition-worker@2
sudo systemctl start character-recognition-worker@3
```

---

## 扩展性对比

### 方式 1：一键启动
```
┌─────────────────┐
│   start.py      │
│  ┌───────────┐  │
│  │    API    │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Worker   │  │
│  └───────────┘  │
└─────────────────┘
```
**限制**：一个 API + 一个 Worker

### 方式 2：分开启动
```
┌───────────┐    ┌───────────┐
│   API     │    │  Worker 1 │
└───────────┘    └───────────┘
                 ┌───────────┐
                 │  Worker 2 │
    Redis        └───────────┘
    Queue        ┌───────────┐
                 │  Worker 3 │
                 └───────────┘
```
**优势**：可以独立扩展 Worker 数量

---

## 监控和管理

### 查看运行状态

#### 使用 start.py 启动
```bash
# 查看进程
ps aux | grep "main.py\|worker.py"

# 查看日志（如果使用 start.sh）
tail -f api.log
tail -f worker.log
```

#### 使用 Supervisor
```bash
sudo supervisorctl status
sudo supervisorctl restart character-recognition-worker:*
```

#### 使用 systemd
```bash
sudo systemctl status character-recognition-api
sudo systemctl status character-recognition-worker@1
```

### 查看 Redis 队列

```bash
# 队列长度
redis-cli LLEN charrecog:task_queue

# 查看所有任务相关的 key
redis-cli KEYS "charrecog:*"
```

---

## 常见问题

### Q: 如何增加 Worker 数量？

**A**: 使用方式 2，启动多个 Worker 实例：

```bash
# 终端 1
python worker.py

# 终端 2
python worker.py

# 终端 3
python worker.py
```

多个 Worker 会自动从同一个队列中取任务，互不冲突。

### Q: Worker 需要和 API 在同一台机器上吗？

**A**: 不需要！只要能连接到同一个 Redis，Worker 可以部署在任何地方：

```bash
# 机器 A - API
REDIS_URL=redis://redis-server:6379/0 python main.py

# 机器 B - Worker 1
REDIS_URL=redis://redis-server:6379/0 python worker.py

# 机器 C - Worker 2
REDIS_URL=redis://redis-server:6379/0 python worker.py
```

### Q: 如何平滑重启？

**A**:
1. 停止接收新任务：停止 API
2. 等待 Worker 处理完队列中的任务
3. 重启 Worker
4. 重启 API

```bash
# 使用 Supervisor
sudo supervisorctl stop character-recognition-api
# 等待队列清空
redis-cli LLEN charrecog:task_queue
# 重启
sudo supervisorctl restart character-recognition-worker:*
sudo supervisorctl start character-recognition-api
```

---

## 性能调优

### 合理设置 Worker 数量

根据 CPU 核心数和任务特点：
- CPU 密集型：Worker 数量 = CPU 核心数
- I/O 密集型：Worker 数量 = CPU 核心数 * 2

### 监控队列长度

```bash
# 设置告警阈值
while true; do
  QUEUE_LEN=$(redis-cli LLEN charrecog:task_queue)
  if [ $QUEUE_LEN -gt 100 ]; then
    echo "警告: 队列堆积 $QUEUE_LEN 个任务"
  fi
  sleep 10
done
```

---

## 总结

| 场景 | 推荐方式 | 命令 |
|------|----------|------|
| 本地开发 | 一键启动 | `python start.py` |
| 单机部署 | 一键启动 | `./start.sh` |
| Docker | 分开启动 | Docker Compose |
| 生产环境 | 分开启动 + 进程管理 | Supervisor/systemd |
| 高并发 | 分开启动 + 多 Worker | 进程管理器 |

**推荐**: 开发用方式 1，生产用方式 2！
