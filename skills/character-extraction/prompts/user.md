请基于以下上下文输出角色记忆草稿 JSON。

已有角色记忆摘要（可为空）：
{{character_memory_summary}}

文本片段：
{{segment_text}}

提醒：
- 同一个角色只保留一个 canonical identity。
- 别名证据写入 `aliasEvidence`，要带 `source`。
- 明确事实写入 `assertedFacts`，推断写入 `inferredHints`。
- 只输出 JSON。
