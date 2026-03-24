请基于原始段落与失败 artifact，返回修复后的 JSON。

原始段落：
{{segment_text}}

失败 artifact（JSON）：
{{failed_artifact_json}}

提醒：
- 只输出 JSON，不要代码块，不要解释。
- 必须输出 `lines` 数组。
- 每一行必须包含：`id`、`sourceText`、`text`、`speaker`、`orderInSegment`。
