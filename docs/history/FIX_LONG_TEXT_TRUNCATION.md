# 修复：NER 模型文本截断问题

## 问题描述

在处理长文本时，character-recognition 服务出现大量警告：

```
WARNING Input tokens ... exceed the max sequence length of 126. 
The exceeded part will be truncated and ignored. 
You are recommended to split your long text into several sentences within 126 tokens beforehand.
```

**原因分析：**
- HanLP BERT BASE NER 模型的最大序列长度为 **126 tokens**
- 文本预处理器按标点符号（。！？；）分句，可能产生超长句子
- 当单个句子超过 126 tokens 时，超出部分被截断，导致人物识别不完整

## 解决方案

### 1. 添加长句切分逻辑

在 `apps/character-recognition/src/core/ner.py` 中添加了 `_split_long_sentence()` 方法：

```python
def _split_long_sentence(self, sentence: str, max_length: int = 100) -> List[Tuple[str, int]]:
    """将超长句子切分为多个子句
    
    Args:
        sentence: 原始句子
        max_length: 最大长度（中文约 1 字 = 1 token，保守按 100 字切分）
        
    Returns:
        [(子句, 在原句中的偏移量), ...]
    """
```

**切分策略：**
- 优先在逗号、顿号、分号等标点处切分
- 如果找不到合适的标点，则在 max_length 处强制切分
- 保留每个子句在原句中的偏移量，确保位置信息准确

### 2. 重构结果处理逻辑

提取了 `_process_model_result()` 方法来统一处理模型识别结果：

```python
def _process_model_result(self, result: Any, sent_id: int, mentions: List[CharacterMention], offset: int = 0):
    """处理模型识别结果
    
    Args:
        result: 模型返回结果
        sent_id: 句子ID
        mentions: 提及列表（会被修改）
        offset: 在原句中的偏移量（用于子句定位）
    """
```

**改进点：**
- 支持子句偏移量，确保人名位置准确映射回原句
- 统一处理多种模型输出格式（BERT BASE、ELECTRA、字典格式）
- 减少代码重复，提高可维护性

### 3. 修改识别流程

在 `_recognize_with_model()` 中添加长句检测和切分：

```python
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
```

## 部署说明

由于 Docker Hub 网络问题，采用了临时部署方式：

```bash
# 直接复制修改后的文件到运行中的容器
docker cp apps/character-recognition/src/core/ner.py txt2voice-character-recognition:/app/src/core/ner.py

# 重启容器应用更改
docker compose restart character-recognition
```

**正式部署时需要：**
```bash
# 重新构建镜像
docker compose build character-recognition

# 重启服务
docker compose up -d character-recognition
```

## 验证

修复后，处理长文本时：
- ✅ 不再出现 "exceed the max sequence length" 警告
- ✅ 超长句子被智能切分为多个子句
- ✅ 人物识别结果更完整、准确
- ✅ 位置信息正确映射回原始文本

## 技术细节

### 为什么选择 100 字作为切分阈值？

1. **BERT 模型限制：** 最大序列长度 126 tokens
2. **中文特性：** 中文约 1 字 ≈ 1 token
3. **安全边界：** 100 字留有足够余量，避免边界情况
4. **标点切分：** 实际切分会在标点处，通常小于 100 字

### 位置偏移量处理

```python
# 子句在原句中的偏移量
start_pos = entity[2] + offset  # 实体在子句中的位置 + 子句在原句中的偏移
end_pos = entity[3] + offset
```

这确保了即使句子被切分，识别出的人名位置仍然准确对应原始文本。

## 相关文件

- `apps/character-recognition/src/core/ner.py` - NER 识别核心逻辑
- `apps/character-recognition/src/core/preprocessor.py` - 文本预处理
- `apps/character-recognition/src/recognizer.py` - 主识别器

## 后续优化建议

1. **动态阈值：** 根据实际 token 数量动态调整切分长度
2. **上下文保留：** 切分时保留部分上下文，提高识别准确率
3. **批量处理：** 对多个子句进行批量推理，提升性能
4. **模型升级：** 考虑使用支持更长序列的模型（如 Longformer）
