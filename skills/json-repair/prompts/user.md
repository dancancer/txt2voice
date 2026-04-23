请基于原始段落与失败 artifact，返回修复后的 JSON。

原始段落：
{{segment_text}}

失败 artifact（JSON）：
{{failed_artifact_json}}

角色记忆摘要：
{{character_memory_summary}}

角色归一化提示：
{{character_resolution_hints}}

提醒：
- 只输出 JSON，不要代码块，不要解释。
- 必须输出 `lines` 数组。
- 每一行必须包含：`id`、`sourceText`、`text`、`speaker`、`orderInSegment`。
- 不要输出空字符串 `text`。
- 如果一行没有真正对白，就保留原句，不要压成括号说明。
- 如果角色记忆摘要或角色归一化提示中给出了 canonical 名称与别名映射，命中别名时必须回写 canonical 名称。
- 优先修复为可直接通过结构校验和基本 sourceText 对齐校验的结果。
