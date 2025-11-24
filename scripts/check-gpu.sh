#!/bin/bash

# GPU 环境检查脚本

echo "=== GPU 环境检查 ==="
echo ""

# 检查 NVIDIA 驱动
echo "1. 检查 NVIDIA 驱动..."
if command -v nvidia-smi &> /dev/null; then
    echo "✓ nvidia-smi 已找到"
    echo "驱动信息:"
    nvidia-smi --query-gpu=name,driver_version,memory.total,memory.free --format=csv
else
    echo "✗ nvidia-smi 未找到"
    echo "请安装 NVIDIA 驱动: https://www.nvidia.com/drivers/"
    exit 1
fi
echo ""

# 检查 Docker
echo "2. 检查 Docker..."
if command -v docker &> /dev/null; then
    echo "✓ Docker 已安装"
    echo "Docker 版本: $(docker --version)"
else
    echo "✗ Docker 未安装"
    exit 1
fi
echo ""

# 检查 nvidia-docker2
echo "3. 检查 nvidia-docker2 支持..."
if docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi &> /dev/null; then
    echo "✓ nvidia-docker2 支持正常"
else
    echo "✗ nvidia-docker2 支持异常"
    echo "请安装 nvidia-docker2: https://github.com/NVIDIA/nvidia-docker"
    exit 1
fi
echo ""

# 检查 CUDA 版本
echo "4. 检查 CUDA 版本兼容性..."
CUDA_VERSION=$(nvidia-smi | grep -oP 'CUDA Version: \K\d+\.\d+')
echo "系统 CUDA 版本: $CUDA_VERSION"

if [[ "$CUDA_VERSION" == "12."* ]] || [[ "$CUDA_VERSION" == "11."* ]]; then
    echo "✓ CUDA 版本兼容 (11.x 或 12.x)"
else
    echo "⚠ CUDA 版本可能不兼容，建议使用 11.x 或 12.x"
fi
echo ""

# 检查 GPU 内存
echo "5. 检查 GPU 内存..."
GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
echo "GPU 总内存: ${GPU_MEMORY} MB"

if [ "$GPU_MEMORY" -gt 4096 ]; then
    echo "✓ GPU 内存充足 (> 4GB)"
elif [ "$GPU_MEMORY" -gt 2048 ]; then
    echo "⚠ GPU 内存一般 (2-4GB)，可能影响大模型性能"
else
    echo "✗ GPU 内存不足 (< 2GB)，可能无法正常运行"
fi
echo ""

# 检查环境变量
echo "6. 检查环境变量..."
if [ -f ".env.gpu" ]; then
    echo "✓ .env.gpu 文件存在"
    source .env.gpu
    echo "CUDA_VISIBLE_DEVICES: ${CUDA_VISIBLE_DEVICES:-未设置}"
else
    echo "⚠ .env.gpu 文件不存在，将使用默认配置"
fi
echo ""

echo "=== 检查完成 ==="
echo ""
echo "如果所有检查都通过，可以运行："
echo "  pnpm docker:gpu:up    # 启动 GPU 环境"
echo "  pnpm dev:gpu          # 启动开发模式"