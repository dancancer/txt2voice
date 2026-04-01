# Mastra Hybrid Runtime Design

## 背景

当前项目的 `agent / subagent / skills` 架构已经不是空白状态，而是处于“自研 runtime 已成型，但 authoring 和边界还没有完全收口”的阶段：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts` 已经定义了 `AgentDefinition / SkillDefinition / WorkflowDefinition / ToolContract`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`、`run-stage.ts`、`run-workflow.ts` 已经具备运行时骨架
- `/Users/xupeng/mycode/txt2voice/apps/web/src/generated/prisma/schema.prisma` 已经持久化了 `WorkflowRun / StageRun / AgentRun / ToolCall / TraceEvent / RuntimeArtifact`
- 仓库根目录已经存在 `agents/`、`skills/`、`workflows/` 作为 authoring interface

也就是说，真正的问题不是“要不要从零做 agent framework”，而是：

1. 如何把现有 authoring、runtime、追踪、artifact 体系规范化
2. 如何引入 Mastra 而不破坏现有生产级可回放、可审计、可追踪能力
3. 如何在不 agent 化确定性服务的前提下，清理过大的服务文件边界

同时，两个核心服务文件已经明显超出健康体量：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processor.ts`：871 行
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`：1691 行

这不是单纯的风格问题，而是架构边界开始塌陷的信号。

## 目标

- 以最小风险方式引入 Mastra，统一 LLM agent 层的定义与执行接口
- 保留现有 `agent-runtime + Prisma runtime store` 作为生产真相源
- 让 `agents/skills/workflows` 成为单一 authoring interface，而不是再造一套平行配置
- 把 `text-processor.ts` 和 `audio-generator.ts` 拆成职责清晰、可测试、可复用的模块树
- 让当前方案可以平滑升级到“更多 stage 由 Mastra 接管”的中期形态

## 非目标

- 不在本轮把整个任务系统重写成 Mastra native app
- 不把 `text-processor` 和 `audio-generator` 强行改造成 agent
- 不让 Mastra 的内建 storage 成为系统事实来源
- 不在本轮向终端用户开放自定义 workflow 编排
- 不一次性迁移项目内全部 LLM 点位

## 方案比较

### 方案 A：全面切换到 Mastra

优点：

- 框架统一
- agent / workflow / tool 抽象全部收敛到单一生态

缺点：

- 与现有 `WorkflowRun / StageRun / AgentRun / ToolCall / TraceEvent / RuntimeArtifact` 高度重叠
- 迁移成本高，且会冲击现有 replay、人工复核、任务状态追踪
- `SkillDefinition` 目前更像“运行时策略合同”，并不等价于 Mastra skills

结论：

- 本轮不采用

### 方案 B：Mastra 作为 LLM agent 层，自研 runtime 继续做生产 orchestration（推荐）

优点：

- 保留现有生产真相源和审计能力
- 将 Mastra 的价值集中用在 agent、tools、memory、observability 接口统一上
- 可以按 stage 渐进迁移，不需要一次性改掉主链路

缺点：

- 短期会存在“双层抽象”
- 需要设计 event / artifact / tool call 的归一映射

结论：

- 采用本方案

### 方案 C：先不引入 Mastra，只做本地规范化

优点：

- 风险最低
- 不引入新依赖

缺点：

- 失去 Mastra 在 agent authoring、tool integration、workflow expression、observability 上的现成能力
- 后续若再接入 Mastra，仍需二次改造

结论：

- 可作为兜底，但不是当前推荐路线

## 决策

采用“**Mastra 只接 LLM agent 层，自研 runtime 继续做生产 orchestration 和持久化真相源**”的混合架构。

一句话描述：

- `Mastra` 负责“谁来思考、如何调用工具、如何组织 LLM agent”
- `agent-runtime` 负责“任务如何落库、如何追踪、如何回放、如何人工升级”

## 分层架构

### 1. Authoring Layer

继续以仓库根目录作为 authoring 真相源：

- `/Users/xupeng/mycode/txt2voice/agents`
- `/Users/xupeng/mycode/txt2voice/skills`
- `/Users/xupeng/mycode/txt2voice/workflows`

规则：

- `agent.toml / AGENT.md` 定义 agent 身份与约束
- `skill.toml / SKILL.md / prompts/*.md` 定义认知协议
- `workflow.toml / WORKFLOW.md` 定义阶段顺序和允许的执行面

这层保持与 Mastra 解耦，不把 Mastra 配置文件当成新的真相源。

### 2. Compile Layer

新增一层“authoring 到 executable runtime”的编译层，把现有定义同时编译到：

- 现有 `AgentDefinition / SkillDefinition / WorkflowDefinition`
- Mastra `Agent / Workflow / Tool` 实例

建议目录：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-skill.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/load-prompt-bundle.ts`

原则：

- authoring 文件只写一次
- 编译后的执行对象可以由 native runtime 或 Mastra runtime 消费

### 3. Execution Layer

执行层分成两条：

#### A. Production Orchestration Path

继续使用现有：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`

职责：

- 创建 workflow/stage/agent/tool run 记录
- 统一 trace taxonomy
- 管理 retry / repair / manual review / blocked 等状态
- 将 artifact 和 summary 写入 Prisma

#### B. Mastra Agent Execution Path

Mastra 只接入 LLM-heavy stage：

- `character_discovery`
- `segment_scripting`
- `segment_repair`
- `quality_judgement`

建议目录：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-agent.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/trace/normalize-mastra-event.ts`

职责：

- 根据 authoring 定义生成 Mastra agent
- 注入受控 tool set
- 接收 Mastra 的执行事件
- 归一成现有 `ExecutionEvent` 和 `ToolCallRecord`

### 4. Deterministic Services Layer

以下能力继续保持为 deterministic service，不进入 agent 框架：

- 文本解码、清洗、章节切分、段落切分
- 音频路由、TTS 请求构造、文件落盘、失败审计
- Prisma 持久化
- 规则校验、结构化输出校验、coverage 检查

规则：

- 只有需要语义判断的部分才交给 agent
- 所有副作用都必须通过 tool 或 service 完成

### 5. Persistence And Replay Layer

继续以现有 Prisma 表为系统事实来源：

- `WorkflowRun`
- `StageRun`
- `AgentRun`
- `ToolCall`
- `TraceEvent`
- `RuntimeArtifact`

Mastra storage 不作为事实来源，只允许作为内部临时状态或被关闭。

## 运行时切换策略

新增显式 executor policy，而不是在 stage 里散落分支。

建议配置：

- `AGENT_RUNTIME_EXECUTOR=native|mastra`
- `AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting,segment_repair,quality_judgement`
- `AGENT_RUNTIME_MASTRA_SHADOW_MODE=true|false`

规则：

- `native`：完全走现有 executor
- `mastra`：命中的 stage 走 Mastra executor，其余仍走 native
- `shadow mode`：主结果仍取 native，但同步运行 Mastra 并记录差异，只用于验证

这能避免一次性切主链路。

## Trace 与 Artifact 归一规则

无论底层由 native executor 还是 Mastra executor 执行，最终都必须落回同一套 taxonomy：

- `workflow.started`
- `stage.started`
- `agent.started`
- `skill_selected`
- `context_built`
- `llm_requested`
- `structured_output_received`
- `validation_failed`
- `repair_started`
- `artifact_committed`
- `manual_review_escalated`
- `agent.completed`
- `agent.failed`
- `stage.completed`
- `workflow.completed`

统一原则：

- UI、replay、报表只消费归一事件
- 不让上层感知底层 executor 差异

## Tool 边界

Mastra agent 只能看到受控工具，不允许直接写数据库。

优先复用现有 deterministic tools：

- `load-book-context`
- `load-segment-batch`
- `load-character-memory`
- `validate-structured-output`
- `check-script-coverage`
- `save-character-memory`
- `save-script-draft`
- `commit-script-sentences`
- `create-manual-review-item`

规则：

- 读操作 tool 和写操作 tool 分开
- 写操作必须继续写入现有 runtime store / Prisma
- Mastra tool 调用结果需要映射回 `ToolCallRecord`

## 文本处理模块拆解设计

`text-processor.ts` 当前承担了五类职责：

1. 编码检测与解码
2. 文本清洗与格式识别
3. 内容分段
4. 章节切分
5. Prisma record 构造

推荐拆分为 facade + 分层模块：

```text
apps/web/src/lib/text-processing/
  types.ts
  core/
    encoding.ts
    cleaning.ts
  segmentation/
    content-type.ts
    segmenter.ts
    segment-classification.ts
  chapters/
    chapter-detection.ts
    chapter-segmentation.ts
  persistence/
    content-sanitizer.ts
    record-builders.ts
apps/web/src/lib/text-processor.ts
```

职责映射：

- `detectEncoding()`、解码逻辑 -> `core/encoding.ts`
- `cleanText()`、`detectFileFormat()` -> `core/cleaning.ts`
- `segmentText()`、`segmentWithSmartSplitter()`、`segmentWithTraditionalSplitter()` -> `segmentation/segmenter.ts`
- `detectContentType()`、`detectSegmentType()` -> `segmentation/content-type.ts` 与 `segment-classification.ts`
- `splitContentIntoChapters()` 及相关 heading 规则 -> `chapters/*`
- `sanitizeContent()`、`createTextSegmentRecords()`、`createChapterSegmentRecords()` -> `persistence/*`
- 现有 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processor.ts` 保留为兼容 facade，只做 re-export 和轻薄编排

拆分后的硬规则：

- facade 文件只保留稳定对外 API
- record builder 不再关心编码检测
- chapter detection 不再关心 Prisma shape

## 音频生成模块拆解设计

`audio-generator.ts` 当前同时承担：

1. 单句合成入口
2. 批量可靠性编排
3. 声音路由候选收集
4. 引擎健康快照
5. TTS 请求构造
6. 音频文件保存
7. 失败合成审计
8. 参数归一与风格推断

推荐拆分为 facade + 子模块树：

```text
apps/web/src/lib/audio-generation/
  types.ts
  execution/
    single-audio-executor.ts
    batch-audio-runtime.ts
  routing/
    voice-route-resolver.ts
    engine-health.ts
  synthesis/
    tts-request-builder.ts
    tts-parameter-normalizer.ts
  persistence/
    audio-file-store.ts
    synthesis-attempt-store.ts
apps/web/src/lib/audio-generator.ts
```

保留并复用现有独立模块：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-engine-router.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-retry-plan.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-runtime-policy.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-synthesis-runtime.ts`

职责映射：

- `generateSingleAudio()` 继续作为 facade，对外统一走 `audio-synthesis-runtime`
- `executeAudioSynthesis()` -> `execution/single-audio-executor.ts`
- `generateBatchAudio*()`、`runBatchPass()` -> `execution/batch-audio-runtime.ts`
- `resolveVoiceRouteForSentence()`、`collectRouteCandidates()`、`findNarrationFallbackVoice()` -> `routing/voice-route-resolver.ts`
- `getEngineHealthSnapshot()` -> `routing/engine-health.ts`
- `buildTTSRequest()`、`resolveStyleFromTone()`、数值归一/clamp -> `synthesis/*`
- `saveAudioFile()` -> `persistence/audio-file-store.ts`
- `recordFailedSynthesisAttempt()` -> `persistence/synthesis-attempt-store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts` 保留 `AudioGenerator` 类和 `getAudioGenerator()` facade，避免大面积 import 震荡

拆分后的硬规则：

- 批量编排不再关心 Prisma 落盘细节
- 单句执行不再拥有路由缓存的实现细节
- 持久化模块不再负责参数推导

## 迁移阶段

### Phase 1：边界固化

- 引入 executor policy
- 建立 Mastra compile/runtime adapter
- 不切主链路，只做编译和 smoke test

### Phase 2：受控切换单个 stage

- 先切 `character_discovery`
- 再切 `segment_scripting`
- 每个 stage 都先跑 shadow mode

### Phase 3：完成 LLM-heavy stage 接管

- 切 `segment_repair`
- 切 `quality_judgement`
- 统一 trace / artifact / tool call

### Phase 4：大文件拆解

- 先拆 `text-processor.ts`
- 再拆 `audio-generator.ts`
- 始终保留 facade，不做一次性 import 爆炸式变更

### Phase 5：清理与验收

- 统一运行文档
- 补 replay / shadow diff / rollout runbook
- 决定是否扩大 Mastra 接管范围

## 风险与对策

### 风险 1：双层抽象增加理解成本

对策：

- 明确“Mastra 只负责 LLM agent 层”
- 所有生产 trace 和回放仍然只看现有 runtime

### 风险 2：Mastra 事件模型与现有 trace taxonomy 不一致

对策：

- 先做归一 adapter
- 上层 UI 不直接依赖 Mastra 原生事件

### 风险 3：大文件拆分引发 import 回归

对策：

- 保留 facade 文件
- 先迁移内部实现，再逐步迁移调用方

### 风险 4：切换 executor 后结果漂移

对策：

- 先做 shadow mode
- 对 `segment_scripting / repair / quality` 建立 golden regression

## 验收标准

- 现有 `agents/skills/workflows` 可被同时编译为 native runtime 定义和 Mastra 实例
- 至少一个 LLM-heavy stage 可以在 shadow mode 下通过 Mastra 跑通
- 所有 Mastra 运行事件都能映射为现有 `TraceEvent / ToolCall / RuntimeArtifact`
- `text-processor.ts` 缩减为兼容 facade
- `audio-generator.ts` 缩减为兼容 facade
- 主链路 API、task queue、review/replay UI 不感知底层 executor 差异
