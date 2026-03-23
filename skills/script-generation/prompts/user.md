请基于以下输入，输出单段台词草稿 JSON。

已有角色记忆摘要（可为空）：
{{character_memory_summary}}

文本段落：
{{segment_text}}

提醒：
- 只输出 JSON，不要代码块标记，不要解释。
- 必须输出 `lines` 数组。
- 每一行都必须包含：`id`、`sourceText`、`text`、`speaker`、`orderInSegment`。
