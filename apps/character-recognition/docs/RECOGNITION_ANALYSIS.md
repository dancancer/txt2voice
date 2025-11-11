# 人名识别结果来源分析

**测试文本**: "张三是个工程师，大家都叫他小张。李四认识张三很久了。王芳也是工程师。"

## 📊 结果对比

### 1. BERT BASE 模型直接输出（容器内测试）
```python
识别结果数量: 5
('张三', 'NR', 0, 2)   ✅ 正确
('张', 'NR', 14, 15)   ❌ 错误 - 只识别了"小张"中的"张"
('李四', 'NR', 16, 18)  ✅ 正确
('张三', 'NR', 20, 22)  ✅ 正确
('王芳', 'NR', 26, 28)  ✅ 正确
```

**NER 模型准确率**: 4/5 = 80%

### 2. API 完整输出
```json
{
  "total_characters": 12,
  "characters": [
    {"name": "张三", "mentions": 2},      ✅ 来自 NER
    {"name": "李四", "mentions": 1},      ✅ 来自 NER  
    {"name": "王芳", "mentions": 1},      ✅ 来自 NER
    {"name": "张三是", "mentions": 1},    ❌ 来自规则（误识别）
    {"name": "李四认", "mentions": 1},    ❌ 来自规则（误识别）
    {"name": "张三很", "mentions": 1},    ❌ 来自规则（误识别）
    {"name": "王芳也", "mentions": 1},    ❌ 来自规则（误识别）
    {"name": "三是个工", "mentions": 1},  ❌ 来自规则（误识别）
    {"name": "大家都叫", "mentions": 1},  ❌ 来自规则（误识别）
    {"name": "小张", "mentions": 1},      ⚠️ 来自规则/别名（可能正确）
    {"name": "四认识张", "mentions": 1},  ❌ 来自规则（误识别）
    {"name": "三很久了", "mentions": 1}   ❌ 来自规则（误识别）
  ]
}
```

**API 准确率**: 3/12 = 25% (如果算"小张"为正确则 4/12 = 33%)

### 3. 日志输出
```
NER 识别完成: 共 8 个人名提及
别名识别完成: 共 5 个别名提及
人物合并完成: 12 个人物
```

## 🔍 问题根源分析

### 识别流程 (src/core/ner.py:68-92)

```python
def recognize(self, sentences: List[str]):
    mentions = []
    
    # 1. NER 模型识别 (返回 5 个)
    if self._initialized and self.model:
        mentions.extend(self._recognize_with_model(sentences))
    
    # 2. 规则识别 - 总是执行！⚠️ 问题所在
    mentions.extend(self._recognize_with_rules(sentences))
    
    # 3. 去重 - 仅去除完全相同的 (text, sent_id, start)
    mentions = self._deduplicate_mentions(mentions)
    
    logger.info(f"NER 识别完成: 共 {len(mentions)} 个人名提及")
    return mentions
```

### 三大问题

#### 问题 1: 规则识别始终执行

不管 NER 模型是否成功，规则识别**总是会被执行**。

#### 问题 2: 规则2过于宽松

**规则2**: `r'[一-龥]{2,3}'` 匹配**所有** 2-3 个连续中文

对测试文本的匹配（部分）：
```
张三 | 三是 | 是个 | 个工 | 工程 | 程师 | 大家 | 家都 | 都叫 | 
叫他 | 他小 | 小张 | 李四 | 四认 | 认识 | 识张 | 张三 | 三很 | 
很久 | 久了 | 王芳 | 芳也 | 也是 | ...
```

#### 问题 3: 验证逻辑太弱

`_is_valid_name()` 排除词汇太少：
```python
exclude_words = {
    "这个", "那个", "什么", ...  # 仅 12 个
}
```

**没有排除**：
- 以动词结尾: 是、认、很、也、都、叫
- 包含动词: 认识、都叫、是个
- 通用词汇: 工程、程师

`_looks_like_name()` 的致命问题：
```python
if text[0] in self.common_surnames:
    return True  # ⚠️ 导致所有以姓氏开头的片段通过
```

**误判示例**：
- "张三是" → "张"是姓氏 → 通过 ❌
- "李四认" → "李"是姓氏 → 通过 ❌
- "王芳也" → "王"是姓氏 → 通过 ❌

## 💡 解决方案对比

### 方案 1: 当 NER 可用时禁用规则（激进）

**优点**: 准确率高  
**缺点**: 可能遗漏别名

### 方案 2: 加强验证逻辑（保守）

增强 `_is_valid_name()`：
```python
# 排除以这些字结尾的
invalid_suffixes = {'是', '认', '很', '也', '都', '叫', '个', '了'}
if name[-1] in invalid_suffixes:
    return False
```

**优点**: 保留规则识别的补充能力  
**缺点**: 仍可能有漏网之鱼

### 方案 3: 智能合并（推荐）

NER 优先，规则仅补充非重叠部分。

## 🎯 结论

**当前问题的本质**：
1. BERT BASE 模型工作正常（80%准确率）
2. 规则识别产生大量噪音（降低到 25%准确率）
3. 两者简单叠加导致误识别激增

**推荐修复顺序**：
1. 立即：加强 `_is_valid_name()` 验证
2. 短期：实现智能合并逻辑
3. 长期：根据实际需求权衡 NER vs 规则

---

**分析时间**: 2024-11-11 21:13  
**分析工具**: 直接模型测试 + API 对比 + 代码审查
