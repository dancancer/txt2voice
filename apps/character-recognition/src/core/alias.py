"""别名识别与合并模块"""
import re
from collections import defaultdict
from difflib import SequenceMatcher
from typing import Dict, List, Set, Tuple

import numpy as np
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
        """识别别名和称呼"""
        aliases = []

        for sent_id, sentence in enumerate(sentences):
            # 规则1: 前缀 + 核心名
            aliases.extend(self._extract_prefix_names(sentence, sent_id))

            # 规则2: 核心名 + 后缀敬称
            aliases.extend(self._extract_honorific_names(sentence, sent_id))

            # 规则3: 儿化音昵称
            aliases.extend(self._extract_er_names(sentence, sent_id))

            # 规则4: 描述性称呼（新增）
            aliases.extend(self._extract_descriptive_names(sentence, sent_id))

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

    def _extract_descriptive_names(self, sentence: str, sent_id: int) -> List[CharacterMention]:
        """提取描述性称呼（描述词/颜色/职业等）"""
        mentions = []

        # 模式1: X头、X面、X脸（动物/物品 + 部位）
        pattern1 = r'([一-龥]{2,4})(头|面|脸)'
        for match in re.finditer(pattern1, sentence):
            full_text = match.group(0)
            # 排除常见非人名: "念头"、"里头"、"外头" 等
            if full_text not in ['念头', '里头', '外头', '上头', '下头', '前头', '后头',
                                '心头', '手头', '年头', '日头', '舌头', '骨头', '木头',
                                '石头', '拳头', '指头', '码头', '街头', '床头', '枕头']:
                mentions.append(CharacterMention(
                    text=full_text,
                    start=match.start(),
                    end=match.end(),
                    sent_id=sent_id
                ))

        # 模式2: 穿着描述 + 人物词（白大褂、黑衣人）
        pattern2 = r'(白|黑|红|蓝|绿|黄|紫|灰|褐|青)(色)?(大褂|衣[人男女子]|裙[女子]|袍[人男]|服[男女])'
        for match in re.finditer(pattern2, sentence):
            mentions.append(CharacterMention(
                text=match.group(0),
                start=match.start(),
                end=match.end(),
                sent_id=sent_id
            ))

        # 模式3: 身体特征 + 男/女/人（花臂男、健硕男人、清冷女人）
        pattern3 = r'([一-龥]{2,4})(男[人子]?|女[人子]?|[男女][的]?)'
        for match in re.finditer(pattern3, sentence):
            full_text = match.group(0)
            # 只保留可能是角色描述的（避免"那个男人"等）
            prefix = match.group(1)
            if prefix not in ['这个', '那个', '每个', '一个', '有个', '某个', '另一']:
                mentions.append(CharacterMention(
                    text=full_text,
                    start=match.start(),
                    end=match.end(),
                    sent_id=sent_id
                ))

        # 模式4: 常见身份/职业词（店小二、老板、掌柜）
        pattern4 = r'(店小二|老板娘?|掌柜的?|伙计|小厮|丫鬟|婢女|家丁|护卫|侍卫)'
        for match in re.finditer(pattern4, sentence):
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
        # ===== 基础归一化 =====
        core_name = re.sub(r"[\s·•.,，。？！、]+", "", name)
        
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
        book_id: str,
        threshold: float = None
    ) -> Tuple[List[Character], Dict[str, str]]:
        """合并人物实体并生成别名映射"""
        if threshold is None:
            threshold = settings.SIMILARITY_THRESHOLD
        
        # 第一步：基于规则的合并
        name_groups = self._rule_based_merge(mentions)
        
        # 第二步：基于语义的合并（如果模型已加载）
        if self._initialized and self.embedding_model:
            name_groups = self._semantic_merge(name_groups, sentences, threshold)
        else:
            name_groups = self._string_merge(name_groups, threshold)
        
        # 构建 Character 对象
        characters = []
        alias_map = {}
        
        for char_id, group_data in enumerate(name_groups.values()):
            main_name, aliases, mention_list = group_data
            character = Character(
                id=f"c{char_id:03d}",
                book_id=book_id,
                canonical_name=main_name,
                aliases=list(aliases),
                mentions=len(mention_list),
                first_appearance_idx=min(m.start for m in mention_list) if mention_list else -1
            )
            
            # 推断性别
            gender = self._infer_gender(main_name, aliases)
            character.gender_hint = "male" if gender == "男" else "female" if gender == "女" else "unknown"
            
            characters.append(character)
            
            # 构建别名映射
            for alias in aliases:
                alias_map[alias] = main_name
            alias_map[main_name] = main_name
        
        logger.info(f"人物合并完成: {len(characters)} 个人物")
        
        return characters, alias_map
    
    def _rule_based_merge(self, mentions: List[CharacterMention]) -> Dict[str, Tuple[str, Set[str], List[CharacterMention]]]:
        """基于核心名的快速分组"""
        core_groups = defaultdict(lambda: {"names": set(), "mentions": []})
        
        for mention in mentions:
            core_name = self.normalize_name(mention.text)
            core_groups[core_name]["names"].add(mention.text)
            core_groups[core_name]["mentions"].append(mention)

        name_groups = {}
        for core_name, group in core_groups.items():
            name_counts = defaultdict(int)
            for mention in group["mentions"]:
                name_counts[mention.text] += 1
            main_name = max(name_counts.items(), key=lambda x: x[1])[0]
            aliases = group["names"] - {main_name}
            name_groups[main_name] = (main_name, aliases, group["mentions"])
        
        return name_groups
    
    def _semantic_merge(self, name_groups: Dict, sentences: List[str], threshold: float) -> Dict:
        """基于语义相似度的合并"""
        names = list(name_groups.keys())
        if len(names) < 2:
            return name_groups

        contexts = [self._collect_context(name_groups[name][2], sentences) for name in names]

        try:
            embeddings = self.embedding_model.encode(
                contexts,
                batch_size=min(settings.EMBEDDING_BATCH_SIZE, len(contexts)),
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False
            )
        except Exception as error:  # pragma: no cover - 仅记录模型异常
            logger.warning(f"语义合并失败，回退字符串合并: {error}")
            return self._string_merge(name_groups, threshold)

        pairs = self._find_semantic_pairs(embeddings, threshold)
        if not pairs:
            return name_groups

        return self._apply_merges(pairs, names, name_groups)

    def _string_merge(self, name_groups: Dict, threshold: float) -> Dict:
        names = list(name_groups.keys())
        if len(names) < 2:
            return name_groups

        pairs = []
        for i, left in enumerate(names):
            for j in range(i + 1, len(names)):
                right = names[j]
                score = self._string_similarity(left, right)
                if score >= max(threshold, settings.MIN_ALIAS_SIMILARITY):
                    pairs.append((i, j))

        if not pairs:
            return name_groups

        return self._apply_merges(pairs, names, name_groups)
    
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

    # ===== 辅助函数：合并与相似度 =====
    def _collect_context(self, mentions: List[CharacterMention], sentences: List[str]) -> str:
        """收集提及周围的句子上下文"""
        sent_ids = sorted({m.sent_id for m in mentions}) if mentions else []
        fragments: List[str] = []
        for sent_id in sent_ids[: settings.EMBEDDING_BATCH_SIZE]:
            start, end = max(sent_id - 1, 0), min(sent_id + 2, len(sentences))
            fragments.extend(sentences[start:end])
            if len(fragments) >= 6:
                break
        return "。".join(fragments)

    def _find_semantic_pairs(self, embeddings: np.ndarray, threshold: float) -> List[Tuple[int, int]]:
        """查找语义相似的名字对"""
        pairs: List[Tuple[int, int]] = []
        total = embeddings.shape[0]
        for i in range(total):
            for j in range(i + 1, total):
                if float(np.dot(embeddings[i], embeddings[j])) >= threshold:
                    pairs.append((i, j))
        return pairs

    def _apply_merges(
        self,
        pairs: List[Tuple[int, int]],
        names: List[str],
        name_groups: Dict[str, Tuple[str, Set[str], List[CharacterMention]]]
    ) -> Dict:
        """将待合并对压缩为最终分组"""
        if not pairs:
            return name_groups
        parent = list(range(len(names)))

        def find(idx: int) -> int:
            """迭代版并查集查找，防止深递归栈溢出"""
            root = idx
            while parent[root] != root:
                root = parent[root]
            # 路径压缩
            while parent[idx] != idx:
                nxt = parent[idx]
                parent[idx] = root
                idx = nxt
            return root
        for left, right in pairs:
            parent[find(left)] = find(right)

        buckets: Dict[int, Dict[str, Set[str] | List[CharacterMention]]] = defaultdict(lambda: {"names": set(), "mentions": []})
        for idx, name in enumerate(names):
            root = find(idx)
            main_name, aliases, mentions = name_groups[name]
            bucket = buckets[root]
            bucket["names"].update({main_name, *aliases})
            bucket["mentions"].extend(mentions)

        merged: Dict[str, Tuple[str, Set[str], List[CharacterMention]]] = {}
        for bucket in buckets.values():
            mention_counts = defaultdict(int)
            for mention in bucket["mentions"]:
                mention_counts[mention.text] += 1
            main_name = max(mention_counts.items(), key=lambda item: (item[1], len(item[0])))[0]
            aliases = set(bucket["names"]) - {main_name}
            merged[main_name] = (main_name, aliases, bucket["mentions"])
        logger.info(f"别名合并后剩余 {len(merged)} 组（触发 {len(pairs)} 次合并）")
        return merged

    def _string_similarity(self, left: str, right: str) -> float:
        """快速字符串相似度"""
        if not left or not right:
            return 0.0
        if left in right or right in left:
            short, long_ = sorted((left, right), key=len)
            return 1 - (len(long_) - len(short)) * 0.05
        return SequenceMatcher(None, left, right).ratio()
