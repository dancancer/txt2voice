"""工具函数"""
import sys
from loguru import logger
from .config import settings


def setup_logging():
    """配置日志"""
    logger.remove()
    logger.add(
        sys.stderr,
        format=settings.LOG_FORMAT,
        level=settings.LOG_LEVEL,
        colorize=True
    )
    logger.add(
        "logs/app.log",
        rotation="500 MB",
        retention="10 days",
        level=settings.LOG_LEVEL,
        format=settings.LOG_FORMAT
    )


def format_response(success: bool, data=None, error=None):
    """格式化响应"""
    response = {"success": success}
    
    if data is not None:
        response["data"] = data
    
    if error is not None:
        response["error"] = error
    
    return response
