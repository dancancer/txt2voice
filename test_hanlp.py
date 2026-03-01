#!/usr/bin/env python3
"""
HanLP 功能测试脚本
"""

import sys
import os
from pathlib import Path

def test_hanlp_basic():
    """测试 HanLP 基本功能"""
    print("🚀 HanLP 功能测试")
    print("=" * 60)

    try:
        import hanlp
        print(f"✓ HanLP 导入成功")
        print(f"✓ HanLP 版本: {hanlp.__version__}")

        # 测试基本命名实体识别
        text = '二娘和小然在街上说话，小明说："你好啊！"'
        print(f"\n📝 测试文本: {text}")

        # 加载 NER 模型
        print("\n🔄 正在加载 MSRA NER ALBERT 模型...")
        try:
            HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_ALBERT_BASE_ZH)
            print("✓ 模型加载成功")

            # 进行命名实体识别
            result = HanLP(text)
            print(f"\n🎯 NER 结果类型: {type(result)}")
            print(f"🎯 NER 结果: {result}")

            # 提取人名
            names = []
            if isinstance(result, dict) and 'ner' in result:
                entities = result['ner']
                for entity in entities:
                    if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                        name, entity_type, confidence = entity[:3]
                        if entity_type == 'PER' and confidence > 0.5:
                            names.append(name)
            elif isinstance(result, list):
                # 处理列表格式的结果
                for entity in result:
                    if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                        name, entity_type, confidence = entity[:3]
                        if entity_type == 'PER' and confidence > 0.5:
                            names.append(name)

            print(f"\n👤 识别到的人名: {names}")
            print("✓ HanLP 角色识别功能正常")
            return True

        except Exception as model_error:
            print(f"⚠️ 模型加载失败: {model_error}")
            print("🔄 尝试使用简化版模型...")

            # 尝试使用简化版模型
            try:
                HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH)
                print("✓ 简化版模型加载成功")

                result = HanLP(text)
                print(f"🎯 简化版 NER 结果: {result}")

                names = []
                if isinstance(result, dict) and 'ner' in result:
                    entities = result['ner']
                    for entity in entities:
                        if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                            name, entity_type, confidence = entity[:3]
                            if entity_type == 'PER' and confidence > 0.5:
                                names.append(name)

                print(f"\n👤 识别到的人名: {names}")
                print("✓ HanLP 简化版角色识别功能正常")
                return True

            except Exception as fallback_error:
                print(f"❌ 简化版模型也失败: {fallback_error}")
                return False

    except ImportError as import_error:
        print(f"❌ HanLP 导入失败: {import_error}")
        return False
    except Exception as general_error:
        print(f"❌ 测试过程中出现错误: {general_error}")
        return False

def test_with_local_data():
    """使用本地数据进行测试"""
    print("\n" + "=" * 60)
    print("📖 使用本地数据测试")
    print("=" * 60)

    # 检查 1.txt 文件
    data_file = Path('/app/workspace/1.txt')
    if not data_file.exists():
        print(f"❌ 测试文件不存在: {data_file}")
        return False

    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            text = f.read()

        print(f"✓ 成功读取文件: {data_file}")
        print(f"📊 文本长度: {len(text)} 字符")
        print(f"📊 文本预览: {text[:200]}...")

        # 使用 HanLP 进行角色识别
        import hanlp
        print("\n🔄 正在加载模型进行角色识别...")

        try:
            HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_ALBERT_BASE_ZH)
        except:
            HanLP = hanlp.load(hanlp.pretrained.ner.MSRA_NER_BERT_BASE_ZH)

        print("✓ 模型加载完成，开始识别...")

        # 分批处理长文本
        max_length = 512
        text_chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]

        all_names = {}
        for i, chunk in enumerate(text_chunks):
            try:
                result = HanLP(chunk)

                # 提取人名
                if isinstance(result, dict) and 'ner' in result:
                    entities = result['ner']
                    for entity in entities:
                        if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                            name, entity_type, confidence = entity[:3]
                            if entity_type == 'PER' and confidence > 0.5:
                                all_names[name] = all_names.get(name, 0) + 1
                elif isinstance(result, list):
                    for entity in result:
                        if isinstance(entity, (list, tuple)) and len(entity) >= 3:
                            name, entity_type, confidence = entity[:3]
                            if entity_type == 'PER' and confidence > 0.5:
                                all_names[name] = all_names.get(name, 0) + 1

                print(f"✓ 处理进度: {i+1}/{len(text_chunks)} ({((i+1)/len(text_chunks)*100):.1f}%)")

            except Exception as chunk_error:
                print(f"⚠️ 处理第 {i+1} 块文本时出错: {chunk_error}")
                continue

        # 排序并显示结果
        sorted_names = sorted(all_names.items(), key=lambda x: x[1], reverse=True)

        print(f"\n✅ 角色识别完成！")
        print(f"📊 总共识别到 {len(sorted_names)} 个角色:")

        for i, (name, count) in enumerate(sorted_names[:20], 1):  # 只显示前 20 个
            importance = "高" if count > 10 else "中" if count > 3 else "低"
            print(f"  {i:2d}. {name:10s} ({count:3d}次) - {importance}")

        # 保存结果
        import json
        results = [
            {
                "name": name,
                "aliases": [],
                "appearance_count": count,
                "importance": "高" if count > 10 else "中" if count > 3 else "低"
            }
            for name, count in sorted_names if count >= 2
        ]

        result_file = '/app/workspace/hanlp_recognition_result.json'
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\n💾 结果已保存到: {result_file}")

        # 与目标结果对比
        target_file = Path('/app/workspace/characters.txt')
        if target_file.exists():
            print(f"\n📋 与目标结果对比...")
            try:
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if content.strip().startswith('['):
                        target_chars = json.loads(content)
                        target_names = {char['name']: char for char in target_chars}

                        detected_names = {char['name'] for char in results}
                        target_set = set(target_names.keys())

                        print(f"📈 统计信息:")
                        print(f"  检测到角色数: {len(detected_names)}")
                        print(f"  目标角色数: {len(target_set)}")
                        print(f"  重叠角色数: {len(detected_names & target_set)}")
                        print(f"  检测准确率: {len(detected_names & target_set) / max(len(target_set), 1) * 100:.1f}%")

                        correct_names = detected_names & target_set
                        missed_names = target_set - detected_names
                        extra_names = detected_names - target_set

                        if correct_names:
                            print(f"\n✅ 正确识别的角色 ({len(correct_names)}):")
                            for name in sorted(correct_names):
                                print(f"  • {name}")

                        if missed_names:
                            print(f"\n❌ 遗漏的角色 ({len(missed_names)}):")
                            for name in sorted(missed_names):
                                print(f"  • {name}")

                        if extra_names:
                            print(f"\n🔍 误识别的角色 ({len(extra_names)}):")
                            for name in sorted(extra_names)[:10]:  # 只显示前10个
                                print(f"  • {name}")

            except Exception as compare_error:
                print(f"⚠️ 对比分析失败: {compare_error}")

        return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    """主函数"""
    print("🎯 开始 HanLP 功能测试...")

    # 基本功能测试
    basic_success = test_hanlp_basic()

    if basic_success:
        print("\n🎉 基本功能测试通过！")

        # 本地数据测试
        local_success = test_with_local_data()

        if local_success:
            print("\n🎉 本地数据测试完成！")
            print("\n🏆 所有测试都成功完成！")
        else:
            print("\n⚠️ 本地数据测试失败")
    else:
        print("\n❌ 基本功能测试失败")
        print("⚠️ 跳过本地数据测试")

if __name__ == "__main__":
    main()