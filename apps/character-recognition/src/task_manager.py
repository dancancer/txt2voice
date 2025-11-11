"""异步任务管理器"""
import asyncio
import uuid
from typing import Dict, Optional, Callable, Any
from datetime import datetime
from enum import Enum
from loguru import logger
from pydantic import BaseModel


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
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskManager:
    """异步任务管理器"""
    
    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.callbacks: Dict[str, Callable] = {}
        
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
        
        self.tasks[task_id] = task_info
        
        if callback_url:
            self.callbacks[task_id] = callback_url
        
        logger.info(f"创建任务: {task_id}")
        return task_id
    
    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        """获取任务信息"""
        return self.tasks.get(task_id)
    
    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """更新任务状态"""
        task = self.tasks.get(task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return
        
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
        
        if result:
            task.result = result
        
        if error:
            task.error = error
        
        logger.info(f"更新任务 {task_id}: status={status}, progress={progress}, message={message}")
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """清理旧任务"""
        now = datetime.now()
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if task.completed_at:
                age = (now - task.completed_at).total_seconds() / 3600
                if age > max_age_hours:
                    to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]
            if task_id in self.callbacks:
                del self.callbacks[task_id]
        
        if to_remove:
            logger.info(f"清理了 {len(to_remove)} 个旧任务")
    
    def get_callback_url(self, task_id: str) -> Optional[str]:
        """获取任务的回调URL"""
        return self.callbacks.get(task_id)


# 全局任务管理器实例
task_manager = TaskManager()
