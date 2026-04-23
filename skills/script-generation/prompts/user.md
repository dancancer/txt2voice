请基于以下输入，输出单段台词草稿 JSON。

文本段落：
{{segment_text}}

角色记忆摘要：
{{character_memory_summary}}

提醒：
- 只输出 JSON，不要代码块标记，不要解释。
- 必须输出 `lines` 数组。
- 每一行都必须包含：`id`、`sourceText`、`text`、`speaker`、`orderInSegment`。
- 可以额外输出可选字段：`tone`、`prosody`、`strength`、`pauseAfter`。
- `prosody` 只允许包含：`pace`、`pitch`、`energy`、`pauseMsAfter`。
- `strength` 取值范围是 0-100，`pauseAfter` 单位是秒。
- 必须完整覆盖原文，不要漏字，不要重抽。
- `sourceText` 必须是原文中的原样子串。
- 不能总结、压缩、改写、解释或补写原文。
- 旁白的 `text` 必须与 `sourceText` 完全一致。
- 不要把叙事改写成括号里的舞台说明。
- 纯归属语或动作句不要输出空 `text`，没有真正对白时按旁白原样保留。
- 如果角色记忆摘要里给出了已知角色名、别名或特征，优先据此判断 `speaker`。
- 如果命中了已知角色别名，`speaker` 也要回写 canonical 名称，不要直接输出别名。
- 对 `tone` 和朗读参数没把握时可以省略，不要为了凑字段而编造。
