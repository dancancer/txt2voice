#!/bin/sh
set -e

ARCH="$(uname -m)"

# ============================== #
# Apple Silicon 数学加速环境开关 #
# ============================== #
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  export OPENBLAS_CORETYPE="${OPENBLAS_CORETYPE:-ARMV8}"
  export OMP_NUM_THREADS="${OMP_NUM_THREADS:-$(getconf _NPROCESSORS_ONLN)}"
  export TF_ENABLE_ONEDNN_OPTS="${TF_ENABLE_ONEDNN_OPTS:-1}"
  export TF_ONEDNN_ENABLE_FAST_MATH="${TF_ONEDNN_ENABLE_FAST_MATH:-1}"
fi

# HanLP 模型下载镜像（默认使用官方 FTP 镜像）
export HANLP_URL="${HANLP_URL:-https://ftp.hankcs.com/hanlp/}"

# 使用 TensorFlow Keras 旧行为，兼容 HanLP 依赖的经典层实现
export TF_USE_LEGACY_KERAS="${TF_USE_LEGACY_KERAS:-1}"

exec "$@"
