#!/usr/bin/env python
"""
启动脚本 - 同时启动 API 服务和 Worker
适用于开发环境或单机部署
"""
import sys
import os
import signal
import multiprocessing
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent))

# 设置环境变量
os.environ['HANLP_URL'] = 'https://ftp.hankcs.com/hanlp/'
os.environ['TF_USE_LEGACY_KERAS'] = '1'

import uvicorn
from loguru import logger

from src.config import settings


def start_api():
    """启动 API 服务"""
    logger.info("🚀 启动 API 服务...")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )


def start_worker():
    """启动 Worker"""
    from worker import main as worker_main
    logger.info("🚀 启动 Worker...")
    worker_main()


def signal_handler(signum, frame):
    """处理退出信号"""
    logger.info(f"收到退出信号 {signum}，正在关闭服务...")
    sys.exit(0)


def main():
    """主入口"""
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("=" * 60)
    logger.info(f"Character Recognition Service v{settings.APP_VERSION}")
    logger.info("=" * 60)
    logger.info(f"API 地址: http://{settings.HOST}:{settings.PORT}")
    logger.info(f"Redis: {settings.REDIS_URL}")
    logger.info(f"模式: {'开发模式' if settings.DEBUG else '生产模式'}")
    logger.info(f"环境变量:")
    logger.info(f"  - HANLP_URL: {os.environ.get('HANLP_URL', '未设置')}")
    logger.info(f"  - TF_USE_LEGACY_KERAS: {os.environ.get('TF_USE_LEGACY_KERAS', '未设置')}")
    logger.info("=" * 60)

    # 创建 API 进程
    api_process = multiprocessing.Process(target=start_api, name="API")

    # 创建 Worker 进程
    worker_process = multiprocessing.Process(target=start_worker, name="Worker")

    try:
        # 启动进程
        api_process.start()
        worker_process.start()

        logger.info("✅ 所有服务已启动")
        logger.info("按 Ctrl+C 停止服务")

        # 等待进程结束
        api_process.join()
        worker_process.join()

    except KeyboardInterrupt:
        logger.info("收到中断信号，正在关闭...")
    finally:
        # 终止进程
        if api_process.is_alive():
            api_process.terminate()
            api_process.join(timeout=5)

        if worker_process.is_alive():
            worker_process.terminate()
            worker_process.join(timeout=5)

        logger.info("✅ 所有服务已关闭")


if __name__ == "__main__":
    main()
