"""对话归因模块"""
import re
from typing import List, Dict, Optional
from loguru import logger

from ..config import settings
from ..models.character import Character


class DialogueAttributor:
    """对话归因器"""

    def __init__(self):
        # 构建触发词正则
        triggers = '|'.join(settings.DIALOGUE_TRIGGERS)

        # 模式1: "...", 人名 + 触发词（支持中文引号，更精确的说话者匹配）
        # 说话者应该在引号后面，紧跟触发词，不应该跨越太多字符
        self.pattern1 = re.compile(rf'["「"]([^"」"]+)["」"][，,]?\s*(.{{0,15}}?)({triggers})')

        # 模式2: 人名 + 触发词 + ":"..."（支持中文引号）
        self.pattern2 = re.compile(rf'(.{{1,15}}?)({triggers})[：:]["「"]([^"」"]+)["」"]')

        # 模式3: "..." —— 人名（支持中文引号）
        self.pattern3 = re.compile(r'["「"]([^"」"]+)["」"][，,]?\s*——\s*(.{{1,15}}?)(?=[，,。！？\s]|$)')
    
    def attribute_dialogues(
        self,
        sentences: List[str],
        characters: List[Character],
        alias_map: Dict[str, str]
    ) -> Dict[str, int]:
        """
        为对话分配说话者
        
        Args:
            sentences: 句子列表
            characters: 人物列表
            alias_map: 别名映射
            
        Returns:
            {character_name: quote_count} 人物台词统计
        """
        quote_counts = {char.name: 0 for char in characters}
        
        for sentence in sentences:
            # 尝试三种模式
            speaker = (
                self._match_pattern1(sentence, alias_map) or
                self._match_pattern2(sentence, alias_map) or
                self._match_pattern3(sentence, alias_map)
            )
            
            if speaker and speaker in quote_counts:
                quote_counts[speaker] += 1
        
        # 更新人物对象
        for char in characters:
            char.quotes = quote_counts.get(char.name, 0)
        
        total_quotes = sum(quote_counts.values())
        logger.info(f"对话归因完成: {total_quotes} 条台词")
        
        return quote_counts
    
    def _match_pattern1(self, sentence: str, alias_map: Dict[str, str]) -> Optional[str]:
        """匹配模式1: "...", 人名 + 触发词"""
        match = self.pattern1.search(sentence)
        if match:
            speaker_text = match.group(2).strip()
            # 查找别名映射
            for alias, main_name in alias_map.items():
                if alias in speaker_text:
                    return main_name
        return None
    
    def _match_pattern2(self, sentence: str, alias_map: Dict[str, str]) -> Optional[str]:
        """匹配模式2: 人名 + 触发词 + ":"..."""
        match = self.pattern2.search(sentence)
        if match:
            speaker_text = match.group(1).strip()
            # 查找别名映射
            for alias, main_name in alias_map.items():
                if alias in speaker_text:
                    return main_name
        return None
    
    def _match_pattern3(self, sentence: str, alias_map: Dict[str, str]) -> Optional[str]:
        """匹配模式3: "..." —— 人名"""
        match = self.pattern3.search(sentence)
        if match:
            speaker_text = match.group(2).strip()
            # 查找别名映射
            for alias, main_name in alias_map.items():
                if alias in speaker_text:
                    return main_name
        return None
