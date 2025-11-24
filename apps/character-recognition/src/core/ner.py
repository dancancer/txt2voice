"""基于 Jieba 的 NER 人名识别模块"""
import re
from typing import Callable, List, Dict, Any, Optional, Tuple
from collections import defaultdict
from loguru import logger

from ..config import settings
from ..models.character import CharacterMention


class NERRecognizer:
    """基于 Jieba 的人名识别器"""

    def __init__(self):
        self.model = None
        self._initialized = False

        # 动态角色名字典（运行时发现的角色名）
        self.discovered_names = set()

        # 通用中文人名模式识别规则
        self.name_patterns = [
            # 中文姓氏 + 名字模式
            r'^[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳唐罗薛伍余米贝姚孟顾尹姜邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜][一-龯]{1,2}$',
            # 常见称呼后缀模式
            r'^[一-龯]{1,3}[娘父母儿子女哥姐弟妹][一-龯]*$',
            # 重复姓氏模式（如：李李、王王）
            r'^([赵钱孙李周吴郑王冯陈])\1$',
        ]

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
        """初始化 Jieba 分词器"""
        if self._initialized:
            return

        try:
            import jieba
            import jieba.posseg as pseg

            logger.info("正在初始化通用 Jieba 分词器...")

            # 优化 Jieba 设置以提高人名识别
            # 调整分词粒度，有助于人名识别
            jieba.enable_parallel(4)  # 启用并行分词
            jieba.setLogLevel(jieba.logging.INFO)  # 设置日志级别

            # 初始化 Jieba（触发词典构建）
            test_text = "测试初始化"
            list(jieba.cut(test_text))

            self.model = jieba
            self.posseg = pseg
            self._initialized = True

            logger.info("通用 Jieba 分词器初始化完成")

        except ImportError:
            logger.error("Jieba 未安装，请运行: pip install jieba")
            raise
        except Exception as e:
            logger.error(f"Jieba 初始化失败: {e}")
            raise

    def recognize(self, text: str, callback: Optional[Callable] = None) -> List[CharacterMention]:
        """
        使用 Jieba 进行人名识别

        Args:
            text: 输入文本
            callback: 进度回调函数

        Returns:
            List[CharacterMention]: 识别到的角色提及列表
        """
        if not self._initialized:
            self.initialize()

        if callback:
            callback(0, "开始 Jieba 角色识别...")

        mentions = []
        character_counts = defaultdict(int)

        # 分句处理，提高识别准确率
        sentences = self._split_sentences(text)
        total_sentences = len(sentences)

        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue

            if callback and i % 10 == 0:
                progress = int((i / total_sentences) * 100)
                callback(progress, f"处理第 {i+1}/{total_sentences} 句...")

            # 方法1：Jieba 词性标注识别人名
            words_with_pos = self.posseg.cut(sentence)
            for word, flag in words_with_pos:
                if 'nr' in str(flag) and len(word) >= 2 and len(word) <= 4:
                    character_counts[word] += 1
                    self.discovered_names.add(word)  # 动态记录发现的人名

            # 方法2：正则表达式识别对话中的角色
            dialogue_matches = re.findall(r'([一-龯]{2,4})(?:说|道|笑|看|想|叫|喊|问|答|曰)', sentence)
            for name in dialogue_matches:
                if len(name) >= 2 and len(name) <= 4:
                    character_counts[name] += 1
                    self.discovered_names.add(name)  # 动态记录发现的人名

            # 方法3：通用中文人名模式识别
            words = list(self.model.cut(sentence))
            for word in words:
                if (len(word) >= 2 and len(word) <= 4 and
                    re.match(r'^[一-龯]+$', word) and  # 纯中文字符
                    word not in ['这个', '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '然后', '接着', '最后', '没有', '一样', '还有', '可以', '应该', '已经', '正在']):

                    # 检查是否符合人名模式
                    if self._is_likely_name(word):
                        character_counts[word] += 1
                        self.discovered_names.add(word)  # 动态记录发现的人名

        if callback:
            callback(100, "角色识别完成")

        # 转换为 CharacterMention 对象
        for name, count in character_counts.items():
            if count >= 2:  # 至少出现2次
                importance = "高" if count > 10 else "中" if count > 3 else "低"

                mention = CharacterMention(
                    text=name,
                    start_pos=0,  # Jieba 不提供位置信息
                    end_pos=len(name),
                    confidence=min(0.9, 0.5 + count * 0.01),  # 基于出现频率的置信度
                    source="jieba_ner"
                )
                mentions.append(mention)

        logger.info(f"Jieba 识别完成，共识别到 {len(mentions)} 个角色提及")
        return mentions

    def _is_likely_name(self, word: str) -> bool:
        """判断一个词是否可能是人名（通用规则）"""
        if len(word) < 2 or len(word) > 4:
            return False

        # 规则1：检查是否符合预设的人名模式
        for pattern in self.name_patterns:
            if re.match(pattern, word):
                return True

        # 规则2：首字是常见姓氏
        if word[0] in self.common_surnames:
            return True

        # 规则3：包含称呼后缀，但不是单纯的描述词
        if word.endswith(('娘', '父', '母', '儿', '子', '哥', '姐', '弟', '妹', '公', '伯', '叔', '姨', '舅')):
            # 排除明显不是人名的词
            non_names = {'这个', '那个', '所有', '任何', '每个', '你们', '我们', '他们', '自己', '大家', '宝宝', '亲爱的', '朋友', '同学'}
            if word not in non_names:
                return True

        # 规则4：避免常见的非人名词
        non_human_words = {
            '什么', '怎么', '为什么', '哪里', '什么时候', '哪个', '如何',
            '工作', '学习', '生活', '时间', '地方', '东西', '事情', '问题',
            '方法', '方式', '情况', '条件', '结果', '开始', '结束', '过程',
            '今天', '明天', '昨天', '上午', '下午', '晚上', '早上', '中午', '晚上',
            '这里', '那里', '哪里', '到处', '各处', '随处', '家中', '家里', '门外',
            '地上', '天上', '水中', '口中', '眼中', '心中', '手里', '头里'
        }
        if word in non_human_words:
            return False

        # 规则5：连续的汉字，可能是人名
        if re.match(r'^[一-龯]{2,4}$', word):
            # 进一步检查，避免常见的功能词
            common_function_words = {
                '开始', '结束', '继续', '停止', '进行', '完成', '通过', '获得',
                '实现', '达到', '满足', '超过', '少于', '等于', '大于', '小于'
            }
            if word not in common_function_words:
                return True

        return False

    def _split_sentences(self, text: str) -> List[str]:
        """将文本分割为句子"""
        # 使用中文标点符号分割句子
        sentences = re.split(r'[。！？；]', text)
        return [s.strip() for s in sentences if s.strip()]

    def get_character_statistics(self, text: str) -> Dict[str, Any]:
        """获取角色统计信息"""
        mentions = self.recognize(text)

        # 统计角色出现次数
        character_stats = defaultdict(int)
        for mention in mentions:
            character_stats[mention.text] += 1

        # 生成统计结果
        results = []
        for name, count in sorted(character_stats.items(), key=lambda x: x[1], reverse=True):
            importance = "高" if count > 10 else "中" if count > 3 else "低"

            result = {
                "name": name,
                "appearance_count": count,
                "importance": importance,
                "confidence": next(m.confidence for m in mentions if m.text == name),
                "source": "jieba_ner"
            }
            results.append(result)

        return {
            "total_characters": len(results),
            "high_importance": len([r for r in results if r["importance"] == "高"]),
            "medium_importance": len([r for r in results if r["importance"] == "中"]),
            "low_importance": len([r for r in results if r["importance"] == "低"]),
            "characters": results
        }