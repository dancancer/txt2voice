"""异步任务管理器（基于Redis的跨进程共享版本）"""
import json
import uuid
from typing import Dict, Optional, Any
from datetime import datetime
from enum import Enum
from loguru import logger
from pydantic import BaseModel

from .config import settings

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover
    Redis = None  # type: ignore
    RedisError = Exception  # type: ignore


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskInfo(BaseModel):
    """任务信息"""
    task_id: str
    status: TaskStatus
    progress: int = 0
    message: str = ""
    total_sentences: int = 0
    processed_sentences: int = 0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        use_enum_values = False  # 保留Enum类型便于序列化


class TaskManager:
    """
    异步任务管理器（Redis版本）

    通过Redis存储实现跨进程任务状态共享，解决API进程与Worker进程的状态同步问题。
    当Redis不可用时，自动降级到内存模式（仅支持单进程）。
    """

    def __init__(self):
        """初始化任务管理器，尝试连接Redis"""
        self._redis_client: Optional["Redis"] = None
        self._memory_tasks: Dict[str, TaskInfo] = {}  # fallback内存存储
        self._memory_callbacks: Dict[str, str] = {}
        self._use_redis = False

        # 尝试初始化Redis
        if settings.ENABLE_CACHE and settings.REDIS_URL and Redis is not None:
            try:
                self._redis_client = Redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=3
                )
                # 测试连接
                self._redis_client.ping()
                self._use_redis = True
                logger.info("✅ TaskManager 使用 Redis 存储（支持跨进程）")
            except Exception as error:
                logger.warning(f"Redis 连接失败，降级到内存模式: {error}")
                self._use_redis = False
        else:
            logger.warning("Redis 未配置，使用内存模式（仅支持单进程）")

    def _task_key(self, task_id: str) -> str:
        """任务信息的Redis key"""
        return f"{settings.CACHE_PREFIX}:task:{task_id}:info"

    def _callback_key(self, task_id: str) -> str:
        """回调URL的Redis key"""
        return f"{settings.CACHE_PREFIX}:task:{task_id}:callback"

    def _serialize_task(self, task: TaskInfo) -> str:
        """序列化任务信息"""
        data = task.dict()
        # 转换datetime为ISO格式字符串
        for field in ['created_at', 'started_at', 'completed_at']:
            if data.get(field):
                data[field] = data[field].isoformat()
        # 转换Enum为字符串
        data['status'] = task.status.value
        return json.dumps(data, ensure_ascii=False)

    def _deserialize_task(self, data_str: str) -> TaskInfo:
        """反序列化任务信息"""
        data = json.loads(data_str)
        # 转换ISO字符串为datetime
        for field in ['created_at', 'started_at', 'completed_at']:
            if data.get(field):
                data[field] = datetime.fromisoformat(data[field])
        # 转换字符串为Enum
        data['status'] = TaskStatus(data['status'])
        return TaskInfo(**data)

    def create_task(self, callback_url: Optional[str] = None) -> str:
        """
        创建新任务

        Args:
            callback_url: 任务完成后的回调URL

        Returns:
            任务ID
        """
        task_id = str(uuid.uuid4())

        task_info = TaskInfo(
            task_id=task_id,
            status=TaskStatus.PENDING,
            created_at=datetime.now()
        )

        if self._use_redis and self._redis_client:
            try:
                # 存储到Redis
                key = self._task_key(task_id)
                self._redis_client.set(
                    key,
                    self._serialize_task(task_info),
                    ex=settings.CACHE_TTL
                )

                # 存储回调URL
                if callback_url:
                    callback_key = self._callback_key(task_id)
                    self._redis_client.set(callback_key, callback_url, ex=settings.CACHE_TTL)

                logger.info(f"✅ 创建任务 (Redis): {task_id}")
            except RedisError as error:
                logger.error(f"Redis写入失败，降级到内存: {error}")
                self._memory_tasks[task_id] = task_info
                if callback_url:
                    self._memory_callbacks[task_id] = callback_url
        else:
            # 内存模式
            self._memory_tasks[task_id] = task_info
            if callback_url:
                self._memory_callbacks[task_id] = callback_url
            logger.info(f"创建任务 (内存): {task_id}")

        return task_id

    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        """
        获取任务信息

        Args:
            task_id: 任务ID

        Returns:
            任务信息，不存在返回None
        """
        if self._use_redis and self._redis_client:
            try:
                key = self._task_key(task_id)
                data = self._redis_client.get(key)
                if data:
                    return self._deserialize_task(data)
                return None
            except RedisError as error:
                logger.warning(f"Redis读取失败: {error}")
                # fallback到内存
                return self._memory_tasks.get(task_id)
        else:
            return self._memory_tasks.get(task_id)

    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        total_sentences: Optional[int] = None,
        processed_sentences: Optional[int] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """
        更新任务状态

        Args:
            task_id: 任务ID
            status: 新状态
            progress: 进度（0-100）
            message: 进度消息
            total_sentences: 总句子数
            processed_sentences: 已处理句子数
            result: 最终结果
            error: 错误信息
        """
        # 获取现有任务
        task = self.get_task(task_id)
        if not task:
            # 如果任务不存在，尝试创建一个临时任务（支持Worker进程场景）
            logger.debug(f"任务 {task_id} 不存在，创建临时任务记录")
            task = TaskInfo(
                task_id=task_id,
                status=TaskStatus.PROCESSING,
                created_at=datetime.now()
            )

        # 更新字段
        if status:
            task.status = status
            if status == TaskStatus.PROCESSING and not task.started_at:
                task.started_at = datetime.now()
            elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                task.completed_at = datetime.now()

        if progress is not None:
            task.progress = progress

        if message:
            task.message = message

        if total_sentences is not None:
            task.total_sentences = total_sentences

        if processed_sentences is not None:
            task.processed_sentences = processed_sentences

        if result:
            task.result = result

        if error:
            task.error = error

        # 保存更新
        if self._use_redis and self._redis_client:
            try:
                key = self._task_key(task_id)
                self._redis_client.set(
                    key,
                    self._serialize_task(task),
                    ex=settings.CACHE_TTL
                )
                logger.debug(f"更新任务 (Redis) {task_id}: status={status}, progress={progress}")
            except RedisError as error:
                logger.error(f"Redis更新失败: {error}")
                # fallback到内存
                self._memory_tasks[task_id] = task
        else:
            self._memory_tasks[task_id] = task
            logger.debug(f"更新任务 (内存) {task_id}: status={status}, progress={progress}")

    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """
        清理旧任务

        注意：Redis模式下任务会自动过期（通过TTL），此方法主要清理内存模式的数据。

        Args:
            max_age_hours: 最大保留时间（小时）
        """
        if self._use_redis:
            logger.debug("Redis模式下任务自动过期，无需手动清理")
            return

        # 清理内存中的旧任务
        now = datetime.now()
        to_remove = []

        for task_id, task in self._memory_tasks.items():
            if task.completed_at:
                age = (now - task.completed_at).total_seconds() / 3600
                if age > max_age_hours:
                    to_remove.append(task_id)

        for task_id in to_remove:
            del self._memory_tasks[task_id]
            if task_id in self._memory_callbacks:
                del self._memory_callbacks[task_id]

        if to_remove:
            logger.info(f"清理了 {len(to_remove)} 个旧任务")

    def get_callback_url(self, task_id: str) -> Optional[str]:
        """
        获取任务的回调URL

        Args:
            task_id: 任务ID

        Returns:
            回调URL，不存在返回None
        """
        if self._use_redis and self._redis_client:
            try:
                key = self._callback_key(task_id)
                return self._redis_client.get(key)
            except RedisError as error:
                logger.warning(f"Redis读取回调URL失败: {error}")
                return self._memory_callbacks.get(task_id)
        else:
            return self._memory_callbacks.get(task_id)


# 全局任务管理器实例
task_manager = TaskManager()
