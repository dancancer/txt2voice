"""主识别器"""
import time
from typing import Dict, Any
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
    DialogueAttributor,
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
        self.dialogue_attributor = DialogueAttributor()
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
    
    def recognize(self, request: RecognitionRequest) -> RecognitionResponse:
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
        
        # 2. NER 识别人名
        name_mentions = self.ner_recognizer.recognize(sentences)
        
        # 3. 识别别名和称呼（仅在 NER 不可用时使用）
        if self.ner_recognizer._initialized and self.ner_recognizer.model:
            # NER 模型可用，跳过规则化的别名识别
            alias_mentions = []
            logger.info("NER 模型可用，跳过规则化的别名识别")
        else:
            # NER 不可用，使用别名规则作为补充
            alias_mentions = self.alias_recognizer.recognize_aliases(sentences)
            logger.info("使用规则化的别名识别（降级模式）")
        
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
        
        # 6. 指代消解（可选）
        if options.enable_coreference:
            self.coreference_resolver.resolve(sentences, characters, alias_map)
        
        # 7. 对话归因（可选）
        if options.enable_dialogue:
            self.dialogue_attributor.attribute_dialogues(
                sentences, characters, alias_map
            )
        
        # 8. 关系抽取（可选）
        relations = []
        if options.enable_relations:
            relations = self.relation_extractor.extract_relations(
                sentences, characters, alias_map
            )
        
        # 9. 过滤和排序
        characters = self._filter_characters(characters, options)
        characters = sorted(characters, key=lambda c: c.mentions, reverse=True)
        
        # 10. 构建响应（使用新的数据库格式）
        processing_time = time.time() - start_time
        
        statistics = RecognitionStatistics(
            total_characters=len(characters),
            total_mentions=sum(c.mentions for c in characters),
            total_dialogues=sum(c.quotes for c in characters),
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
        """过滤人物"""
        # 按提及次数过滤（至少出现1次）
        filtered = [c for c in characters if c.mentions > 0]
        
        # 限制最大返回数量
        if options.max_characters:
            filtered = sorted(filtered, key=lambda c: c.mentions, reverse=True)
            filtered = filtered[:options.max_characters]
        
        return filtered
