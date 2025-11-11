"""文本预处理模块"""
import re
from typing import List, Tuple
from loguru import logger


class TextPreprocessor:
    """文本预处理器"""
    
    # 中文句子分隔符
    SENTENCE_DELIMITERS = r'[。！？；]'
    
    def __init__(self):
        self.sentence_pattern = re.compile(self.SENTENCE_DELIMITERS)
    
    def preprocess(self, text: str) -> Tuple[str, List[str], List[Tuple[int, int]]]:
        """
        预处理文本
        
        Args:
            text: 原始文本
            
        Returns:
            cleaned_text: 清洗后的文本
            sentences: 句子列表
            sentence_bounds: 句子边界 [(start, end), ...]
        """
        # 统一编码和清洗
        cleaned = self._clean_text(text)
        
        # 分句
        sentences, bounds = self._split_sentences(cleaned)
        
        logger.info(f"预处理完成: {len(sentences)} 个句子, {len(cleaned)} 字符")
        
        return cleaned, sentences, bounds
    
    def _clean_text(self, text: str) -> str:
        """
        清洗文本
        
        Args:
            text: 原始文本
            
        Returns:
            清洗后的文本
        """
        # 统一换行符
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # 删除多余空白符（保留单个空格和换行）
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # 统一引号
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        
        return text.strip()
    
    def _split_sentences(self, text: str) -> Tuple[List[str], List[Tuple[int, int]]]:
        """
        分句
        
        Args:
            text: 文本
            
        Returns:
            sentences: 句子列表
            bounds: 句子边界
        """
        sentences = []
        bounds = []
        
        # 按标点分句
        start = 0
        for match in self.sentence_pattern.finditer(text):
            end = match.end()
            sentence = text[start:end].strip()
            
            if sentence:
                sentences.append(sentence)
                bounds.append((start, end))
            
            start = end
        
        # 处理最后一段（如果没有结束标点）
        if start < len(text):
            sentence = text[start:].strip()
            if sentence:
                sentences.append(sentence)
                bounds.append((start, len(text)))
        
        return sentences, bounds
    
    def extract_quotes(self, sentence: str) -> List[Tuple[str, int, int]]:
        """
        提取引号内的内容（对话）
        
        Args:
            sentence: 句子
            
        Returns:
            [(quote_text, start, end), ...]
        """
        quotes = []
        
        # 匹配双引号
        pattern = r'"([^"]+)"'
        for match in re.finditer(pattern, sentence):
            quotes.append((
                match.group(1),
                match.start(),
                match.end()
            ))
        
        return quotes
    
    def is_in_quote(self, sentence: str, pos: int) -> bool:
        """
        判断位置是否在引号内
        
        Args:
            sentence: 句子
            pos: 位置
            
        Returns:
            是否在引号内
        """
        quotes = self.extract_quotes(sentence)
        for _, start, end in quotes:
            if start <= pos < end:
                return True
        return False
