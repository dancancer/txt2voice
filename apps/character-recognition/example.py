"""使用示例"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.models import RecognitionRequest, RecognitionOptions
from src.recognizer import CharacterRecognizer


def main():
    """运行示例"""
    
    # 示例小说文本
    novel_text = """
    第一章
    
    雅芙是老板的女儿，人称大小姐。她今年二十岁，美丽大方。
    
    "大小姐，王先生来了。"老管家说道。
    
    "让他进来吧。"雅芙淡淡地说。
    
    王强走了进来，看到雅芙坐在沙发上。"雅芙小姐，好久不见。"他笑着说。
    
    "王强，你来找我有什么事？"她问道。
    
    他们俩是老朋友了。王强的父亲和老板是合作伙伴。
    
    "我想和你谈谈那个项目。"王强说道。
    
    雅芙点了点头。她早就料到他会来。
    
    老管家给他们端来了茶。"谢谢你，张叔。"王强说。
    
    "不客气，王少爷。"老张微笑着退了出去。
    """
    
    print("=" * 50)
    print("中文小说人物识别系统 - 示例")
    print("=" * 50)
    print()
    
    # 创建识别器
    print("正在初始化识别器...")
    recognizer = CharacterRecognizer()
    
    # 创建请求
    request = RecognitionRequest(
        text=novel_text,
        options=RecognitionOptions(
            enable_coreference=True,
            enable_dialogue=True,
            enable_relations=True,
            similarity_threshold=0.8
        )
    )
    
    # 执行识别
    print("正在识别人物...\n")
    result = recognizer.recognize(request)
    
    # 输出结果
    print("=" * 50)
    print("识别结果")
    print("=" * 50)
    print()
    
    print(f"共识别出 {result.statistics.total_characters} 个人物：")
    print()
    
    for i, char in enumerate(result.characters, 1):
        print(f"{i}. {char.name}")
        print(f"   - 别名: {', '.join(char.aliases) if char.aliases else '无'}")
        print(f"   - 性别: {char.gender}")
        print(f"   - 提及次数: {char.mentions}")
        print(f"   - 台词数: {char.quotes}")
        print(f"   - 首次出现: 第 {char.first_appearance_idx} 字符")
        print()
    
    print("=" * 50)
    print("别名映射")
    print("=" * 50)
    print()
    
    for alias, main_name in result.alias_map.items():
        if alias != main_name:
            print(f"{alias} → {main_name}")
    print()
    
    if result.relations:
        print("=" * 50)
        print("人物关系")
        print("=" * 50)
        print()
        
        for rel in result.relations[:10]:  # 只显示前10个
            print(f"{rel.from_char} ←→ {rel.to_char} ({rel.relation_type}, 权重: {rel.weight})")
        print()
    
    print("=" * 50)
    print("统计信息")
    print("=" * 50)
    print()
    print(f"文本长度: {result.statistics.text_length} 字符")
    print(f"句子数量: {result.statistics.sentence_count}")
    print(f"总提及次数: {result.statistics.total_mentions}")
    print(f"总对话数: {result.statistics.total_dialogues}")
    print(f"处理耗时: {result.statistics.processing_time:.2f} 秒")
    print()


if __name__ == "__main__":
    main()
