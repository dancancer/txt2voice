#!/usr/bin/env python3
"""
基于 Jieba 的智能角色识别脚本
结合词性标注和规则匹配来提高识别准确率
"""

import jieba
import jieba.posseg as pseg
import re
from collections import defaultdict

def jieba_character_recognition(text, min_appearance=2):
    """使用 Jieba 进行角色识别"""
    print("🚀 基于 Jieba 的角色识别开始...")

    # 添加自定义词典以提高人名识别准确率
    custom_names = ['二娘', '三娘', '大娘', '小然', '白然', '父亲', '老头', '肥猪男', '英俊公子']
    for name in custom_names:
        jieba.add_word(name, freq=1000, tag='nr')  # 标记为人名

    character_counts = defaultdict(int)
    total_words = 0

    # 分句处理，提高识别准确率
    sentences = re.split(r'[。！？；]', text)

    for sentence in sentences:
        if not sentence.strip():
            continue

        # 词性标注
        words_with_pos = pseg.cut(sentence)

        for word, flag in words_with_pos:
            total_words += 1

            # 方法1：直接识别词性标注为人名的词
            if 'nr' in str(flag) and len(word) >= 2 and len(word) <= 4:
                character_counts[word] += 1

            # 方法2：识别特定模式的词（可能是人名）
            elif (len(word) >= 2 and len(word) <= 4 and
                  re.match(r'^[一-龯]+$', word) and  # 纯中文字符
                  word not in ['这个', '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '然后', '接着', '最后']):

                # 检查是否包含称呼后缀
                if word.endswith(('娘', '父', '母', '儿', '子', '哥', '姐', '弟', '妹')):
                    character_counts[word] += 1

                # 检查是否是复合名字
                elif re.match(r'.*[娘父母儿子女哥姐弟妹].*', word):
                    character_counts[word] += 1

    # 方法3：使用正则表达式补充识别对话中的角色
    dialogue_pattern = r'([一-龯]{2,4})(?:说|道|笑|看|想|叫|喊|问|答|曰)'
    dialogue_matches = re.findall(dialogue_pattern, text)
    for name in dialogue_matches:
        if len(name) >= 2 and len(name) <= 4:
            character_counts[name] += 1

    # 生成结果
    results = []
    for name, count in sorted(character_counts.items(), key=lambda x: x[1], reverse=True):
        if count >= min_appearance:
            importance = "高" if count > 10 else "中" if count > 3 else "低"
            results.append({
                "name": name,
                "aliases": [],
                "appearance_count": count,
                "importance": importance
            })

    print(f"✅ 识别完成，共识别到 {len(results)} 个角色")
    return results

def compare_with_target(detected, target_file='characters.txt'):
    """与目标结果进行对比"""
    import json

    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if content.strip().startswith('['):
                target_chars = json.loads(content)
                target_names = {char['name']: char for char in target_chars}
            else:
                print("⚠️ 目标文件格式不是JSON")
                return None

    except Exception as e:
        print(f"❌ 无法读取目标文件: {e}")
        return None

    detected_names = {char['name'] for char in detected}
    target_set = set(target_names.keys())

    print(f"\n📊 Jieba 识别结果对比分析:")
    print(f"  检测到角色数: {len(detected)}")
    print(f"  目标角色数: {len(target_set)}")
    print(f"  重叠角色数: {len(detected_names & target_set)}")
    print(f"  检测准确率: {len(detected_names & target_set) / max(len(target_set), 1) * 100:.1f}%")

    correct_names = detected_names & target_set
    missed_names = target_set - detected_names
    extra_names = detected_names - target_set

    if correct_names:
        print(f"\n✅ 正确识别的角色 ({len(correct_names)}):")
        for name in sorted(correct_names):
            detected_char = next(c for c in detected if c['name'] == name)
            target_char = target_names[name]
            print(f"  • {name}: 检测次数={detected_char['appearance_count']}, 目标次数={target_char['appearance_count']}")

    if missed_names:
        print(f"\n❌ 遗漏的角色 ({len(missed_names)}):")
        for name in sorted(missed_names):
            target_char = target_names[name]
            print(f"  • {name}: 目标次数={target_char['appearance_count']}")

    if extra_names:
        print(f"\n🔍 误识别的角色 ({len(extra_names)}):")
        for name in sorted(extra_names)[:10]:  # 只显示前10个
            detected_char = next(c for c in detected if c['name'] == name)
            print(f"  • {name}: 检测次数={detected_char['appearance_count']}")

    return {
        'accuracy': len(detected_names & target_set) / max(len(target_set), 1) * 100,
        'correct': len(correct_names),
        'missed': len(missed_names),
        'extra': len(extra_names)
    }

def main():
    """主函数"""
    print("🎯 Jieba 智能角色识别测试")
    print("=" * 60)

    # 读取测试文件
    try:
        with open('1.txt', 'r', encoding='utf-8') as f:
            text = f.read()
        print(f"✓ 文本长度: {len(text)} 字符")
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        return

    # 进行角色识别
    print(f"\n🤖 开始 Jieba 角色识别...")
    results = jieba_character_recognition(text)

    if not results:
        print("❌ 识别失败")
        return

    print(f"\n📋 识别结果 (前20个):")
    for i, char in enumerate(results[:20], 1):
        print(f"  {i:2d}. {char['name']:10s} ({char['appearance_count']:3d}次) - {char['importance']}")

    # 保存结果
    import json
    output_file = 'jieba_recognition_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 结果已保存到: {output_file}")

    # 与目标结果对比
    comparison = compare_with_target(results)
    if comparison:
        print(f"\n🎯 总体准确率: {comparison['accuracy']:.1f}%")

if __name__ == "__main__":
    main()