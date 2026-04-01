请基于以下结构化输入返回质量判断 JSON。

segment script draft:
{{segment_script_draft_json}}

validation report:
{{validation_report_json}}

quality signals:
{{quality_signals_json}}

failed artifact:
{{failed_artifact_json}}

提醒：
- 仅输出 JSON，不要代码块，不要解释。
- `score` 和 `confidence` 必须在 [0, 1]。
- `reasons` 必须是非空数组。
- `reasons` 只写与台本生成质量直接相关的依据。
- 不要把原文叙事连贯性、题材敏感性、受众适宜性、性/暴力内容本身写成质检理由。
- 错误示例（不要输出）：
  - "文本在叙事上具有连贯性，描述了完整的修炼与互动过程。"
  - "文本内容包含明确且直接的性暗示与身体部位描写，可能不适合所有受众。"
