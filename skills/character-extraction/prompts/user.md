请基于以下上下文输出角色记忆草稿 JSON。

已有角色记忆摘要（可为空）：
{{character_memory_summary}}

文本片段：
{{segment_text}}

提醒：
- 同一个角色只保留一个 canonical identity。
- 别名证据写入 `aliasEvidence`。
- `source` 只是证据来源标签；如果输入里没有显式段标识，就统一写 `llm`，不要编造可追溯 id。
- 明确事实写入 `assertedFacts`，推断写入 `inferredHints`。
- `assertedFacts[canonicalId]` 和 `inferredHints[canonicalId]` 必须是 object，不能输出标量值。
- fact bucket 只允许这些字段：`description`、`gender`、`age`、`personality`、`importance`、`dialogueStyle`。
- `gender` 只能输出：`"male"`、`"female"`、`"unknown"`。
- `assertedFacts` 和 `inferredHints` 的 key 只能使用 canonical id。
- 只输出 JSON。
