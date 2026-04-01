# txt2voice 技术架构

> 更新日期：2026-04-01

## 1. 架构定位

txt2voice 当前采用“单体 Web 应用 + 异步任务队列 + 文件化 Agent Runtime + Mastra 混合执行层”的组合架构：

- `apps/web` 同时承载页面、API、任务触发、Worker 启动和核心业务服务
- `Redis + Bull` 负责长链路任务异步执行、重试和故障恢复
- `PostgreSQL + Prisma` 负责业务主数据、任务数据、运行时追踪和质检结果
- `agents/`、`skills/`、`workflows/` 为台本生产提供文件化运行时定义层
- `Mastra` 只负责 LLM-heavy stage 的 agent authoring / tool bridge / shadow execution
- 外部 LLM 与 TTS Provider 通过统一服务层接入，不把业务流程散落在 Route 内

这套架构的目标不是最小 demo，而是让“长文本生产为可交付音频”这条链路具备三件事：

1. 可以分阶段执行，也可以一键自动编排
2. 可以在章节、段落、句子粒度局部重跑
3. 可以把失败、质检、人工复核、重生与交付串成一个闭环

## 2. 系统总览

```text
Browser / Workbench
        |
        v
Next.js Pages + App Router API
        |
        v
Service Layer (apps/web/src/lib)
        |
        +--> PostgreSQL / Prisma
        |
        +--> Redis / Bull Queues
        |        |
        |        +--> script-generation
        |        +--> audio-generation
        |        +--> audio-synthesis
        |        +--> quality-check
        |        +--> quality-signal-sync
        |        +--> auto-pipeline
        |        +--> llm-execution
        |        +--> dead-letter
        |
        +--> Agent Runtime
        |        |
        |        +--> agents/
        |        +--> skills/
        |        +--> workflows/
        |
        +--> External Providers
                 |
                 +--> LLM Gateway
                 +--> IndexTTS / CosyVoice / VoxCPM / Azure / OpenAI
```

## 3. 分层边界

### 3.1 页面与 API 层

主要目录：`apps/web/src/app/**`

职责：

- 提供书籍、角色、台本、音频、复核、任务中心等页面
- 提供 App Router API，做请求编排、参数校验和响应封装
- 通过 `withErrorHandler` 统一错误出口

主要 API 家族：

- `api/books/**`：书籍、章节、文本处理、台本、音频、复核
- `api/tts/**`：Provider 状态、试听、Speaker、Voice、参考音频
- `api/tasks/**`：任务列表、重试、重放
- `api/qc/**`、`api/slo/**`：质检扫描、派单告警、SLO 监控
- `api/health`：健康检查

### 3.2 业务服务层

主要目录：`apps/web/src/lib/**`

职责：

- 封装文本处理、台本生成、音频生成、质检、复核、自动编排等核心逻辑
- 对 Prisma、LLM、TTS Provider、队列层提供稳定业务接口
- 承接 Route 之外的业务规则，避免页面/API 直接操作底层细节

关键子模块：

- `text-processor.ts` + `text-processing/**`：文本处理 facade 与模块树
- `script-generation-runner.ts`、`script-generator/**`：台本生产
- `audio-generation-runner.ts`、`audio-generator.ts` + `audio-generation/**`：音频生产 facade 与模块树
- `quality-check-runner.ts`、`manual-review-service.ts`：质检与复核
- `auto-pipeline/**`：一键编排
- `slo-metrics/**`、`slo-alerts/**`：运营监控

### 3.3 队列与 Worker 层

主要目录：`apps/web/src/lib/task-queue/**`

职责：

- 统一创建 Bull Queue
- 定义任务超时、重试、回退和死信策略
- 启动 Worker，消费脚本、音频、质检、自动编排和 LLM 子任务
- 提供任务健康检查、重放、恢复与命名空间隔离

### 3.4 Agent Runtime 层

主要目录：

- `apps/web/src/lib/agent-runtime/**`
- `agents/**`
- `skills/**`
- `workflows/**`

职责：

- 为台本生产提供 workflow / stage / agent / tool / artifact 运行时
- 把角色发现、分段生成、修复、质量判断、持久化和复核交接拆成可追踪阶段
- 把运行过程沉淀为 `WorkflowRun`、`StageRun`、`AgentRun`、`ToolCall`、`TraceEvent`

混合执行策略：

- `agent-runtime` 继续作为生产 orchestration、持久化真相源和 replay 数据源
- `Mastra` 只接 `character_discovery`、`segment_scripting`、`segment_repair`、`quality_judgement`
- `native / mastra / shadow mode` 最终都统一回写现有 `ToolCall`、`TraceEvent`、`RuntimeArtifact`
- `shadow mode` 不影响主业务结果，只额外写入 `shadow-diff` sidecar artifact

关键实现：

- `apps/web/src/lib/agent-runtime/runtime/executor-policy.ts`
- `apps/web/src/lib/agent-runtime/mastra/compiler/**`
- `apps/web/src/lib/agent-runtime/mastra/runtime/**`
- `apps/web/src/lib/agent-runtime/mastra/trace/**`

## 4. 核心运行链路

### 4.1 文本处理链路

入口：

- `POST /api/books/[id]/process`
- `POST /api/books/[id]/pipeline/auto`

核心能力：

- 文本编码检测，支持 UTF-8、GBK、GB2312、UTF-16LE、Big5 等常见编码
- 文本清洗、格式识别、章节检测
- 智能段落切分，写入 `Chapter` 与 `TextSegment`
- 章节切分失败时支持降级策略

关键实现：

- `apps/web/src/lib/text-processor.ts`
- `apps/web/src/lib/auto-pipeline/task-stage-utils.ts`

### 4.2 台本生产链路

入口：

- `POST /api/books/[id]/script/generate`
- `POST /api/books/[id]/script/generate/stream`
- `POST /api/books/[id]/pipeline/auto`

当前实现不是单次 LLM 调用，而是一个带阶段追踪的 `script-production` workflow。

主要阶段：

1. `prepare`
2. `character_discovery`
3. `segment_scripting`
4. `validation`
5. `segment_repair`
6. `quality_judgement`
7. `persist`
8. `manual_review_handoff`
9. `complete`

运行特征：

- 支持整书生成、局部增量、指定段落重生
- 支持格式修复、本地修复、语义重试
- 失败段落可以进入修复与人工复核
- 运行时结果会回写 `ProcessingTask`，并为书籍保留 workflow 指针
- LLM-heavy stage 已支持显式 executor policy 和 shadow diff 落库
- UI / replay / 报表继续只消费统一后的 runtime records，不感知底层 executor

关键实现：

- `apps/web/src/lib/script-generation-runner.ts`
- `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts`
- `workflows/script-production/workflow.toml`

### 4.3 音频生产链路

入口：

- `POST /api/books/[id]/audio/generate`
- `POST /api/books/[id]/audio/merge`
- `POST /api/books/[id]/pipeline/auto`

链路拆分：

- 父任务：`AUDIO_GENERATION`，负责选取范围、批量提交、进度汇总
- 子任务：`audio-synthesis` 队列，负责单句合成
- 合并阶段：章节或整书音频合并、状态收口

运行特征：

- 根据角色/Speaker/Voice 绑定选择 Provider
- 记录 `AudioFile` 与 `SynthesisAttempt`
- 支持跳过已存在音频、覆盖生成、批量设置
- 对失败句子支持重试、QC 回写和人工复核重生

关键实现：

- `apps/web/src/lib/audio-generation-runner.ts`
- `apps/web/src/lib/audio-generator.ts`
- `apps/web/src/lib/audio-generation/**`
- `apps/web/src/lib/audio-synthesis-runtime.ts`
- `apps/web/src/lib/final-assembly-runner.ts`

### 4.5 运行时开关

当前混合 runtime 的行为由环境变量控制：

- `AGENT_RUNTIME_EXECUTOR=native|mastra`
  说明：
  `native` 为默认值，主结果完全走现有 runtime。
- `AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting,segment_repair,quality_judgement`
  说明：
  只有命中 allowlist 的 stage 才会切到 Mastra。
- `AGENT_RUNTIME_MASTRA_SHADOW_MODE=true|false`
  说明：
  打开后主结果仍走 native，但并行运行 Mastra，并把差异写入 `shadow-diff` artifact。

排障建议：

- 先用 `native + shadow mode` 验证结果漂移，再考虑单独把某个 stage 切到 `mastra`
- 不要直接让持久化和 deterministic service 走 Mastra
- replay 与审核界面若需要看差异，应读取 `RuntimeArtifact.artifactKind = shadow-diff`

### 4.4 质量闭环链路

入口：

- `POST /api/books/[id]/qc/run`
- `POST /api/books/[id]/qc/signals/sync`
- `POST /api/books/[id]/review/items/sync`
- `POST /api/books/[id]/review/items/regenerate-all-pending`

运行特征：

- 使用 Fast Gate + Deep Gate 进行音频质量评估
- 产出 `QualityCheckResult`
- 需要人工介入时生成 `ManualReviewItem`
- 复核页支持批量解决、脚本编辑、批量重生
- SLO、告警、派单策略可从 `qc/*` 与 `slo/*` 路由查看和回滚

关键实现：

- `apps/web/src/lib/quality-check-runner.ts`
- `apps/web/src/lib/manual-review-service.ts`
- `apps/web/src/lib/quality-signal-sync-runner.ts`
- `apps/web/src/lib/qc-dispatch-policy.ts`
- `apps/web/src/lib/slo-metrics/service.ts`

### 4.5 自动编排链路

入口：

- `POST /api/books/[id]/pipeline/auto`

默认阶段：

1. `text_processing`
2. `script_generation`
3. `audio_generation`
4. `quality_check`

特征：

- 单个父任务串联多个子任务
- 每个阶段单独创建 `ProcessingTask`
- 书籍状态会在 `processing`、`quality_checking`、`manual_review_pending`、`assembling_audio`、`completed` 之间切换
- 支持补偿任务与最终组装任务

关键实现：

- `apps/web/src/lib/auto-pipeline/runner.ts`
- `apps/web/src/lib/auto-pipeline-trigger-service.ts`
- `apps/web/src/lib/auto-pipeline-compensation-runner.ts`

## 5. 队列拓扑

| 队列 | 主要职责 | 典型消费者 |
| --- | --- | --- |
| `script-generation` | 台本生产父任务 | `runScriptGenerationTask()` |
| `audio-generation` | 音频生产父任务 | `runAudioGenerationTask()` |
| `audio-synthesis` | 单句音频合成子任务 | `runAudioSynthesisJob()` |
| `quality-check` | 音频质量检查 | `runQualityCheckTask()` |
| `quality-signal-sync` | 质量信号回填与对齐 | `runQualitySignalSyncTask()` |
| `auto-pipeline` | 一键编排、补偿、最终组装、复核同步 | `runAutoPipelineTask()` 等 |
| `llm-execution` | LLM 调用并发隔离 | `runLLMExecutionJob()` |
| `dead-letter` | 失败任务沉淀 | `addDeadLetter()` |

队列治理要点：

- 队列名带 `TASK_QUEUE_NAMESPACE`
- 多实例并行时必须使用不同 namespace
- Worker 带心跳与 stalled recovery
- 同类任务使用不同 timeout / retry / removeOnComplete 策略

## 6. 数据架构

### 6.1 内容结构域

| 模型 | 作用 |
| --- | --- |
| `Book` | 书籍主实体，保存元数据、状态、统计、运行时指针 |
| `Chapter` | 章节边界、顺序与章节级状态 |
| `TextSegment` | 章节内段落切片，是台本生产最小上游单元 |

### 6.2 台本与角色域

| 模型 | 作用 |
| --- | --- |
| `CharacterProfile` / `CharacterAlias` | 角色主档、别名、系统角色标记 |
| `CharacterVoiceBinding` / `CharacterSpeakerBinding` | 角色与 Voice / Speaker 的绑定 |
| `ScriptSentence` | 台词、旁白、情绪、语气、Prosody 等结构化结果 |
| `WorkflowRun` / `StageRun` / `AgentRun` / `ToolCall` / `TraceEvent` / `RuntimeArtifact` | 台本生产运行时追踪 |

### 6.3 音频与质量域

| 模型 | 作用 |
| --- | --- |
| `AudioFile` | 音频产物及状态 |
| `SynthesisAttempt` | 单句合成尝试记录 |
| `QualityCheckResult` | Fast Gate / Deep Gate 质检结论 |
| `ManualReviewItem` | 人工复核任务 |
| `ChapterQualityAudit` | 章节级审计结果 |

### 6.4 编排与运营域

| 模型 | 作用 |
| --- | --- |
| `ProcessingTask` | 文本、台本、音频、质检、自动编排等父任务跟踪 |
| `QcDispatchAlertEvent` | 质检派单告警事件 |
| `QcDispatchPolicyConfig` / `QcDispatchPolicyRevision` | 质检派单策略与版本回滚 |

## 7. 状态模型

### 7.1 书籍状态

主状态集：

`uploaded -> processing -> processed -> generating_script -> script_generated -> generating_audio -> quality_checking -> manual_review_pending -> assembling_audio -> completed`

补充分支：

- 部分成功时进入 `completed_with_errors`
- 异常失败时进入 `error`

### 7.2 任务状态

`pending -> processing -> completed | failed`

`ProcessingTask` 是用户可见的主进度对象，业务层通过 `taskData.message` 与 `taskData.metadata` 继续补充子任务摘要。

### 7.3 人工复核状态

`pending -> reprocessing -> resolved | rejected`

这条状态机是“质检 -> 人工复核 -> 重生 -> 二次验证”闭环的核心。

## 8. 外部依赖与部署

### 8.1 开发环境

`docker-compose.yml` 默认提供：

- `postgres`
- `redis`
- `pgadmin`
- `redisinsight`
- `web`

推荐开发模式是“本地跑 Web，Docker 跑依赖服务”：

```bash
pnpm install
cp .env.local.example .env.local
pnpm docker:services
pnpm --filter web dev
```

### 8.2 生产与远端 TTS

- Web 生产镜像由 `docker-compose.prod.yml` 管理
- 远端 TTS 栈说明位于 `ops/remote-tts-stack/README.md`
- 当前远端常见 Provider 端口：
  - `8001`：IndexTTS
  - `8011`：CosyVoice
  - `8012`：VoxCPM

## 9. 目录边界

```text
apps/web/src/
├── app/                 # 页面与 API Route
├── components/          # UI 组件
├── hooks/               # 页面数据与行为封装
├── lib/                 # 核心业务服务、队列、运行时
├── store/               # Zustand 状态
├── types/               # 前端共享类型
└── generated/prisma/    # Prisma Client 生成产物
```

仓库根目录的边界补充：

- `agents/`：Agent 定义
- `skills/`：Skill 定义
- `workflows/`：Workflow 定义
- `docs/`：业务、专题、计划、评审和归档文档
- `ops/`：运维与外部服务栈说明

## 10. 当前设计取向

1. 单体优先：尽量把复杂度留在模块边界内，而不是拆成大量进程间协议
2. 任务化优先：重链路全部落到 `ProcessingTask` 与队列，不让长请求阻塞 API
3. 追踪优先：台本生产已经不是黑盒调用，而是可复盘的运行时
4. 复核优先：质检、人工复核和重生是正式主链路，不是补丁
5. 局部重跑优先：章节、段落、句子都要允许重处理与最小化影响面
