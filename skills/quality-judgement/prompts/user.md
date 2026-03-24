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
