"""FastAPI 应用入口"""
import sys
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent))

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import uvicorn
import httpx

from src.cache import (
    cache_callback, cache_meta, cache_result, cache_stage,
    fetch_meta, fetch_result, enqueue_task, get_queue_length
)
from src.config import settings
from src.models import RecognitionRequest, RecognitionResponse
from src.recognizer import CharacterRecognizer
from src.utils import setup_logging
from src.task_manager import task_manager, TaskStatus

# 配置日志
setup_logging()

# 创建应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="中文小说人物识别与结构化抽取系统"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建识别器实例
recognizer = CharacterRecognizer()


# ======================== 任务进度与缓存辅助 ========================
class ProgressReporter:
    """统一管理进度上报与 Redis 缓存"""

    STAGE_PROGRESS = {
        "preprocess": 10,
        "ner": 60,
        "merge": 70,
        "coreference": 78,
        "relations": 92,
        "result": 96,
    }

    STAGE_MESSAGES = {
        "preprocess": "文本预处理完成",
        "ner": "人名识别中",
        "merge": "别名合并完成",
        "coreference": "指代消解完成",
        "relations": "关系抽取完成",
        "result": "结果组装完成",
    }

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.total_sentences = 0
        self.processed_sentences = 0
        self.progress = 0
        self.status = TaskStatus.PROCESSING
        self.message = ""

    def start(self) -> None:
        self._publish(progress=0, message="开始识别角色")

    def on_sentence(self, processed: int, total: int) -> None:
        self.total_sentences = max(self.total_sentences, total)
        self.processed_sentences = max(self.processed_sentences, processed)

        progress = self._calc_sentence_progress()
        message = f"逐句识别中 ({self.processed_sentences}/{self.total_sentences})"
        self._publish(progress=progress, message=message)

    def on_stage(self, stage: str, payload: Dict[str, Any]) -> None:
        # 写入阶段产物缓存
        cache_stage(self.task_id, stage, payload or {})

        if stage == "preprocess":
            self.total_sentences = payload.get("total_sentences", self.total_sentences)

        target_progress = self.STAGE_PROGRESS.get(stage)
        message = self.STAGE_MESSAGES.get(stage, "识别中")

        if target_progress is not None:
            self._publish(progress=target_progress, message=message)

    def complete(self, result: Dict[str, Any]) -> None:
        cache_result(self.task_id, result)
        self.status = TaskStatus.COMPLETED
        self._publish(
            status=TaskStatus.COMPLETED,
            progress=100,
            message="识别完成",
            result=result
        )

    def fail(self, error: str) -> None:
        self.status = TaskStatus.FAILED
        self._publish(
            status=TaskStatus.FAILED,
            progress=self.progress,
            message="识别失败",
            error=error
        )

    def meta_snapshot(self) -> Dict[str, Any]:
        return {
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "progress": self.progress,
            "message": self.message,
            "processed_sentences": self.processed_sentences,
            "total_sentences": self.total_sentences,
            "updated_at": datetime.utcnow().isoformat(),
        }

    def _calc_sentence_progress(self) -> int:
        if not self.total_sentences:
            return max(self.progress, self.STAGE_PROGRESS["preprocess"])

        ratio = min(self.processed_sentences / self.total_sentences, 1)
        span = self.STAGE_PROGRESS["ner"] - self.STAGE_PROGRESS["preprocess"]
        return max(self.progress, self.STAGE_PROGRESS["preprocess"] + int(ratio * span))

    def _publish(
        self,
        *,
        status: TaskStatus = TaskStatus.PROCESSING,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        if progress is not None:
            self.progress = max(self.progress, progress)

        self.status = status or self.status
        if message is not None:
            self.message = message

        task_manager.update_task(
            self.task_id,
            status=self.status,
            progress=self.progress if progress is not None else None,
            message=message,
            total_sentences=self.total_sentences,
            processed_sentences=self.processed_sentences,
            result=result,
            error=error
        )

        cache_meta(self.task_id, {
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "progress": self.progress,
            "message": self.message,
            "error": error,
            "processed_sentences": self.processed_sentences,
            "total_sentences": self.total_sentences,
            "updated_at": datetime.utcnow().isoformat(),
        })


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化"""
    logger.info(f"启动 {settings.APP_NAME} v{settings.APP_VERSION}")
    
    # 延迟初始化模型（第一次请求时再加载）
    # recognizer.initialize()


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.post("/api/recognize", response_model=RecognitionResponse)
async def recognize_characters(request: RecognitionRequest):
    """
    识别小说人物
    
    Args:
        request: 识别请求
        
    Returns:
        识别结果
    """
    try:
        logger.info(f"收到识别请求，文本长度: {len(request.text)}")
        
        # 执行识别
        result = recognizer.recognize(request)
        
        return result
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"识别失败: {e}\n{error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recognize/async")
async def recognize_characters_async(
    request: RecognitionRequest,
    callback_url: Optional[str] = None
):
    """
    异步识别小说人物（解耦版本：立即返回，任务入队）

    Args:
        request: 识别请求
        callback_url: 任务完成后的回调URL

    Returns:
        任务ID和状态
    """
    try:
        # 创建任务
        task_id = task_manager.create_task(callback_url)

        logger.info(f"创建异步识别任务: {task_id}, 文本长度: {len(request.text)}, 队列长度: {get_queue_length()}")

        # 将任务数据推入 Redis 队列
        task_data = {
            "task_id": task_id,
            "text": request.text,
            "book_id": request.book_id,
            "options": request.options.dict() if request.options else {},
            "callback_url": callback_url
        }

        success = enqueue_task(task_id, task_data)

        if not success:
            # 如果入队失败（比如 Redis 不可用），回退到内存模式
            logger.warning(f"任务 {task_id} 入队失败，回退到内存模式")
            import asyncio
            asyncio.create_task(process_recognition_task(task_id, request))

        return {
            "success": True,
            "task_id": task_id,
            "message": "任务已创建，正在队列中等待处理",
            "queue_length": get_queue_length()
        }

    except Exception as e:
        logger.error(f"创建任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recognize/async/{task_id}")
async def get_task_status(task_id: str):
    """
    获取任务状态（统一接口）

    支持跨进程查询：API进程或Worker进程创建的任务都可以查询到。
    优先从Redis读取（跨进程共享），fallback到cache_meta（兼容旧数据）。

    Args:
        task_id: 任务ID

    Returns:
        任务状态信息
    """
    # 优先从task_manager获取（Redis后端，跨进程共享）
    task = task_manager.get_task(task_id)

    if task:
        # 找到任务，返回完整信息
        data = task.dict()

        # 转换Enum为字符串
        if isinstance(data.get("status"), TaskStatus):
            data["status"] = data["status"].value

        # 如果有结果缓存，也包含进来
        cached_result = fetch_result(task_id)
        if cached_result:
            data["result"] = cached_result

        return {
            "success": True,
            "data": data,
            "source": "redis" if task_manager._use_redis else "memory"
        }

    # Fallback: 尝试从旧的cache_meta读取（向后兼容）
    cached_meta = fetch_meta(task_id)
    if cached_meta:
        cached_result = fetch_result(task_id)
        if cached_result:
            cached_meta["result"] = cached_result

        return {
            "success": True,
            "data": cached_meta,
            "source": "cache_meta_fallback"
        }

    # 任务不存在
    raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")


@app.get("/api/stats")
async def get_statistics():
    """
    获取统计信息

    注意：在Redis模式下，由于任务分布在多个进程，无法精确统计所有任务。
    这里仅显示基本信息。如需完整统计，可考虑使用Redis的key扫描或专门的统计表。
    """
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "storage_mode": "redis" if task_manager._use_redis else "memory",
        "models": {
            "ner": settings.NER_MODEL,
            "embedding": settings.EMBEDDING_MODEL
        },
        "config": {
            "similarity_threshold": settings.SIMILARITY_THRESHOLD,
            "max_coreference_distance": settings.MAX_COREFERENCE_DISTANCE
        },
        "queue": {
            "length": get_queue_length(),
            "note": "当前队列中等待处理的任务数"
        },
        "redis": {
            "enabled": settings.ENABLE_CACHE,
            "url": settings.REDIS_URL if settings.ENABLE_CACHE else None
        }
    }


async def process_recognition_task(task_id: str, request: RecognitionRequest):
    """
    后台处理识别任务
    
    Args:
        task_id: 任务ID
        request: 识别请求
    """
    reporter = ProgressReporter(task_id)

    try:
        reporter.start()

        logger.info(f"开始处理任务 {task_id}")
        result = recognizer.recognize(
            request,
            on_sentence=reporter.on_sentence,
            on_stage=reporter.on_stage
        )

        result_dict = result.dict()
        reporter.complete(result_dict)

        logger.info(f"任务 {task_id} 完成，识别到 {len(result.characters)} 个角色")

        callback_url = task_manager.get_callback_url(task_id)
        if callback_url:
            await send_callback(callback_url, task_id, result_dict, meta=reporter.meta_snapshot())

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"任务 {task_id} 失败: {e}\n{error_trace}")

        reporter.fail(str(e))

        callback_url = task_manager.get_callback_url(task_id)
        if callback_url:
            await send_callback(callback_url, task_id, None, error=str(e), meta=reporter.meta_snapshot())


async def send_callback(
    callback_url: str,
    task_id: str,
    result: Optional[dict] = None,
    error: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None
):
    """
    发送回调通知
    
    Args:
        callback_url: 回调URL
        task_id: 任务ID
        result: 识别结果
        error: 错误信息
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


if __name__ == "__main__":
    # 运行服务
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
