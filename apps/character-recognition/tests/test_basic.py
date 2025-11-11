"""基础测试"""
import sys
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.core.preprocessor import TextPreprocessor
from src.core.alias import AliasRecognizer
from src.models import RecognitionRequest, RecognitionOptions


def test_preprocessor():
    """测试预处理器"""
    preprocessor = TextPreprocessor()
    
    text = "这是第一句。这是第二句！这是第三句？"
    cleaned, sentences, bounds = preprocessor.preprocess(text)
    
    assert len(sentences) == 3
    assert sentences[0] == "这是第一句。"
    assert sentences[1] == "这是第二句！"
    assert sentences[2] == "这是第三句？"


def test_alias_recognizer():
    """测试别名识别"""
    recognizer = AliasRecognizer()
    
    sentences = [
        "老张走了进来。",
        "王叔看了看大小姐。",
        "月儿笑着说道。"
    ]
    
    aliases = recognizer.recognize_aliases(sentences)
    
    assert len(aliases) > 0
    
    # 测试归一化
    assert recognizer.normalize_name("老张") == "张"
    assert recognizer.normalize_name("王叔") == "王"
    assert recognizer.normalize_name("月儿") == "月"


def test_request_model():
    """测试请求模型"""
    request = RecognitionRequest(
        text="测试文本",
        options=RecognitionOptions(
            enable_coreference=True,
            enable_dialogue=True,
            similarity_threshold=0.8
        )
    )
    
    assert request.text == "测试文本"
    assert request.options.enable_coreference is True
    assert request.options.similarity_threshold == 0.8


def test_sample_novel():
    """测试示例小说"""
    text = """
    雅芙是老板的女儿。大小姐今天很高兴。
    "你好啊！"王强笑着说道。
    "你也好！"雅芙回答道。
    他们俩是好朋友。
    """
    
    from src.recognizer import CharacterRecognizer
    
    recognizer = CharacterRecognizer()
    request = RecognitionRequest(text=text)
    
    # 注意：这个测试需要模型，可能会失败
    # result = recognizer.recognize(request)
    # assert len(result.characters) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
