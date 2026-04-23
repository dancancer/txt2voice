# `/api/llm/models`

只读返回当前可用的 LLM 模型注册表，用于前端模型切换和调试。

- 不做远端健康检查
- 不返回 `apiKey`
- 默认返回 `defaultModelId` 和安全字段列表
