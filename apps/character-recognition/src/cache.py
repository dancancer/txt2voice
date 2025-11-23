"""Redis 缓存工具
使用同步客户端便于在耗时的识别任务中插入进度与结果缓存。
"""

import json
from typing import Any, Dict, Optional

from loguru import logger

from .config import settings

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover - 仅在缺少依赖时触发
    Redis = None  # type: ignore
    RedisError = Exception  # type: ignore


_redis_client: Optional["Redis"] = None


def _get_client() -> Optional["Redis"]:
    """获取 Redis 客户端；未配置或依赖缺失时返回 None。"""
    global _redis_client

    if not settings.ENABLE_CACHE or not settings.REDIS_URL or Redis is None:
        return None

    if _redis_client is None:
        try:
            _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as error:  # pragma: no cover - 连接失败时仅记录
            logger.warning(f"初始化 Redis 失败: {error}")
            return None

    return _redis_client


def _serialize(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def cache_meta(task_id: str, meta: Dict[str, Any]) -> None:
    """缓存任务元数据（状态、进度、统计）。"""
    client = _get_client()
    if not client:
        return

    key = f"{settings.CACHE_PREFIX}:{task_id}:meta"
    try:
        client.set(key, _serialize(meta), ex=settings.CACHE_TTL)
    except RedisError as error:  # pragma: no cover - 仅记录缓存失败
        logger.warning(f"写入 Redis meta 失败: {error}")


def cache_stage(task_id: str, stage: str, payload: Dict[str, Any]) -> None:
    """缓存阶段产物，便于诊断或回放。"""
    client = _get_client()
    if not client:
        return

    key = f"{settings.CACHE_PREFIX}:{task_id}:stage:{stage}"
    try:
        client.set(key, _serialize(payload), ex=settings.CACHE_TTL)
    except RedisError as error:  # pragma: no cover - 仅记录缓存失败
        logger.warning(f"写入 Redis 阶段数据失败: {error}")


def cache_result(task_id: str, result: Dict[str, Any]) -> None:
    """缓存最终结果，回调失败时可直接从 Redis 取回。"""
    client = _get_client()
    if not client:
        return

    key = f"{settings.CACHE_PREFIX}:{task_id}:result"
    try:
        client.set(key, _serialize(result), ex=settings.CACHE_TTL)
    except RedisError as error:  # pragma: no cover - 仅记录缓存失败
        logger.warning(f"写入 Redis 结果失败: {error}")


def cache_callback(task_id: str, payload: Dict[str, Any]) -> None:
    """缓存回调参数，便于调试或重试。"""
    client = _get_client()
    if not client:
        return

    key = f"{settings.CACHE_PREFIX}:{task_id}:callback"
    try:
        client.set(key, _serialize(payload), ex=settings.CACHE_TTL)
    except RedisError as error:  # pragma: no cover - 仅记录缓存失败
        logger.warning(f"写入 Redis 回调数据失败: {error}")


def _fetch_json(key: str) -> Optional[Dict[str, Any]]:
    client = _get_client()
    if not client:
        return None

    try:
        raw = client.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except RedisError as error:  # pragma: no cover
        logger.warning(f"读取 Redis 失败: {error}")
        return None


def fetch_meta(task_id: str) -> Optional[Dict[str, Any]]:
    key = f"{settings.CACHE_PREFIX}:{task_id}:meta"
    return _fetch_json(key)


def fetch_result(task_id: str) -> Optional[Dict[str, Any]]:
    key = f"{settings.CACHE_PREFIX}:{task_id}:result"
    return _fetch_json(key)


def fetch_stage(task_id: str, stage: str) -> Optional[Dict[str, Any]]:
    key = f"{settings.CACHE_PREFIX}:{task_id}:stage:{stage}"
    return _fetch_json(key)


# ======================== 任务队列功能 ========================

TASK_QUEUE_KEY = f"{settings.CACHE_PREFIX}:task_queue"


def enqueue_task(task_id: str, task_data: Dict[str, Any]) -> bool:
    """
    将任务推入 Redis 队列

    Args:
        task_id: 任务ID
        task_data: 任务数据（包含 text, book_id, options, callback_url 等）

    Returns:
        是否成功入队
    """
    client = _get_client()
    if not client:
        logger.warning("Redis 未配置，无法入队任务")
        return False

    try:
        # 将任务数据存储到单独的key
        task_key = f"{settings.CACHE_PREFIX}:{task_id}:task_data"
        client.set(task_key, _serialize(task_data), ex=settings.CACHE_TTL)

        # 将任务ID推入队列
        client.rpush(TASK_QUEUE_KEY, task_id)
        logger.info(f"任务 {task_id} 已入队")
        return True
    except RedisError as error:
        logger.error(f"入队任务失败: {error}")
        return False


def dequeue_task(timeout: int = 0) -> Optional[tuple[str, Dict[str, Any]]]:
    """
    从 Redis 队列中取出任务（阻塞式）

    Args:
        timeout: 超时时间（秒），0表示无限等待

    Returns:
        (task_id, task_data) 或 None
    """
    client = _get_client()
    if not client:
        return None

    try:
        # 使用 BLPOP 阻塞式获取
        result = client.blpop(TASK_QUEUE_KEY, timeout=timeout)
        if not result:
            return None

        _, task_id = result

        # 获取任务数据
        task_key = f"{settings.CACHE_PREFIX}:{task_id}:task_data"
        task_data_str = client.get(task_key)

        if not task_data_str:
            logger.warning(f"任务 {task_id} 数据不存在")
            return None

        task_data = json.loads(task_data_str)

        # 删除任务数据（已被取出）
        client.delete(task_key)

        return (task_id, task_data)
    except RedisError as error:
        logger.error(f"出队任务失败: {error}")
        return None


def get_queue_length() -> int:
    """获取队列长度"""
    client = _get_client()
    if not client:
        return 0

    try:
        return client.llen(TASK_QUEUE_KEY)
    except RedisError:
        return 0
