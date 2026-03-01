# Agent 工作流程文档

本文档描述 txt2voice 当前（LLM-only）版本的 Agent 协作方式。

## Agent 架构

系统由五类 Agent 协同完成：

1. **任务协调 Agent**：任务创建、调度、进度与失败处理
2. **文本处理 Agent**：文件解析、章节识别、段落切分
3. **角色分析 Agent**：基于 LLM 提取角色与别名
4. **台本生成 Agent**：生成台词、情绪与朗读参数
5. **音频生成 Agent**：调用 TTS、落盘与章节拼接

> 说明：`apps/character-recognition` 已移除，角色分析统一由 LLM 完成。

## 1) 任务协调 Agent

实现：`apps/web/src/lib/processing-task-utils.ts` + API Routes

职责：

- 接收用户请求并创建 `ProcessingTask`
- 驱动各子任务执行
- 更新任务进度与状态
- 记录失败原因与重试信息

状态流转：`pending -> processing -> completed | failed`

## 2) 文本处理 Agent

实现：`apps/web/src/lib/text-processor.ts`

流程：

`输入文件 -> 编码检测 -> 文本清洗 -> 章节识别 -> 章节内分段 -> 写入 Chapter/TextSegment`

关键点：

- 兼容 UTF-8 / GBK / UTF-16LE 等常见编码
- 章节切分失败时降级单章节
- 段落记录包含 `chapterId` 与 `chapterOrderIndex`

## 3) 角色分析 Agent（LLM）

实现：`apps/web/src/lib/script-generator.ts` + `apps/web/src/lib/llm-service.ts`

流程：

`文本采样/分块 -> LLM 抽取角色 -> 角色归一化 -> 别名合并 -> 保存 CharacterProfile`

识别维度：

- 名称与别名
- 性别、年龄（可空）
- 性格与重要性
- 对话风格

## 4) 台本生成 Agent

实现：`apps/web/src/lib/script-generator.ts`

流程：

`加载角色映射 -> 按段调用 LLM -> JSON 修复 -> 映射角色 -> 保存 ScriptSentence`

能力：

- 对话/旁白识别
- 情绪与语气标注
- 三级 JSON 修复（直接解析 / 本地修复 / LLM 修复）
- 书籍/章节/段落粒度进度统计

## 5) 音频生成 Agent

实现：`apps/web/src/lib/audio-generator.ts`

流程：

`读取台词 -> 选择角色声音 -> 调用 TTS -> 保存音频 -> 记录 AudioFile -> 章节合并`

策略：

- 批量并行（默认分批）
- 已存在音频可跳过
- 失败重试与任务进度追踪

## 端到端流程

1. 上传文本文件
2. 文本处理（章节/段落）
3. LLM 角色分析
4. 台本生成
5. 角色声音配置
6. 批量音频生成
7. 章节或整书下载

## 错误处理

错误类型：

- `ValidationError`
- `TTSError`
- `FileProcessingError`

策略：

- API 层统一兜底
- 服务层抛出语义化错误
- 可重试错误支持自动重试

## 监控指标建议

- 任务总耗时（按 taskType）
- LLM 调用次数与失败率
- TTS 调用次数与失败率
- 每章生成成功率与平均重试次数
