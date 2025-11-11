"""NER 人名识别模块"""
import re
from typing import List, Dict, Any, Tuple
from loguru import logger

from ..config import settings
from ..models.character import CharacterMention


class NERRecognizer:
    """NER 人名识别器"""
    
    def __init__(self):
        self.model = None
        self._initialized = False
        
        # 中文姓氏（常见200个）
        self.common_surnames = set([
            "赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈",
            "褚", "卫", "蒋", "沈", "韩", "杨", "朱", "秦", "尤", "许",
            "何", "吕", "施", "张", "孔", "曹", "严", "华", "金", "魏",
            "陶", "姜", "戚", "谢", "邹", "喻", "柏", "水", "窦", "章",
            "云", "苏", "潘", "葛", "奚", "范", "彭", "郎", "鲁", "韦",
            "昌", "马", "苗", "凤", "花", "方", "俞", "任", "袁", "柳",
            "唐", "罗", "薛", "伍", "余", "米", "贝", "姚", "孟", "顾",
            "尹", "姜", "邵", "湛", "汪", "祁", "毛", "禹", "狄", "米",
            "贝", "明", "臧", "计", "伏", "成", "戴", "谈", "宋", "茅",
            "庞", "熊", "纪", "舒", "屈", "项", "祝", "董", "梁", "杜",
        ])
    
    def initialize(self):
        """延迟初始化 HanLP 本地模型"""
        if self._initialized:
            return
        
        try:
            import hanlp
            import hanlp.pretrained.ner as ner_models
            import os
            
            # 配置 HanLP 镜像站（国内访问更快）
            os.environ['HANLP_URL'] = 'https://ftp.hankcs.com/hanlp/'
            os.environ['HANLP_VERBOSE'] = '1'  # 显示详细日志
            
            logger.info(f"正在加载 NER 模型: {settings.NER_MODEL}")
            logger.info(f"使用镜像站: {os.environ['HANLP_URL']}")
            logger.info("首次运行会自动下载模型（~362MB），请耐心等待...")
            
            # 从字符串获取模型对象
            # settings.NER_MODEL = "hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH"
            model_name = settings.NER_MODEL.split('.')[-1]  # 提取 "MSRA_NER_BERT_BASE_ZH"
            model_obj = getattr(ner_models, model_name)
            
            # 加载完整 BERT BASE 模型
            # devices=-1 表示使用 CPU
            self.model = hanlp.load(model_obj, devices=-1)
            
            self._initialized = True
            logger.info("✅ HanLP BERT BASE NER 模型加载成功")
            
        except Exception as e:
            logger.warning(f"NER 模型加载失败: {e}，将仅使用规则识别")
            logger.info("提示: 确保已安装 hanlp[full] 并配置好网络")
            import traceback
            logger.debug(traceback.format_exc())
            self._initialized = False
    
    def recognize(self, sentences: List[str]) -> List[CharacterMention]:
        """
        识别人名
        
        Args:
            sentences: 句子列表
            
        Returns:
            人名提及列表
        """
        mentions = []
        
        # 使用 NER 模型识别
        if self._initialized and self.model:
            mentions.extend(self._recognize_with_model(sentences))
            logger.info(f"NER 模型识别完成: 共 {len(mentions)} 个人名提及")
        else:
            # 仅在 NER 模型不可用时使用规则识别作为降级方案
            mentions.extend(self._recognize_with_rules(sentences))
            logger.info(f"规则识别完成（降级模式）: 共 {len(mentions)} 个人名提及")
        
        # 去重
        mentions = self._deduplicate_mentions(mentions)
        
        return mentions
    
    def _recognize_with_model(self, sentences: List[str]) -> List[CharacterMention]:
        """使用 HanLP 本地模型识别"""
        mentions = []
        
        try:
            # 批量处理
            for sent_id, sentence in enumerate(sentences):
                # 对超长句子进行切分（BERT 模型最大序列长度 126 tokens）
                # 中文约 1 字 = 1 token，保守按 100 字切分
                if len(sentence) > 100:
                    sub_sentences = self._split_long_sentence(sentence, max_length=100)
                    for sub_sent, offset in sub_sentences:
                        result = self.model(sub_sent)
                        self._process_model_result(result, sent_id, mentions, offset)
                else:
                    result = self.model(sentence)
                    self._process_model_result(result, sent_id, mentions, 0)
                            
        except Exception as e:
            logger.error(f"NER 模型识别出错: {e}")
            import traceback
            logger.debug(traceback.format_exc())
        
        return mentions
    
    def _split_long_sentence(self, sentence: str, max_length: int = 100) -> List[Tuple[str, int]]:
        """将超长句子切分为多个子句
        
        Args:
            sentence: 原始句子
            max_length: 最大长度
            
        Returns:
            [(子句, 在原句中的偏移量), ...]
        """
        if len(sentence) <= max_length:
            return [(sentence, 0)]
        
        sub_sentences = []
        # 优先在逗号、顿号等处切分
        split_chars = ['，', '、', '；', '：', '！', '？']
        
        start = 0
        while start < len(sentence):
            end = start + max_length
            
            if end >= len(sentence):
                # 最后一段
                sub_sentences.append((sentence[start:], start))
                break
            
            # 尝试在标点处切分
            best_split = end
            for i in range(end, start + max_length // 2, -1):
                if sentence[i] in split_chars:
                    best_split = i + 1
                    break
            
            sub_sentences.append((sentence[start:best_split], start))
            start = best_split
        
        return sub_sentences
    
    def _process_model_result(self, result: Any, sent_id: int, mentions: List[CharacterMention], offset: int = 0):
        """处理模型识别结果
        
        Args:
            result: 模型返回结果
            sent_id: 句子ID
            mentions: 提及列表（会被修改）
            offset: 在原句中的偏移量
        """
        # BERT BASE 返回格式: [('张三', 'NR', 0, 2), ('李四', 'NR', 11, 13), ...]
        if isinstance(result, list):
            # 检查是否是直接的实体列表 (BERT BASE 格式)
            if result and isinstance(result[0], tuple) and len(result[0]) >= 2:
                # BERT BASE 直接返回实体列表
                for entity in result:
                    if len(entity) >= 4:
                        entity_text = entity[0]
                        entity_type = entity[1]
                        start_pos = entity[2] + offset
                        end_pos = entity[3] + offset
                        
                        # 检查是否是人名类型 (NR = Name/人名)
                        if entity_type in ['PERSON', 'PER', 'NR', 'nr']:
                            if self._is_valid_name(entity_text):
                                mentions.append(CharacterMention(
                                    text=entity_text,
                                    start=start_pos,
                                    end=end_pos,
                                    sent_id=sent_id
                                ))
            else:
                # token 级别标注格式 (ELECTRA 格式)
                # 注意：这里不支持 offset，因为需要完整句子
                if offset == 0:
                    persons = self._extract_persons_from_tokens(result, "")
                    for name, start, end in persons:
                        if self._is_valid_name(name):
                            mentions.append(CharacterMention(
                                text=name,
                                start=start,
                                end=end,
                                sent_id=sent_id
                            ))
        
        # 字典格式（备用）
        elif isinstance(result, dict):
            # 标准格式
            if 'entities' in result:
                for entity in result['entities']:
                    if isinstance(entity, (list, tuple)) and len(entity) >= 2:
                        entity_text = entity[0]
                        entity_type = entity[1]
                        
                        # 检查是否是人名类型
                        if entity_type in ['PERSON', 'PER', 'NR', 'nr']:
                            start_pos = (entity[2] if len(entity) > 2 else 0) + offset
                            end_pos = (entity[3] if len(entity) > 3 else start_pos + len(entity_text)) + offset
                            
                            # 验证人名有效性
                            if self._is_valid_name(entity_text):
                                mentions.append(CharacterMention(
                                    text=entity_text,
                                    start=start_pos,
                                    end=end_pos,
                                    sent_id=sent_id
                                ))
            
            # 备用格式: {'ner': [...]}
            elif 'ner' in result:
                for entity in result['ner']:
                    if isinstance(entity, (list, tuple)) and len(entity) >= 2:
                        entity_text = entity[0]
                        entity_type = entity[1]
                        
                        if entity_type in ['PERSON', 'PER', 'NR', 'nr']:
                            start_pos = (entity[2] if len(entity) > 2 else 0) + offset
                            end_pos = (entity[3] if len(entity) > 3 else start_pos + len(entity_text)) + offset
                            
                            if self._is_valid_name(entity_text):
                                mentions.append(CharacterMention(
                                    text=entity_text,
                                    start=start_pos,
                                    end=end_pos,
                                    sent_id=sent_id
                                ))
    
    def _extract_persons_from_tokens(self, tokens: List, sentence: str) -> List[Tuple[str, int, int]]:
        """从 token 级别的标注中提取完整人名"""
        persons = []
        current_person = []
        current_start = -1
        
        for idx, token_tags in enumerate(tokens):
            # 跳过空标注
            if not token_tags:
                if current_person:
                    # 结束当前人名
                    name = ''.join(current_person)
                    if len(name) >= 2:  # 至少2个字
                        persons.append((name, current_start, current_start + len(name)))
                    current_person = []
                    current_start = -1
                continue
            
            # 检查是否是 PERSON 标签
            for token_tag in token_tags:
                if isinstance(token_tag, tuple) and len(token_tag) >= 2:
                    char, tag = token_tag[0], token_tag[1]
                    
                    if tag == 'PERSON':
                        if not current_person:
                            current_start = idx
                        current_person.append(char)
                        break
                    else:
                        # 非人名标签，结束当前人名
                        if current_person:
                            name = ''.join(current_person)
                            if len(name) >= 2:
                                persons.append((name, current_start, current_start + len(name)))
                            current_person = []
                            current_start = -1
        
        # 处理最后一个人名
        if current_person:
            name = ''.join(current_person)
            if len(name) >= 2:
                persons.append((name, current_start, current_start + len(name)))
        
        return persons
    
    def _recognize_with_rules(self, sentences: List[str]) -> List[CharacterMention]:
        """使用规则识别人名"""
        mentions = []
        
        for sent_id, sentence in enumerate(sentences):
            # 规则1: 姓 + 1-2字名
            pattern1 = r'([' + ''.join(self.common_surnames) + r'])([一-龥]{1,2})'
            for match in re.finditer(pattern1, sentence):
                name = match.group(0)
                if self._is_valid_name(name):
                    mentions.append(CharacterMention(
                        text=name,
                        start=match.start(),
                        end=match.end(),
                        sent_id=sent_id
                    ))
            
            # 规则2: 2-3字连续中文（可能是名字）
            pattern2 = r'[一-龥]{2,3}'
            for match in re.finditer(pattern2, sentence):
                name = match.group(0)
                if self._is_valid_name(name) and self._looks_like_name(name):
                    mentions.append(CharacterMention(
                        text=name,
                        start=match.start(),
                        end=match.end(),
                        sent_id=sent_id
                    ))
        
        return mentions
    
    def _is_valid_name(self, name: str) -> bool:
        """判断是否是有效的名字"""
        # 长度检查
        if len(name) < settings.NAME_MIN_LENGTH or len(name) > settings.NAME_MAX_LENGTH:
            return False
        
        # 排除常见非人名词汇
        exclude_words = {
            "这个", "那个", "什么", "怎么", "为什么", "如何",
            "现在", "以前", "后来", "当时", "今天", "明天", "昨天",
            "我们", "你们", "他们", "她们", "它们",
            "自己", "别人", "大家", "所有",
        }
        
        return name not in exclude_words
    
    def _looks_like_name(self, text: str) -> bool:
        """判断文本是否看起来像名字"""
        # 如果第一个字是常见姓氏，很可能是名字
        if text[0] in self.common_surnames:
            return True
        
        # 如果包含常见名字用字
        name_chars = set("文武德明华英国建立志强勇刚伟强秀兰芳丽娟红梅")
        if any(c in name_chars for c in text):
            return True
        
        return False
    
    def _deduplicate_mentions(self, mentions: List[CharacterMention]) -> List[CharacterMention]:
        """去重"""
        seen = set()
        unique_mentions = []
        
        for mention in mentions:
            key = (mention.text, mention.sent_id, mention.start)
            if key not in seen:
                seen.add(key)
                unique_mentions.append(mention)
        
        return unique_mentions
