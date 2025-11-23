# 环境配置说明

## 快速启动

### 使用默认配置
```bash
./start.sh
```
默认使用 `.venv-macos-tf210` 虚拟环境。

### 自定义虚拟环境路径
```bash
# 方式 1: 环境变量
VENV_PATH=/path/to/your/venv ./start.sh

# 方式 2: 修改脚本
# 编辑 start.sh，修改第 15 行：
# VENV_PATH="${VENV_PATH:-.venv-macos-tf210}"
```

### 不使用虚拟环境
```bash
VENV_PATH='' ./start.sh
```

## 环境变量说明

### 必需的环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `HANLP_URL` | `https://ftp.hankcs.com/hanlp/` | HanLP 模型下载源 |
| `TF_USE_LEGACY_KERAS` | `1` | TensorFlow 兼容模式 |

### 可选的环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VENV_PATH` | `.venv-macos-tf210` | 虚拟环境路径 |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis 连接地址 |
| `PORT` | `8001` | API 服务端口 |
| `DEBUG` | `True` | 调试模式 |

## 使用示例

### 示例 1：使用不同的虚拟环境
```bash
VENV_PATH=.venv ./start.sh
```

### 示例 2：修改 Redis 地址
```bash
REDIS_URL=redis://192.168.1.100:6379/0 ./start.sh
```

### 示例 3：修改 API 端口
```bash
PORT=8002 ./start.sh
```

### 示例 4：组合使用
```bash
VENV_PATH=/opt/venv \
REDIS_URL=redis://remote-server:6379/0 \
PORT=8002 \
./start.sh
```

## Python 版本（start.py）

Python 版本的启动脚本会自动设置以下环境变量：
- `HANLP_URL=https://ftp.hankcs.com/hanlp/`
- `TF_USE_LEGACY_KERAS=1`

如需修改其他配置，可以设置环境变量后运行：

```bash
REDIS_URL=redis://remote:6379/0 python start.py
```

或在运行前 export：

```bash
export REDIS_URL=redis://remote:6379/0
export PORT=8002
python start.py
```

## 分开启动时的环境设置

如果分别启动 API 和 Worker，需要在每个进程中设置环境变量：

### 启动 API
```bash
source .venv-macos-tf210/bin/activate
export HANLP_URL=https://ftp.hankcs.com/hanlp/
export TF_USE_LEGACY_KERAS=1
python main.py
```

### 启动 Worker
```bash
source .venv-macos-tf210/bin/activate
export HANLP_URL=https://ftp.hankcs.com/hanlp/
export TF_USE_LEGACY_KERAS=1
python worker.py
```

## Docker 环境

如果使用 Docker，在 docker-compose.yml 中设置：

```yaml
services:
  character-recognition:
    environment:
      - HANLP_URL=https://ftp.hankcs.com/hanlp/
      - TF_USE_LEGACY_KERAS=1
      - REDIS_URL=redis://redis:6379/0
```

## 故障排查

### 虚拟环境不存在
```
✗ 虚拟环境不存在: .venv-macos-tf210
```
**解决方案**：
1. 创建虚拟环境：`python -m venv .venv-macos-tf210`
2. 或使用其他路径：`VENV_PATH=/path/to/venv ./start.sh`
3. 或不使用虚拟环境：`VENV_PATH='' ./start.sh`

### HanLP 下载失败
```
✗ HanLP 模型下载失败
```
**解决方案**：
检查 `HANLP_URL` 是否正确：
```bash
echo $HANLP_URL
# 应输出: https://ftp.hankcs.com/hanlp/
```

### TensorFlow Keras 错误
```
AttributeError: module 'keras' has no attribute 'xxx'
```
**解决方案**：
确保设置了 `TF_USE_LEGACY_KERAS=1`：
```bash
echo $TF_USE_LEGACY_KERAS
# 应输出: 1
```

## 配置优先级

环境变量的优先级（从高到低）：
1. 命令行设置：`VENV_PATH=/path ./start.sh`
2. Shell export：`export VENV_PATH=/path`
3. 脚本默认值：`VENV_PATH="${VENV_PATH:-.venv-macos-tf210}"`
4. config.py 配置文件

## 建议

### 开发环境
- 使用 `start.sh` 或 `start.py` 一键启动
- 默认配置通常已足够

### 生产环境
- 使用进程管理器（Supervisor/systemd）
- 在配置文件中明确指定所有环境变量
- 不要依赖脚本默认值

### 示例 Supervisor 配置
```ini
[program:character-recognition-api]
command=/opt/venv/bin/python main.py
directory=/opt/character-recognition
environment=
    HANLP_URL="https://ftp.hankcs.com/hanlp/",
    TF_USE_LEGACY_KERAS="1",
    REDIS_URL="redis://localhost:6379/0",
    PORT="8001"
```
