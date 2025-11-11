"""指代消解模块"""
from typing import List, Dict, Optional
from loguru import logger

from ..config import settings
from ..models.character import Character


class CoreferenceResolver:
    """指代消解器"""
    
    def __init__(self):
        pass
    
    def resolve(
        self,
        sentences: List[str],
        characters: List[Character],
        alias_map: Dict[str, str]
    ) -> Dict[int, str]:
        """
        解析代词指代
        
        Args:
            sentences: 句子列表
            characters: 人物列表
            alias_map: 别名映射
            
        Returns:
            {sent_id: character_name} 代词所指人物
        """
        resolutions = {}
        
        # 维护最近出现的人物（用于启发式）
        recent_chars = []
        
        for sent_id, sentence in enumerate(sentences):
            # 提取当前句中的人物
            current_chars = self._extract_characters_in_sentence(
                sentence, alias_map
            )
            
            # 更新最近出现列表
            if current_chars:
                recent_chars = current_chars + recent_chars
                recent_chars = recent_chars[:settings.MAX_COREFERENCE_DISTANCE]
            
            # 检查代词
            pronouns = self._extract_pronouns(sentence)
            
            for pronoun, gender_hint in pronouns:
                # 启发式：选择最近出现且性别匹配的人物
                resolved = self._resolve_pronoun(
                    pronoun, gender_hint, recent_chars, characters
                )
                
                if resolved:
                    resolutions[sent_id] = resolved
        
        logger.info(f"指代消解完成: {len(resolutions)} 个代词已解析")
        
        return resolutions
    
    def _extract_characters_in_sentence(
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
    
    def _extract_pronouns(self, sentence: str) -> List[tuple]:
        """提取代词"""
        pronouns = []
        
        for pronoun, gender in settings.PRONOUNS.items():
            if pronoun in sentence:
                pronouns.append((pronoun, gender))
        
        return pronouns
    
    def _resolve_pronoun(
        self,
        pronoun: str,
        gender_hint: str,
        recent_chars: List[str],
        all_characters: List[Character]
    ) -> Optional[str]:
        """
        解析单个代词
        
        Args:
            pronoun: 代词
            gender_hint: 性别提示
            recent_chars: 最近出现的人物
            all_characters: 所有人物
            
        Returns:
            解析到的人物名，或 None
        """
        # 构建人物性别映射
        char_gender = {char.name: char.gender for char in all_characters}
        
        # 从最近的人物中查找性别匹配的
        for char_name in recent_chars:
            if gender_hint == "未知":
                return char_name
            
            if char_gender.get(char_name) == gender_hint:
                return char_name
        
        return None
