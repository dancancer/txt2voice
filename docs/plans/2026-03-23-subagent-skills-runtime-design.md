# Subagent Skills Runtime Design

**目标**

把当前项目中“角色识别 / 台本生成 / 修复 / 质检”这条 LLM 主链路，从现有的 `service + queue + pipeline function` 模型，重建为一套贴近 Codex / Claude 生态的 `subagent + skills + workflow` 运行时；同时保持生产系统所需的强类型、可恢复、可观测、可回放能力。

## 背景

当前实现已经有一定的异步执行与任务追踪能力，但本质上仍然是“业务函数直接组织 LLM 调用”：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts` 负责 provider 配置、LLM 调用与部分上层协议。
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts` 是面向业务的入口封装。
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts` 同时承担 prompt 组装、LLM 调用、解析、校验、修复、角色映射与持久化前处理。
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts` 负责任务状态、聚合指标、失败同步、人工复核交接。

这套结构的优点是直接、能跑；问题是系统边界不清晰：

1. **认知逻辑与副作用耦合**：语义判断、LLM 输出修复、数据库写入混在同一批模块内。
2. **缺少 agent 边界**：角色识别、台本生成、失败修复、质量判定还不是一等公民。
3. **缺少 skill 协议**：prompt、规则、检查标准、输出约束没有被定义成文件化能力单元。
4. **缺少显式上下文纪律**：角色记忆、失败历史、运行约束等信息仍然通过函数参数和 prompt 文本隐式流动。
5. **过程数据不足**：数据库主要保存最终业务结果，运行时推理、修复、决策过程不是结构化资产。

这意味着，当前系统虽然已经“在用 LLM”，但还不是“agent runtime”。

## 设计原则

1. **协议优先**：文件是 authoring interface，typed protocol 才是 execution interface。
2. **智能与副作用分层**：agent 负责判断与生成，tool 负责确定性读取、校验与持久化。
3. **阶段化优于通用图**：第一版 workflow 使用受控状态机，而不是任意 DAG。
4. **artifact 驱动流转**：agent 之间传递结构化 artifact，不通过 prompt 文本偷偷传值。
5. **上下文最小闭包**：每个 agent 只能看到完成当前任务所需的最小上下文。
6. **错误必须可分类、可升级**：失败不是单一状态，而是可重试、可修复、需人工、系统错误等不同族类。
7. **先内置后开放**：第一阶段只服务内置工作流与仓库内 skills，不开放终端用户自定义编排。
8. **生产约束不妥协**：可回放、可审计、可观测、可测试与成本可控必须是内建设计，不是补丁。

## 目标范围

本轮设计覆盖：

- 角色识别工作流
- 台本生成工作流
- JSON / schema / coverage 修复工作流
- 自动质量判定与人工审查升级
- runtime trace、artifact、上下文、记忆与工具边界
- 文件化 skill / agent / workflow 规范

本轮不做：

- 向最终用户开放任意自定义 workflow
- 支持完全通用的 DAG 编排 UI
- 把项目内所有 LLM 点位一次性迁移到新 runtime
- 让 skills 直接拥有数据库写权限或外部副作用权限

## 总体架构

### 1. 六个一等公民

新系统以六个核心对象为中心：

- `Agent`：谁在思考，负责职责边界、可用 skills、可用 tools、输入输出契约。
- `Skill`：如何完成一类认知任务，负责 prompt bundle、规则、约束、schema、成功标准。
- `Workflow`：任务如何流动，负责阶段顺序、状态转移、失败分支与升级逻辑。
- `Tool`：可以触碰真实世界的确定性动作，负责读取、查询、校验、持久化、状态更新。
- `Context`：某个 agent 在某次执行中被允许看到的信息视图。
- `Trace`：运行中发生过的事件流，用于回放、归因、成本统计与人工诊断。

### 2. 文件化 authoring interface

为了贴近 Codex / Claude 生态，定义文件层：

- `/Users/xupeng/mycode/txt2voice/agents/`
- `/Users/xupeng/mycode/txt2voice/skills/`
- `/Users/xupeng/mycode/txt2voice/workflows/`

建议结构如下：

- `agents/<agent-id>/agent.toml`
- `agents/<agent-id>/AGENT.md`
- `skills/<skill-id>/skill.toml`
- `skills/<skill-id>/SKILL.md`
- `skills/<skill-id>/prompts/*.md`
- `workflows/<workflow-id>/workflow.toml`
- `workflows/<workflow-id>/WORKFLOW.md`

### 3. 强类型 execution interface

运行时不直接解释 Markdown 文本，而是先将文件解析为 typed protocol：

- `AgentDefinition`
- `SkillDefinition`
- `WorkflowDefinition`
- `ToolContract`
- `ArtifactEnvelope<T>`
- `ContextEnvelope`
- `ExecutionEvent`

也就是说：

- Markdown / TOML / prompt 文件只负责表达意图
- TypeScript 协议对象负责驱动运行

## Workflow 设计

### 1. 阶段化状态机

第一版 workflow 不做任意 DAG，而是做成受控阶段机。推荐阶段：

1. `prepare`
2. `character_discovery`
3. `segment_scripting`
4. `segment_repair`
5. `quality_judgement`
6. `persist`
7. `manual_review_handoff`
8. `complete`

### 2. 运行层级

一次完整运行的层级关系：

- `WorkflowRun`
  - `StageRun`
    - `AgentRun`
      - `LLM Turn`
      - `ToolCall`
      - `ValidationEvent`

### 3. 状态转移

workflow 不止有 `success / failed` 两种终态，而需要支持：

- `running`
- `retrying`
- `repairing`
- `blocked`
- `manual_review_required`
- `completed`
- `failed`

## Agent 与 Tool 边界

### 1. 建议的 Agent 集

#### `character-discovery-agent`

职责：

- 基于采样文本识别角色候选
- 归并别名建议
- 提取角色摘要与身份提示

输出：

- `CharacterMemoryDraft`

#### `script-generation-agent`

职责：

- 将单段原文映射为结构化 script draft
- 使用角色记忆进行 speaker 映射

输出：

- `SegmentScriptDraft`

#### `repair-agent`

职责：

- 对 JSON 破损、schema 失败、coverage 失败、speaker 异常等进行受限修复

输出：

- `RepairDecision`
- 修复后的 `SegmentScriptDraft`

#### `quality-judge-agent`

职责：

- 在 deterministic validation 通过后，对语义质量进行判定
- 决定通过、拒绝或升级人工

输出：

- `QualityVerdict`

#### `coordinator-agent`

职责：

- 不直接生成内容
- 只负责 skill 选择、预算控制、策略分流、重试/修复/人工升级决策

### 2. 建议的 Tool 集

确定性动作必须通过 tools 完成，例如：

- `load-book-context`
- `load-segment-batch`
- `load-character-memory`
- `save-character-memory`
- `save-script-draft`
- `commit-script-sentences`
- `create-manual-review-item`
- `update-task-progress`
- `append-trace-event`
- `estimate-token-budget`
- `split-segment`
- `validate-structured-output`
- `check-script-coverage`

### 3. 边界规则

- Agent 不能直接写数据库。
- Skill 不能直接调用数据库写入。
- 持久化、状态更新、review item 创建、coverage 校验、schema 校验必须是 tool。
- 只有需要语义判断的地方才交给 agent。

## Skill 协议

### 1. Skill 的本质

Skill 不是一段 prompt，而是一份可被解析、选择、验证和追踪的能力协议。

每个 skill 至少包含：

- `SKILL.md`
- `skill.toml`
- `prompts/`
- `checks/`（可选）

### 2. 推荐字段

`skill.toml` 至少描述：

- `id`
- `version`
- `kind`
- `compatibleAgents`
- `inputSchemaRef`
- `outputSchemaRef`
- `contextRequirements`
- `toolAllowlist`
- `promptBundle`
- `modelPolicy`
- `repairPolicy`
- `successCriteria`
- `telemetryTags`

### 3. 受控选择

第一阶段不做开放式 planner，而采用受控选择：

- workflow 指定本阶段允许的 skills
- agent 根据输入特征与策略在限定集合中选择
- 或由 workflow 明确指定 skill

## 数据模型与持久化

### 1. 保留现有业务实体

以下实体仍然保留为业务事实层：

- `Book`
- `TextSegment`
- `CharacterProfile`
- `ScriptSentence`
- `ManualReviewItem`
- `ProcessingTask`

### 2. 新增运行时执行实体

新增：

- `WorkflowRun`
- `StageRun`
- `AgentRun`
- `ToolCall`
- `TraceEvent`

### 3. 中间 artifact

第一阶段建议显式保存以下 artifact：

- `CharacterMemory`
- `SegmentScriptDraft`
- `ValidationReport`
- `RepairDecision`
- `QualityVerdict`

## Context 与 Memory 设计

### 1. 五层上下文

每个 agent 的上下文按五层组织：

- `InputContext`
- `WorkingMemory`
- `ReferenceMemory`
- `PolicyContext`
- `ExecutionContext`

### 2. 角色记忆

`CharacterMemory` 需要显式区分：

- `canonical identities`
- `alias evidence`
- `behavioral hints`
- `asserted facts`
- `inferred hints`

### 3. 记忆更新

agent 不直接覆盖长期记忆，而是提交：

- `MemoryPatch`

由 runtime / tool 合并，处理：

- 新增事实
- 置信更新
- 冲突标记

### 4. 上下文裁剪规则

- `character_discovery` 使用采样文本，不吃全书全文
- `script_generation` 使用单段输入 + 压缩角色记忆
- `repair` 使用失败局部上下文，不重新获得自由生成空间
- `quality_judgement` 优先使用结构化 artifact，而不是所有原始 response

## 错误分类与修复闭环

### 1. 错误分类

错误至少分成：

- `runtime_error`
- `protocol_error`
- `generation_error`
- `validation_error`
- `memory_conflict`
- `quality_failure`
- `policy_block`

### 2. 修复层次

推荐修复闭环：

1. `transport retry`
2. `format repair`
3. `semantic retry`
4. `input refinement`
5. `manual review handoff`

每次修复都必须记录：

- `repairDepth`
- `retryCountByCategory`
- `lastFailureCategory`
- `repairLineage`

### 3. 人工审查升级

进入人工审查时，系统必须携带证据包：

- 原始输入摘要
- 当前最佳草案
- `ValidationReport`
- 修复尝试摘要
- 推荐处理动作

## 可观测性

### 1. 四层指标

可观测性按四层组织：

- 运行层：排队、耗时、重试、超时、并发、预算
- 认知层：agent、skill、模型、上下文大小、通过率
- 质量层：coverage 失败率、repair 成功率、人工升级率、角色冲突率
- 成本层：token、费用、按 workflow / agent / skill / model 聚合

### 2. 核心事件

推荐保留统一事件流：

- `skill_selected`
- `context_built`
- `llm_requested`
- `structured_output_received`
- `validation_failed`
- `repair_started`
- `manual_review_escalated`
- `artifact_committed`

## 测试策略

推荐五层测试：

1. 协议测试
2. 工具测试
3. Agent contract 测试
4. Workflow 场景测试
5. 回归语料测试

## 推荐目录结构

运行时代码：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/`

文件化定义：

- `/Users/xupeng/mycode/txt2voice/agents/`
- `/Users/xupeng/mycode/txt2voice/skills/`
- `/Users/xupeng/mycode/txt2voice/workflows/`

## 实施顺序

推荐顺序：

1. 定义 protocol、artifact、trace 与 persistence schema
2. 实现 definition loader
3. 实现 tool contract
4. 实现 runtime skeleton
5. 落地 `character_discovery`
6. 落地 `segment_scripting`
7. 落地 repair / quality / manual review
8. 接入旧 API / queue / task 入口

## 风险与权衡

### 风险 1：系统复杂度显著上升

这是一次真正的架构重建，复杂度一定会上升。方式不是拒绝复杂度，而是把复杂度从业务函数里搬到协议和 runtime 里。

### 风险 2：skill 文件与 runtime 协议漂移

需要通过 definition loader 和 contract tests 约束。

### 风险 3：过度追求通用

第一版必须坚持阶段化状态机和内置工作流。

### 风险 4：保存过多原始 prompt / response

默认保存摘要和 hash，只在失败或调试场景保存完整内容。

## 结论

不建议继续在现有 `LLMService + ScriptGenerator + runner` 上堆补丁，而是建议在仓库内建立一套独立的 V2 runtime：

- 外层文件化，贴近 Codex / Claude 的使用与扩展习惯
- 内层协议化，满足生产系统对强约束与可恢复性的要求
- 以 agent、skill、workflow、tool、context、trace 六个对象为中心
- 先内置跑通角色识别、台本生成、修复、质检主链路，再考虑开放扩展
