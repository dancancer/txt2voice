"""独立的任务处理 Worker
从 Redis 队列中获取任务并处理，完全解耦于 FastAPI 主进程
"""
import sys
import signal
import time
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
import httpx
from loguru import logger

from src.cache import dequeue_task, cache_result, cache_callback
from src.config import settings
from src.models import RecognitionRequest, RecognitionOptions
from src.recognizer import CharacterRecognizer
from src.utils import setup_logging
from src.task_manager import task_manager
from main import ProgressReporter


# 配置日志
setup_logging()

# 创建识别器实例
recognizer = CharacterRecognizer()

# Worker 运行标志
running = True


def signal_handler(signum, frame):
    """处理退出信号"""
    global running
    logger.info(f"收到退出信号 {signum}，准备优雅关闭...")
    running = False


# 注册信号处理
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


async def send_callback(
    callback_url: str,
    task_id: str,
    result: dict = None,
    error: str = None,
    meta: dict = None
):
    """
    发送回调通知

    Args:
        callback_url: 回调URL
        task_id: 任务ID
        result: 识别结果
        error: 错误信息
        meta: 元数据
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "task_id": task_id,
                "status": "completed" if result else "failed",
                "result": result,
                "error": error,
                "meta": meta or {},
            }

            # 发送前先缓存回调参数
            cache_callback(task_id, payload)

            response = await client.post(callback_url, json=payload)

            if response.status_code == 200:
                logger.info(f"回调成功: {callback_url}")
            else:
                logger.warning(f"回调失败: {callback_url}, status={response.status_code}")

    except Exception as e:
        logger.error(f"发送回调失败: {callback_url}, error={e}")


async def process_task(task_id: str, task_data: dict):
    """
    处理单个识别任务

    Args:
        task_id: 任务ID
        task_data: 任务数据
    """
    reporter = ProgressReporter(task_id)

    try:
        # 构造 RecognitionRequest
        options_dict = task_data.get("options", {})
        options = RecognitionOptions(**options_dict) if options_dict else None

        request = RecognitionRequest(
            text=task_data["text"],
            book_id=task_data["book_id"],
            options=options
        )

        reporter.start()

        logger.info(f"开始处理任务 {task_id}, 文本长度: {len(request.text)}")

        # 执行识别
        result = recognizer.recognize(
            request,
            on_sentence=reporter.on_sentence,
            on_stage=reporter.on_stage
        )

        result_dict = result.dict()
        reporter.complete(result_dict)

        logger.info(f"任务 {task_id} 完成，识别到 {len(result.characters)} 个角色")

        # 输出详细结果到日志（便于验证）
        logger.info("=" * 80)
        logger.info(f"📊 任务 {task_id} 识别结果详情:")
        for idx, char in enumerate(result.characters[:10], 1):  # 只显示前10个
            importance = char.get('characteristics', {}).get('importance', 'minor')
            logger.info(
                f"  {idx}. 【{importance.upper()}】 {char['canonical_name']}: "
                f"提及{char.get('mentions', 0)}次, 对话{char.get('quotes', 0)}次"
            )
        stats = result.statistics
        logger.info(f"📈 统计: 总角色{stats.total_characters}, 总提及{stats.total_mentions}, "
                   f"总对话{stats.total_dialogues}, 耗时{stats.processing_time:.2f}s")
        logger.info("=" * 80)

        # 缓存结果到 Redis
        cache_result(task_id, result_dict)

        # 发送回调
        callback_url = task_data.get("callback_url")
        if callback_url:
            await send_callback(callback_url, task_id, result_dict, meta=reporter.meta_snapshot())
        else:
            logger.info(f"任务 {task_id} 无回调URL，结果已缓存到 Redis")

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"任务 {task_id} 失败: {e}\n{error_trace}")

        reporter.fail(str(e))

        # 发送失败回调
        callback_url = task_data.get("callback_url")
        if callback_url:
            await send_callback(callback_url, task_id, None, error=str(e), meta=reporter.meta_snapshot())


async def worker_loop():
    """Worker 主循环"""
    logger.info("🚀 Worker 启动成功，开始监听任务队列...")

    consecutive_errors = 0
    max_consecutive_errors = 5

    while running:
        try:
            # 从队列中取任务（阻塞5秒）
            task_info = dequeue_task(timeout=5)

            if task_info is None:
                # 队列为空，继续等待
                continue

            task_id, task_data = task_info
            logger.info(f"📥 获取到任务: {task_id}")

            # 处理任务
            await process_task(task_id, task_data)

            # 重置错误计数
            consecutive_errors = 0

        except KeyboardInterrupt:
            logger.info("收到键盘中断，退出...")
            break

        except Exception as e:
            consecutive_errors += 1
            logger.error(f"Worker 处理异常: {e}")

            if consecutive_errors >= max_consecutive_errors:
                logger.error(f"连续失败 {consecutive_errors} 次，Worker 退出")
                break

            # 等待一段时间后重试
            await asyncio.sleep(5)

    logger.info("Worker 已停止")


def main():
    """主入口"""
    logger.info(f"Character Recognition Worker v{settings.APP_VERSION}")
    logger.info(f"Redis URL: {settings.REDIS_URL}")
    logger.info(f"缓存启用: {settings.ENABLE_CACHE}")

    # 检查 Redis 连接
    from src.cache import _get_client
    client = _get_client()
    if not client:
        logger.error("❌ Redis 未配置或连接失败，Worker 无法启动")
        sys.exit(1)

    try:
        client.ping()
        logger.info("✅ Redis 连接正常")
    except Exception as e:
        logger.error(f"❌ Redis 连接失败: {e}")
        sys.exit(1)

    # 运行 Worker
    try:
        asyncio.run(worker_loop())
    except Exception as e:
        logger.error(f"Worker 异常退出: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
