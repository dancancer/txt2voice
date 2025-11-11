"""配置文件"""
import os
from typing import List, Dict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""
    
    # 服务配置
    APP_NAME: str = "Character Recognition Service"
    APP_VERSION: str = "1.0.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = True
    
    # NER 模型配置 - 使用完整 BERT BASE 模型
    NER_MODEL: str = "hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH"
    NER_BATCH_SIZE: int = 32
    
    # 句向量模型配置
    EMBEDDING_MODEL: str = "shibing624/text2vec-base-chinese"
    EMBEDDING_BATCH_SIZE: int = 64
    EMBEDDING_MAX_LENGTH: int = 128
    
    # 别名合并配置
    SIMILARITY_THRESHOLD: float = 0.80
    MIN_ALIAS_SIMILARITY: float = 0.75
    MAX_ALIAS_SIMILARITY: float = 0.95
    
    # 人名识别规则配置
    NAME_MIN_LENGTH: int = 2
    NAME_MAX_LENGTH: int = 4
    
    # 称呼前缀
    NAME_PREFIXES: List[str] = [
        "老", "小", "阿", "大", "二", "三", "四", "五",
    ]
    
    # 称呼后缀/敬称
    NAME_HONORIFICS: List[str] = [
        "哥", "姐", "弟", "妹",
        "爷", "奶", "叔", "伯", "婶", "姨", "舅", "姑",
        "少爷", "姑娘", "太太", "夫人", "老板", "掌柜",
        "公子", "小姐", "大人", "先生", "女士",
        "师傅", "师父", "师兄", "师姐", "师弟", "师妹",
        "道长", "法师", "和尚", "尼姑",
    ]
    
    # 儿化音后缀
    ER_SUFFIXES: List[str] = ["儿"]
    
    # 对话触发词
    DIALOGUE_TRIGGERS: List[str] = [
        "说", "道", "问", "答", "回答", "询问", "喊", "叫", "喝",
        "笑", "冷笑", "哈哈", "嘿嘿", "嘻嘻",
        "叹", "叹气", "叹息", "感叹",
        "低声", "高声", "大声", "小声",
        "说道", "问道", "答道", "回道", "接道", "续道",
        "笑道", "叹道", "喊道", "叫道", "喝道",
        "冷笑道", "轻笑道", "大笑道",
    ]
    
    # 性别推断规则
    MALE_INDICATORS: List[str] = [
        "爷", "少爷", "公子", "先生", "掌柜", "老板",
        "师兄", "师弟", "哥", "弟", "叔", "伯", "舅",
    ]
    
    FEMALE_INDICATORS: List[str] = [
        "姐", "妹", "姑娘", "小姐", "大小姐", "太太", "夫人", "女士",
        "师姐", "师妹", "婶", "姨", "姑", "奶",
    ]
    
    # 指代消解配置
    MAX_COREFERENCE_DISTANCE: int = 5  # 最多回溯句子数
    PRONOUNS: Dict[str, str] = {
        "他": "男",
        "她": "女",
        "它": "未知",
        "他们": "男",
        "她们": "女",
        "这位": "未知",
        "那位": "未知",
        "此人": "未知",
        "那人": "未知",
    }
    
    # 关系抽取配置
    MIN_RELATION_WEIGHT: int = 1  # 最小关系权重
    MAX_CONTEXT_DISTANCE: int = 2  # 句子距离内视为有关系
    
    # 缓存配置
    ENABLE_CACHE: bool = True
    CACHE_TTL: int = 3600  # 缓存有效期（秒）
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# 全局配置实例
settings = Settings()
