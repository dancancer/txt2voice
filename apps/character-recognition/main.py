"""FastAPI 应用入口"""
import sys
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import uvicorn
import httpx
from typing import Optional

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
    background_tasks: BackgroundTasks,
    callback_url: Optional[str] = None
):
    """
    异步识别小说人物
    
    Args:
        request: 识别请求
        background_tasks: FastAPI 后台任务
        callback_url: 任务完成后的回调URL
        
    Returns:
        任务ID和状态
    """
    try:
        # 创建任务
        task_id = task_manager.create_task(callback_url)
        
        logger.info(f"创建异步识别任务: {task_id}, 文本长度: {len(request.text)}")
        
        # 添加后台任务
        background_tasks.add_task(
            process_recognition_task,
            task_id,
            request
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "message": "任务已创建，正在处理中"
        }
        
    except Exception as e:
        logger.error(f"创建任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recognize/async/{task_id}")
async def get_task_status(task_id: str):
    """
    获取任务状态
    
    Args:
        task_id: 任务ID
        
    Returns:
        任务状态信息
    """
    task = task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "success": True,
        "data": task.dict()
    }


@app.get("/api/stats")
async def get_statistics():
    """获取统计信息"""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "models": {
            "ner": settings.NER_MODEL,
            "embedding": settings.EMBEDDING_MODEL
        },
        "config": {
            "similarity_threshold": settings.SIMILARITY_THRESHOLD,
            "max_coreference_distance": settings.MAX_COREFERENCE_DISTANCE
        },
        "tasks": {
            "total": len(task_manager.tasks),
            "pending": sum(1 for t in task_manager.tasks.values() if t.status == TaskStatus.PENDING),
            "processing": sum(1 for t in task_manager.tasks.values() if t.status == TaskStatus.PROCESSING),
            "completed": sum(1 for t in task_manager.tasks.values() if t.status == TaskStatus.COMPLETED),
            "failed": sum(1 for t in task_manager.tasks.values() if t.status == TaskStatus.FAILED)
        }
    }


async def process_recognition_task(task_id: str, request: RecognitionRequest):
    """
    后台处理识别任务
    
    Args:
        task_id: 任务ID
        request: 识别请求
    """
    try:
        # 更新任务状态为处理中
        task_manager.update_task(
            task_id,
            status=TaskStatus.PROCESSING,
            progress=0,
            message="开始识别角色"
        )
        
        # 执行识别
        logger.info(f"开始处理任务 {task_id}")
        result = recognizer.recognize(request)
        
        # 转换结果为字典
        result_dict = result.dict()
        
        # 更新任务状态为完成
        task_manager.update_task(
            task_id,
            status=TaskStatus.COMPLETED,
            progress=100,
            message="识别完成",
            result=result_dict
        )
        
        logger.info(f"任务 {task_id} 完成，识别到 {len(result.characters)} 个角色")
        
        # 如果有回调URL，发送回调通知
        callback_url = task_manager.get_callback_url(task_id)
        if callback_url:
            await send_callback(callback_url, task_id, result_dict)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"任务 {task_id} 失败: {e}\n{error_trace}")
        
        # 更新任务状态为失败
        task_manager.update_task(
            task_id,
            status=TaskStatus.FAILED,
            message="识别失败",
            error=str(e)
        )
        
        # 如果有回调URL，发送失败通知
        callback_url = task_manager.get_callback_url(task_id)
        if callback_url:
            await send_callback(callback_url, task_id, None, error=str(e))


async def send_callback(callback_url: str, task_id: str, result: Optional[dict] = None, error: Optional[str] = None):
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
                "error": error
            }
            
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
