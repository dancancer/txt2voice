"""别名识别与合并模块"""
import re
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from loguru import logger

from ..config import settings
from ..models.character import Character, CharacterMention


class AliasRecognizer:
    """别名识别器"""
    
    def __init__(self):
        self.embedding_model = None
        self._initialized = False
    
    def initialize(self):
        """延迟初始化句向量模型"""
        if self._initialized:
            return
        
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"正在加载句向量模型: {settings.EMBEDDING_MODEL}")
            self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            self._initialized = True
            logger.info("句向量模型加载成功")
        except Exception as e:
            logger.warning(f"句向量模型加载失败: {e}，将仅使用规则合并")
            self._initialized = False
    
    def recognize_aliases(self, sentences: List[str]) -> List[CharacterMention]:
        """
        识别别名和称呼
        
        Args:
            sentences: 句子列表
            
        Returns:
            别名提及列表
        """
        aliases = []
        
        for sent_id, sentence in enumerate(sentences):
            # 规则1: 前缀 + 核心名
            aliases.extend(self._extract_prefix_names(sentence, sent_id))
            
            # 规则2: 核心名 + 后缀敬称
            aliases.extend(self._extract_honorific_names(sentence, sent_id))
            
            # 规则3: 儿化音昵称
            aliases.extend(self._extract_er_names(sentence, sent_id))
        
        logger.info(f"别名识别完成: 共 {len(aliases)} 个别名提及")
        
        return aliases
    
    def _extract_prefix_names(self, sentence: str, sent_id: int) -> List[CharacterMention]:
        """提取带前缀的称呼"""
        mentions = []
        
        # 构建前缀正则
        prefixes = '|'.join(settings.NAME_PREFIXES)
        pattern = f'({prefixes})([一-龥]{{1,3}})'
        
        for match in re.finditer(pattern, sentence):
            mentions.append(CharacterMention(
                text=match.group(0),
                start=match.start(),
                end=match.end(),
                sent_id=sent_id
            ))
        
        return mentions
    
    def _extract_honorific_names(self, sentence: str, sent_id: int) -> List[CharacterMention]:
        """提取带敬称的称呼"""
        mentions = []
        
        # 构建后缀正则
        honorifics = '|'.join(settings.NAME_HONORIFICS)
        pattern = f'([一-龥]{{1,3}})({honorifics})'
        
        for match in re.finditer(pattern, sentence):
            mentions.append(CharacterMention(
                text=match.group(0),
                start=match.start(),
                end=match.end(),
                sent_id=sent_id
            ))
        
        return mentions
    
    def _extract_er_names(self, sentence: str, sent_id: int) -> List[CharacterMention]:
        """提取儿化音昵称"""
        mentions = []
        
        pattern = r'([一-龥]{1,2})儿'
        for match in re.finditer(pattern, sentence):
            mentions.append(CharacterMention(
                text=match.group(0),
                start=match.start(),
                end=match.end(),
                sent_id=sent_id
            ))
        
        return mentions
    
    def normalize_name(self, name: str) -> str:
        """
        归一化名字（去除前后缀）
        
        Args:
            name: 原始名字
            
        Returns:
            归一化后的核心名
        """
        core_name = name
        
        # 去除前缀
        for prefix in settings.NAME_PREFIXES:
            if core_name.startswith(prefix) and len(core_name) > len(prefix):
                core_name = core_name[len(prefix):]
                break
        
        # 去除后缀
        for suffix in settings.NAME_HONORIFICS:
            if core_name.endswith(suffix) and len(core_name) > len(suffix):
                core_name = core_name[:-len(suffix)]
                break
        
        # 去除儿化音
        for suffix in settings.ER_SUFFIXES:
            if core_name.endswith(suffix) and len(core_name) > len(suffix):
                core_name = core_name[:-len(suffix)]
                break
        
        return core_name
    
    def merge_characters(
        self,
        mentions: List[CharacterMention],
        sentences: List[str],
        threshold: float = None
    ) -> Tuple[List[Character], Dict[str, str]]:
        """
        合并人物实体
        
        Args:
            mentions: 所有提及
            sentences: 句子列表
            threshold: 相似度阈值
            
        Returns:
            characters: 人物列表
            alias_map: 别名映射
        """
        if threshold is None:
            threshold = settings.SIMILARITY_THRESHOLD
        
        # 第一步：基于规则的合并
        name_groups = self._rule_based_merge(mentions)
        
        # 第二步：基于语义的合并（如果模型已加载）
        if self._initialized and self.embedding_model:
            name_groups = self._semantic_merge(name_groups, sentences, threshold)
        
        # 构建 Character 对象
        characters = []
        alias_map = {}
        
        for char_id, group_data in enumerate(name_groups.values()):
            main_name, aliases, mention_list = group_data
            character = Character(
                id=f"c{char_id:03d}",
                name=main_name,
                aliases=aliases,
                mentions=len(mention_list),
                first_appearance_idx=min(m.start for m in mention_list) if mention_list else -1
            )
            
            # 推断性别
            character.gender = self._infer_gender(main_name, aliases)
            
            characters.append(character)
            
            # 构建别名映射
            for alias in aliases:
                alias_map[alias] = main_name
            alias_map[main_name] = main_name
        
        logger.info(f"人物合并完成: {len(characters)} 个人物")
        
        return characters, alias_map
    
    def _rule_based_merge(
        self,
        mentions: List[CharacterMention]
    ) -> Dict[str, Tuple[str, Set[str], List[CharacterMention]]]:
        """
        基于规则的合并
        
        Returns:
            {main_name: (main_name, aliases, mentions)}
        """
        # 按核心名分组
        core_groups = defaultdict(lambda: {"names": set(), "mentions": []})
        
        for mention in mentions:
            core_name = self.normalize_name(mention.text)
            core_groups[core_name]["names"].add(mention.text)
            core_groups[core_name]["mentions"].append(mention)
        
        # 选择最频繁的作为主名
        name_groups = {}
        for core_name, group in core_groups.items():
            # 统计每个名字的出现次数
            name_counts = defaultdict(int)
            for mention in group["mentions"]:
                name_counts[mention.text] += 1
            
            # 选择最频繁的作为主名
            main_name = max(name_counts.items(), key=lambda x: x[1])[0]
            aliases = group["names"] - {main_name}
            
            name_groups[main_name] = (main_name, aliases, group["mentions"])
        
        return name_groups
    
    def _semantic_merge(
        self,
        name_groups: Dict,
        sentences: List[str],
        threshold: float
    ) -> Dict:
        """基于语义相似度的合并"""
        # TODO: 实现基于句向量的合并
        # 1. 为每个名字提取上下文（±1-2句）
        # 2. 计算句向量
        # 3. 计算相似度
        # 4. 合并相似的人物
        
        return name_groups
    
    def _infer_gender(self, name: str, aliases: Set[str]) -> str:
        """推断性别"""
        all_names = {name} | aliases
        
        male_score = 0
        female_score = 0
        
        for n in all_names:
            # 检查男性指示词
            for indicator in settings.MALE_INDICATORS:
                if indicator in n:
                    male_score += 1
            
            # 检查女性指示词
            for indicator in settings.FEMALE_INDICATORS:
                if indicator in n:
                    female_score += 1
        
        if male_score > female_score:
            return "男"
        elif female_score > male_score:
            return "女"
        else:
            return "未知"
