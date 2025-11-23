# Redis 配置指南

## 配置 Redis 地址的 3 种方式

### 方式 1：使用默认值（最简单）

**默认配置**：`redis://localhost:6379/0`

如果 Redis 在本地运行且使用默认端口，无需任何配置，直接启动即可：

```bash
./start.sh
```

---

### 方式 2：通过 .env 文件（推荐）

**适用场景**：持久化配置，团队共享配置

#### 步骤：

1. **复制配置模板**
   ```bash
   cd apps/character-recognition
   cp .env.example .env
   ```

2. **编辑 .env 文件**
   ```bash
   vim .env
   # 或
   nano .env
   ```

3. **修改 REDIS_URL**
   ```bash
   # 本地 Redis
   REDIS_URL=redis://localhost:6379/0
   
   # 远程 Redis
   REDIS_URL=redis://192.168.1.100:6379/0
   
   # 带密码的 Redis
   REDIS_URL=redis://:password@192.168.1.100:6379/0
   
   # 带用户名和密码
   REDIS_URL=redis://username:password@192.168.1.100:6379/0
   ```

4. **启动服务**
   ```bash
   ./start.sh
   ```
   
   启动时会显示：
   ```
   ✓ REDIS_URL=redis://192.168.1.100:6379/0
     (从 .env 文件读取配置)
   ```

---

### 方式 3：通过环境变量（推荐用于临时修改）

**适用场景**：临时测试、不同环境切换

```bash
# 启动时指定
REDIS_URL=redis://192.168.1.100:6379/0 ./start.sh

# 或先 export
export REDIS_URL=redis://192.168.1.100:6379/0
./start.sh
```

---

## 配置优先级

```
环境变量 REDIS_URL（最高优先级）
          ↓
    .env 文件中的 REDIS_URL
          ↓
    config.py 默认值（最低优先级）
```

### 示例：

```bash
# .env 文件中配置：redis://localhost:6379/0
# 但启动时覆盖：
REDIS_URL=redis://remote:6379/0 ./start.sh

# 实际使用：redis://remote:6379/0（环境变量优先）
```

---

## Redis URL 格式

### 标准格式
```
redis://[username:password@]host:port/db
```

### 常见格式示例

| 场景 | Redis URL |
|------|-----------|
| 本地默认 | `redis://localhost:6379/0` |
| 本地自定义端口 | `redis://localhost:6380/0` |
| 远程无密码 | `redis://192.168.1.100:6379/0` |
| 远程带密码 | `redis://:mypassword@192.168.1.100:6379/0` |
| 带用户名 | `redis://admin:mypassword@192.168.1.100:6379/0` |
| 使用不同数据库 | `redis://localhost:6379/1` |
| Unix Socket | `redis+socket:///var/run/redis.sock?db=0` |

---

## 验证配置

### 1. 查看启动日志

```bash
./start.sh
```

输出中会显示：
```
设置环境变量...
✓ 虚拟环境已激活: .venv-macos-tf210
✓ HANLP_URL=https://ftp.hankcs.com/hanlp/
✓ TF_USE_LEGACY_KERAS=1
✓ REDIS_URL=redis://localhost:6379/0
  (使用默认配置，可创建 .env 文件自定义)
  提示: cp .env.example .env

检查 Redis 连接...
✓ Redis 连接正常
```

### 2. 手动测试 Redis 连接

```bash
# 使用 redis-cli
redis-cli -h localhost -p 6379 ping
# 应输出: PONG

# 测试远程 Redis
redis-cli -h 192.168.1.100 -p 6379 -a password ping
```

### 3. Python 测试

```python
from redis import Redis

# 测试连接
client = Redis.from_url("redis://localhost:6379/0")
client.ping()  # 应返回 True
```

---

## 常见问题

### Q1: 如何知道当前使用的 Redis 地址？

**A**: 启动服务时查看日志，或在代码中打印：

```python
from src.config import settings
print(f"当前 Redis URL: {settings.REDIS_URL}")
```

### Q2: .env 文件应该提交到 Git 吗？

**A**: **不应该！** .env 包含敏感信息（如密码），应该：

1. 将 `.env` 添加到 `.gitignore`
2. 只提交 `.env.example` 作为模板
3. 团队成员各自创建自己的 `.env`

```bash
# .gitignore
.env
```

### Q3: Docker 环境如何配置？

**A**: 在 `docker-compose.yml` 中配置：

```yaml
services:
  character-recognition-api:
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Q4: 如何配置多个 Worker 使用不同的 Redis？

**A**: 每个 Worker 独立配置：

```bash
# Worker 1
REDIS_URL=redis://localhost:6379/0 python worker.py

# Worker 2（使用不同数据库）
REDIS_URL=redis://localhost:6379/1 python worker.py
```

### Q5: Redis 连接失败怎么办？

**A**: 按以下步骤排查：

1. **检查 Redis 是否运行**
   ```bash
   redis-cli ping
   ```

2. **检查端口是否开放**
   ```bash
   telnet localhost 6379
   ```

3. **检查防火墙**
   ```bash
   # macOS
   sudo pfctl -s all
   
   # Linux
   sudo ufw status
   ```

4. **查看 Redis 日志**
   ```bash
   # macOS（Homebrew）
   tail -f /usr/local/var/log/redis.log
   
   # Linux
   tail -f /var/log/redis/redis-server.log
   ```

5. **测试网络连接**
   ```bash
   nc -zv 192.168.1.100 6379
   ```

---

## 生产环境建议

### 1. 使用 Redis 密码

```bash
# .env
REDIS_URL=redis://:your-strong-password@localhost:6379/0
```

### 2. 使用独立的 Redis 实例

不要与其他应用共享 Redis 实例，避免数据冲突。

### 3. 配置 Redis 持久化

```bash
# redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
```

### 4. 设置合理的 TTL

在 `.env` 中配置：
```bash
CACHE_TTL=3600  # 1小时
```

### 5. 监控 Redis

```bash
# 查看 Redis 信息
redis-cli info

# 查看内存使用
redis-cli info memory

# 查看连接数
redis-cli info clients
```

---

## 总结

### 快速配置流程

```bash
# 1. 复制配置模板
cp .env.example .env

# 2. 编辑 Redis 地址
vim .env
# 修改: REDIS_URL=redis://your-redis-host:6379/0

# 3. 启动服务
./start.sh

# 4. 验证连接
# 查看启动日志中的 "✓ Redis 连接正常"
```

### 最佳实践

- ✅ 开发环境：使用 `.env` 文件
- ✅ 生产环境：使用环境变量 + 进程管理器
- ✅ 敏感信息：永远不要提交到代码库
- ✅ 定期备份：配置 Redis 持久化
- ✅ 监控告警：监控 Redis 连接和性能

---

需要帮助？查看 [README_ENV.md](./README_ENV.md) 了解更多环境配置信息。

---

## 更新日志

### 2025-11-22：改进 Redis 连接检查

#### 问题
之前的 `start.sh` 使用 `redis-cli ping` 检查，只能检测 localhost:6379，不支持：
- 自定义端口
- 远程 Redis
- 带密码的 Redis
- .env 文件中的配置

#### 解决方案
现在使用 **Python + 实际配置** 检查：

```bash
# 改进后的检查逻辑
python -c "
from src.config import settings
from redis import Redis

client = Redis.from_url(settings.REDIS_URL)
client.ping()
"
```

#### 优势
- ✅ 使用应用实际的配置
- ✅ 支持所有 Redis URL 格式
- ✅ 自动读取 .env 文件
- ✅ 提供详细的错误信息
- ✅ 允许用户选择是否继续

#### 启动输出示例

**成功时**：
```
检查 Redis 连接...
✓ Redis 连接正常 (redis://localhost:6379/0)
```

**失败时**：
```
检查 Redis 连接...
✗ Redis 连接失败: Error 111 connecting to localhost:6379. Connection refused.
  配置的地址: redis://localhost:6379/0
  提示：
    1. 检查 Redis 是否运行
    2. 检查 REDIS_URL 配置是否正确
    3. 检查网络连接和防火墙

是否继续启动服务？[y/N]
```

这样即使 Redis 暂时不可用，用户也可以选择继续启动，稍后再连接。
