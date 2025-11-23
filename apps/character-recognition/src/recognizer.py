"""主识别器"""
import re
import time
from typing import Callable, Dict, Any, Optional
from loguru import logger

from .config import settings
from .models import (
    RecognitionRequest,
    RecognitionResponse,
    RecognitionStatistics
)
from .core import (
    TextPreprocessor,
    NERRecognizer,
    AliasRecognizer,
    CoreferenceResolver,
    RelationExtractor
)


class CharacterRecognizer:
    """人物识别器"""
    
    def __init__(self):
        # 初始化各模块
        self.preprocessor = TextPreprocessor()
        self.ner_recognizer = NERRecognizer()
        self.alias_recognizer = AliasRecognizer()
        self.coreference_resolver = CoreferenceResolver()
        self.relation_extractor = RelationExtractor()
        
        self._initialized = False
    
    def initialize(self):
        """延迟初始化（加载模型）"""
        if self._initialized:
            return
        
        logger.info("正在初始化人物识别器...")
        
        # 初始化 NER 模型
        self.ner_recognizer.initialize()
        
        # 初始化句向量模型
        self.alias_recognizer.initialize()
        
        self._initialized = True
        logger.info("人物识别器初始化完成")
    
    def recognize(
        self,
        request: RecognitionRequest,
        on_sentence: Optional[Callable[[int, int], None]] = None,
        on_stage: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ) -> RecognitionResponse:
        """
        识别人物
        
        Args:
            request: 识别请求
            
        Returns:
            识别结果
        """
        start_time = time.time()
        
        # 确保已初始化
        if not self._initialized:
            self.initialize()
        
        text = request.text
        options = request.options
        
        logger.info(f"开始识别人物，文本长度: {len(text)}")
        
        # 1. 文本预处理
        cleaned_text, sentences, bounds = self.preprocessor.preprocess(text)
        total_sentences = len(sentences)

        if on_stage:
            on_stage("preprocess", {
                "text_length": len(text),
                "cleaned_length": len(cleaned_text),
                "total_sentences": total_sentences
            })
        
        # 2. NER 识别人名
        name_mentions = self.ner_recognizer.recognize(
            sentences,
            on_sentence=lambda processed: on_sentence(processed, total_sentences) if on_sentence else None
        )

        if on_stage:
            on_stage("ner", {"mentions": len(name_mentions), "total_sentences": total_sentences})
        
        # 3. 识别别名和称呼（始终执行，作为 NER 的补充）
        # NER 只识别标准人名，别名识别可以捕获"山羊头"、"白大褂"等特殊称呼
        alias_mentions = self.alias_recognizer.recognize_aliases(sentences)
        logger.info(f"规则化的别名识别完成: {len(alias_mentions)} 个提及")

        if on_stage:
            on_stage("aliases", {
                "alias_mentions": len(alias_mentions),
                "total_sentences": total_sentences
            })
        
        # 4. 合并所有提及
        all_mentions = name_mentions + alias_mentions
        
        # 5. 实体合并
        threshold = options.similarity_threshold or settings.SIMILARITY_THRESHOLD
        characters, alias_map = self.alias_recognizer.merge_characters(
            mentions=all_mentions,
            sentences=sentences,
            book_id=request.book_id,
            threshold=threshold
        )

        if on_stage:
            on_stage("merge", {
                "characters": len(characters),
                "alias_map_size": len(alias_map)
            })
        
        # 6. 指代消解（可选）
        if options.enable_coreference:
            self.coreference_resolver.resolve(sentences, characters, alias_map)
            if on_stage:
                on_stage("coreference", {"characters": len(characters)})

        # 7. 关系抽取（可选）
        relations = []
        if options.enable_relations:
            relations = self.relation_extractor.extract_relations(
                sentences, characters, alias_map
            )
            if on_stage:
                on_stage("relations", {"relations": len(relations)})

        # 8. 过滤和排序
        characters = self._filter_characters(characters, options)
        characters = sorted(characters, key=lambda c: c.mentions, reverse=True)
        
        # 9. 构建响应（使用新的数据库格式）
        processing_time = time.time() - start_time
        
        statistics = RecognitionStatistics(
            total_characters=len(characters),
            total_mentions=sum(c.mentions for c in characters),
            total_dialogues=0,
            processing_time=processing_time,
            text_length=len(text),
            sentence_count=len(sentences)
        )
        
        # 使用新的数据库格式响应
        response = RecognitionResponse.from_characters(
            characters=characters,
            relations=relations,
            statistics=statistics
        )

        if on_stage:
            on_stage("result", response.dict())
        
        logger.info(
            f"识别完成: {len(characters)} 个人物, "
            f"耗时 {processing_time:.2f}s"
        )
        
        return response
    
    def _filter_characters(
        self,
        characters: list,
        options: Any
    ) -> list:
        """
        过滤人物

        排除规则：
        1. 神话/历史人物
        2. 举例中的常见化名
        3. 时间/数量/方位词汇
        4. 包含"的"的身体部位描述
        5. 指代词前缀（如"那个XX"）
        6. 提及次数过少的角色
        """
        # 按提及次数过滤（至少出现2次，避免误识别）
        min_mentions = getattr(options, 'min_mentions', 2)
        filtered = [c for c in characters if c.mentions >= min_mentions]

        # 排除神话/历史人物
        myth_names = {
            '女娲', '盘古', '伏羲', '神农', '黄帝', '炎帝', '蚩尤',
            '后羿', '嫦娥', '夸父', '精卫', '共工', '祝融',
            '孔子', '老子', '庄子', '孟子', '墨子',
            '秦始皇', '汉武帝', '唐太宗', '宋太祖',
        }
        filtered = [c for c in filtered if c.canonical_name not in myth_names]

        # 排除常见举例化名（"小芳"、"丽丽"等独立出现且提及很少的）
        common_example_names = {'小芳', '小丽', '丽丽', '小红', '小明', '小强', '大壮'}
        filtered = [c for c in filtered if not (
            c.canonical_name in common_example_names and c.mentions <= 2
        )]

        # 排除时间词汇
        time_words = {
            '小时', '分钟', '秒钟', '时间', '钟头', '刻钟',
            '一点', '二点', '三点', '四点', '五点', '六点', '七点', '八点', '九点', '十点', '十一点', '十二点',
            '二点了', '三点了', '四点了',
            '一个小时', '二个小时', '三个小时', '两个小时', '半小时',
            '二小时', '三小时',
            '二十四个', '二十四小时',
        }
        filtered = [c for c in filtered if c.canonical_name not in time_words]

        # 排除方位/方向词
        location_words = {
            '四周', '周围', '附近', '旁边', '对面', '上面', '下面', '里面', '外面',
            '四面', '四周的墙', '四周的墙面', '四周的无',
        }
        filtered = [c for c in filtered if c.canonical_name not in location_words]

        # 排除数量/序数词
        number_words = {
            '一个', '二个', '三个', '四个', '五个', '六个', '七个', '八个', '九个', '十个',
            '两个', '几个', '好几个', '许多个',
            '一位', '二位', '三位', '四位', '五位', '六位', '七位', '八位', '九位', '十位',
            '第一个', '第二个', '第三个',
            '一字', '二字', '三字', '四字', '五字', '六字', '七字', '八字',
            '三个字', '四个字', '五个字',
        }
        filtered = [c for c in filtered if c.canonical_name not in number_words]

        # 排除包含"的"字的身体部位或物品描述
        # 例如："年轻人的头"、"硕男人的面"、"他的脸"
        body_part_pattern = re.compile(r'.+的(头|脸|面|手|脚|眼|鼻|口|耳|身|体|腿|臂|指|发|须)')
        filtered = [c for c in filtered if not body_part_pattern.match(c.canonical_name)]

        # 排除指代词前缀（例如："那个山羊头"应合并到"山羊头"）
        demonstrative_prefixes = ['这个', '那个', '这位', '那位', '这名', '那名']
        main_names = {c.canonical_name for c in filtered}
        filtered = [c for c in filtered if not any(
            c.canonical_name.startswith(prefix) and c.canonical_name[2:] in main_names
            for prefix in demonstrative_prefixes
        )]

        # 限制最大返回数量
        if options.max_characters:
            filtered = sorted(filtered, key=lambda c: c.mentions, reverse=True)
            filtered = filtered[:options.max_characters]

        return filtered
