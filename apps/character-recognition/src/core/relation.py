"""人物关系抽取模块"""
from typing import List, Dict
from collections import defaultdict
from loguru import logger

from ..config import settings
from ..models.character import Character, Relation


class RelationExtractor:
    """关系抽取器"""
    
    def __init__(self):
        pass
    
    def extract_relations(
        self,
        sentences: List[str],
        characters: List[Character],
        alias_map: Dict[str, str]
    ) -> List[Relation]:
        """
        抽取人物关系
        
        Args:
            sentences: 句子列表
            characters: 人物列表
            alias_map: 别名映射
            
        Returns:
            关系列表
        """
        # 统计共现
        cooccurrence = defaultdict(int)
        dialogue_pairs = defaultdict(int)
        
        # 按句子窗口统计共现
        for i, sentence in enumerate(sentences):
            chars_in_sent = self._extract_characters(sentence, alias_map)
            
            # 句内共现
            for j, char1 in enumerate(chars_in_sent):
                for char2 in chars_in_sent[j+1:]:
                    pair = tuple(sorted([char1, char2]))
                    cooccurrence[pair] += 1
            
            # 跨句共现（窗口大小为 MAX_CONTEXT_DISTANCE）
            if i < len(sentences) - 1:
                for offset in range(1, settings.MAX_CONTEXT_DISTANCE + 1):
                    if i + offset >= len(sentences):
                        break
                    
                    next_chars = self._extract_characters(
                        sentences[i + offset], alias_map
                    )
                    
                    for char1 in chars_in_sent:
                        for char2 in next_chars:
                            if char1 != char2:
                                pair = tuple(sorted([char1, char2]))
                                cooccurrence[pair] += 1
        
        # 构建关系列表
        relations = []
        
        for (char1, char2), weight in cooccurrence.items():
            if weight >= settings.MIN_RELATION_WEIGHT:
                relations.append(Relation(
                    from_char=char1,
                    to_char=char2,
                    relation_type="共现",
                    weight=weight
                ))
        
        # 按权重排序
        relations.sort(key=lambda r: r.weight, reverse=True)
        
        logger.info(f"关系抽取完成: {len(relations)} 个关系")
        
        return relations
    
    def _extract_characters(
        self,
        sentence: str,
        alias_map: Dict[str, str]
    ) -> List[str]:
        """提取句子中的人物"""
        characters = []
        
        for alias, main_name in alias_map.items():
            if alias in sentence:
                if main_name not in characters:
                    characters.append(main_name)
        
        return characters
