#!/bin/bash
# Character Recognition Service 启动脚本

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============ 配置区域 ============
# 虚拟环境路径（可以通过命令行参数或环境变量覆盖）
VENV_PATH="${VENV_PATH:-.venv-macos-tf210}"

# 环境设置
echo -e "${YELLOW}设置环境变量...${NC}"

# 激活虚拟环境
if [ -f "$VENV_PATH/bin/activate" ]; then
    source "$VENV_PATH/bin/activate"
    echo -e "${GREEN}✓ 虚拟环境已激活: $VENV_PATH${NC}"
else
    echo -e "${RED}✗ 虚拟环境不存在: $VENV_PATH${NC}"
    echo -e "${YELLOW}  提示：可以通过以下方式指定虚拟环境路径：${NC}"
    echo -e "${YELLOW}    1. 设置环境变量: VENV_PATH=/path/to/venv ./start.sh${NC}"
    echo -e "${YELLOW}    2. 修改脚本中的 VENV_PATH 变量${NC}"
    echo -e "${YELLOW}    3. 不使用虚拟环境: VENV_PATH='' ./start.sh${NC}"

    read -p "是否继续（不使用虚拟环境）？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 设置 HanLP 下载源
export HANLP_URL="${HANLP_URL:-https://ftp.hankcs.com/hanlp/}"
echo -e "${GREEN}✓ HANLP_URL=${HANLP_URL}${NC}"

# 设置 TensorFlow 兼容性
export TF_USE_LEGACY_KERAS="${TF_USE_LEGACY_KERAS:-1}"
echo -e "${GREEN}✓ TF_USE_LEGACY_KERAS=${TF_USE_LEGACY_KERAS}${NC}"

# Redis 配置（从 .env 或环境变量读取，或使用默认值）
REDIS_URL_DEFAULT="redis://localhost:6379/0"
REDIS_URL_DISPLAY="${REDIS_URL:-$REDIS_URL_DEFAULT}"
echo -e "${GREEN}✓ REDIS_URL=${REDIS_URL_DISPLAY}${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}  (从 .env 文件读取配置)${NC}"
else
    echo -e "${YELLOW}  (使用默认配置，可创建 .env 文件自定义)${NC}"
    echo -e "${YELLOW}  提示: cp .env.example .env${NC}"
fi

# 信号处理
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"

    # 终止所有子进程
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null
    fi

    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null
    fi

    wait
    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "======================================================================"
echo "  Character Recognition Service"
echo "======================================================================"

# 检查 Redis 连接
echo -e "${YELLOW}检查 Redis 连接...${NC}"

# 使用 Python 检查 Redis（使用实际的配置）
REDIS_CHECK=$(python -c "
import sys
import os

# 添加当前目录到路径以导入配置
sys.path.insert(0, '.')

try:
    # 尝试导入配置
    from src.config import settings
    redis_url = settings.REDIS_URL
except Exception as e:
    # 如果配置导入失败，使用环境变量或默认值
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

try:
    from redis import Redis
    from redis.exceptions import RedisError

    client = Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
    client.ping()
    print('OK')
    sys.exit(0)
except ModuleNotFoundError:
    print('WARNING: redis-py not installed, skipping check')
    sys.exit(0)
except RedisError as e:
    print(f'ERROR: {e}')
    sys.exit(1)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>&1)

REDIS_CHECK_CODE=$?

if [ $REDIS_CHECK_CODE -eq 0 ]; then
    if [[ $REDIS_CHECK == "OK" ]]; then
        echo -e "${GREEN}✓ Redis 连接正常 (${REDIS_URL_DISPLAY})${NC}"
    elif [[ $REDIS_CHECK == WARNING* ]]; then
        echo -e "${YELLOW}⚠ $REDIS_CHECK${NC}"
        echo -e "${YELLOW}  将在启动时检查 Redis 连接${NC}"
    fi
else
    echo -e "${RED}✗ Redis 连接失败: $REDIS_CHECK${NC}"
    echo -e "${RED}  配置的地址: ${REDIS_URL_DISPLAY}${NC}"
    echo -e "${YELLOW}  提示：${NC}"
    echo -e "${YELLOW}    1. 检查 Redis 是否运行${NC}"
    echo -e "${YELLOW}    2. 检查 REDIS_URL 配置是否正确${NC}"
    echo -e "${YELLOW}    3. 检查网络连接和防火墙${NC}"
    echo ""

    read -p "是否继续启动服务？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 启动 API 服务
echo -e "${YELLOW}启动 API 服务...${NC}"
python main.py > api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}✓ API 服务已启动 (PID: $API_PID)${NC}"

# 等待 API 启动
sleep 2

# 启动 Worker
echo -e "${YELLOW}启动 Worker...${NC}"
python worker.py > worker.log 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}✓ Worker 已启动 (PID: $WORKER_PID)${NC}"

echo "======================================================================"
echo -e "${GREEN}所有服务已启动${NC}"
echo "  - API: http://0.0.0.0:8001"
echo "  - API PID: $API_PID (日志: api.log)"
echo "  - Worker PID: $WORKER_PID (日志: worker.log)"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo "======================================================================"

# 等待进程
wait
