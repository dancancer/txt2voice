#!/usr/bin/env python3
"""
本地角色识别测试脚本
无需 Docker，直接使用 Python 环境进行角色识别
"""

import sys
import os
import json
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
char_recognition_path = project_root / "apps" / "character-recognition"

if char_recognition_path.exists():
    sys.path.insert(0, str(char_recognition_path))
    print(f"✓ 添加路径: {char_recognition_path}")
else:
    print(f"✗ 路径不存在: {char_recognition_path}")
    sys.exit(1)

def install_required_packages():
    """安装必要的包"""
    required_packages = [
        "hanlp>=2.1.0",
        "sentence-transformers",
        "loguru",
        "numpy"
    ]

    for package in required_packages:
        try:
            __import__(package.replace("-", "_").split(">=")[0].split("==")[0])
            print(f"✓ {package} 已安装")
        except ImportError:
            print(f"⚠ 需要安装: {package}")
            print(f"运行: pip install {package}")

def simple_character_recognition(text):
    """简单的角色识别实现（基于启发式规则）"""
    import re

    # 常见中文人名模式
    name_patterns = [
        r'([A-Za-z\u4e00-\u9fff]{2,4})(?:说|道|笑|看|想|叫|喊)',
        r'"([^"]+)"(?:说|道|问|答)',
        r'"([^"]+)"\s*(?:说|道|问|答)',
        r'([A-Za-z\u4e00-\u9fff]{2,4})(?:，|。|：|！|？)',
    ]

    characters = {}

    for pattern in name_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            name = match.strip()
            if len(name) >= 2 and len(name) <= 4:
                # 过滤掉明显不是人名的词
                if not any(word in name for word in ['这', '那', '他', '她', '我', '你', '的', '了', '是', '在', '有', '个']):
                    characters[name] = characters.get(name, 0) + 1

    # 按出现次数排序
    sorted_chars = sorted(characters.items(), key=lambda x: x[1], reverse=True)

    return [
        {
            "name": name,
            "aliases": [],
            "appearance_count": count,
            "importance": "高" if count > 10 else "中" if count > 3 else "低"
        }
        for name, count in sorted_chars if count >= 2
    ]

def advanced_character_recognition(text):
    """尝试使用 HanLP 进行角色识别"""
    try:
        import hanlp

        print("✓ 使用 HanLP 进行高级角色识别")

        # 加载 HanLP NER 模型
        try:
            HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH)
        except:
            print("⚠ 无法加载 HanLP NER 模型，使用基础版本")
            HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_ALBERT_BASE_ZH)

        # 分批处理长文本
        max_length = 512
        text_chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]

        all_entities = []
        for chunk in text_chunks:
            try:
                result = HanLP(chunk)
                if isinstance(result, dict) and 'ner' in result:
                    entities = result['ner']
                    all_entities.extend(entities)
                elif isinstance(result, list):
                    all_entities.extend(result)
            except Exception as e:
                print(f"⚠ 处理文本块时出错: {e}")
                continue

        # 统计人名
        character_counts = {}
        for entity in all_entities:
            if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                name, entity_type, confidence = entity[:3]
                if entity_type == 'PER' and confidence > 0.5:
                    character_counts[name] = character_counts.get(name, 0) + 1

        # 生成结果
        results = []
        for name, count in sorted(character_counts.items(), key=lambda x: x[1], reverse=True):
            if count >= 2:  # 至少出现 2 次
                results.append({
                    "name": name,
                    "aliases": [],
                    "appearance_count": count,
                    "importance": "高" if count > 10 else "中" if count > 3 else "低"
                })

        return results

    except ImportError:
        print("⚠ HanLP 未安装，使用简单识别")
        return None
    except Exception as e:
        print(f"⚠ HanLP 识别失败: {e}")
        return None

def load_target_characters():
    """加载目标角色数据"""
    try:
        with open('characters.txt', 'r', encoding='utf-8') as f:
            content = f.read()
            # 移除 JSON 格式的外层，只提取角色信息
            if content.strip().startswith('['):
                characters = json.loads(content)
                return {char['name']: char for char in characters}
    except Exception as e:
        print(f"⚠ 无法加载 characters.txt: {e}")
    return {}

def compare_results(detected, target):
    """比较识别结果与目标结果"""
    print("\n" + "="*60)
    print("📊 识别结果对比分析")
    print("="*60)

    detected_names = {char['name'] for char in detected}
    target_names = {char['name'] for char in target.values()}

    print(f"\n📈 统计信息:")
    print(f"  检测到角色数: {len(detected)}")
    print(f"  目标角色数: {len(target)}")
    print(f"  重叠角色数: {len(detected_names & target_names)}")
    print(f"  检测准确率: {len(detected_names & target_names) / max(len(target_names), 1) * 100:.1f}%")

    print(f"\n✅ 正确识别的角色:")
    for name in sorted(detected_names & target_names):
        detected_char = next(c for c in detected if c['name'] == name)
        target_char = target[name]
        print(f"  {name}: 检测次数={detected_char['appearance_count']}, 目标次数={target_char['appearance_count']}")

    print(f"\n❌ 遗漏的角色:")
    for name in sorted(target_names - detected_names):
        target_char = target[name]
        print(f"  {name}: 目标次数={target_char['appearance_count']}")

    print(f"\n🔍 误识别的角色:")
    for name in sorted(detected_names - target_names):
        detected_char = next(c for c in detected if c['name'] == name)
        print(f"  {name}: 检测次数={detected_char['appearance_count']}")

def main():
    print("🚀 本地角色识别测试")
    print("="*60)

    # 检查必要文件
    if not Path('1.txt').exists():
        print("❌ 测试文件 1.txt 不存在")
        return

    # 加载测试文本
    print(f"\n📖 读取测试文件...")
    try:
        with open('1.txt', 'r', encoding='utf-8') as f:
            text = f.read()
        print(f"✓ 文本长度: {len(text)} 字符")
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        return

    # 安装检查
    print(f"\n🔧 检查依赖...")
    install_required_packages()

    # 加载目标结果
    print(f"\n📋 加载目标结果...")
    target_chars = load_target_characters()
    if target_chars:
        print(f"✓ 加载了 {len(target_chars)} 个目标角色")
    else:
        print("⚠ 无法加载目标结果，将只显示识别结果")

    # 尝试高级识别
    print(f"\n🤖 开始角色识别...")
    results = advanced_character_recognition(text)

    # 如果高级识别失败，使用简单识别
    if not results:
        print("🔄 使用简单规则识别...")
        results = simple_character_recognition(text)

    if not results:
        print("❌ 识别失败")
        return

    print(f"\n✅ 识别完成，共识别到 {len(results)} 个角色:")
    for i, char in enumerate(results[:10], 1):  # 只显示前 10 个
        print(f"  {i:2d}. {char['name']:10s} ({char['appearance_count']:3d}次) - {char['importance']}")

    # 保存结果
    output_file = 'recognition_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 结果已保存到: {output_file}")

    # 如果有目标结果，进行对比
    if target_chars:
        compare_results(results, target_chars)

if __name__ == "__main__":
    main()