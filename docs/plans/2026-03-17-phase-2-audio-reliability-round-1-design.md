# Phase 2 Audio Reliability Round 1 Design

## 背景

Phase 1 已经把 `原文 -> 台本` 的确定性收口到可结项状态，`docs/review/2026-03-12-phase-1-closeout.md` 也已经明确下一阶段主线转向音频稳定性。

当前音频链路的主要问题不是“完全不能跑”，而是“缺少稳定、保守、可解释的执行策略”：

1. 批量生成仍只有一个全局 `batchSize`，没有 provider 级并发分档。
2. 运行时只有 `/api/health` 级别健康检查，没有真实 synth 探针。
3. runner 只有“一轮全量生成 + 结果汇总”，没有失败项二次、三次补跑编排。
4. 任务 metadata 里缺少 Phase 2 验收需要的可靠性指标，无法沉淀首轮成功率、补跑次数和 provider 失败分布。

这几个问题本质上是同一个问题：系统还没有把“provider 的真实承载能力”显式建模。

## 目标

- 给 `indextts / cosyvoice / voxcpm` 建立统一的运行时策略表，而不是在主流程里散落条件分支。
- 把整书/章节音频生成改成保守首轮 + failed-only 补跑 + 单句救援的三阶段执行。
- 提供真实 synth 探针，避免“health 绿但 synth 不可用”继续误导调用方。
- 为每次音频任务记录可靠性指标，给后续 closeout 和 phase review 提供证据。

## 方案比较

### 方案 A：继续沿用单轮批跑，只调默认 `batchSize`

优点：

- 改动最少。

缺点：

- 不能表达不同 provider 的承载差异。
- 失败后仍只能靠人工补跑，不能形成系统性收敛。
- 仍然解决不了假健康状态。

### 方案 B：增加 provider runtime policy + 三阶段重跑 + synth probe（推荐）

优点：

- 直接对应 roadmap Phase 2 的四个核心要求。
- 通过数据结构消除 scattered branching，后续新增 provider 也能复用。
- 不必一次性重写队列模型，能在现有 runner 上增量落地。

缺点：

- 需要拆分现有大文件，把策略、探针、重跑计划抽成独立模块。
- 测试面会变大，需要补足 runner 与路由回归。

### 方案 C：直接重做成 provider 独立队列 + sentence-level 调度

优点：

- 长期形态更彻底。

缺点：

- 这轮成本过大，超出 Round 1 合理范围。
- 会把 Phase 2 的“先收敛，再抽象”变成“先重构，再验证”。

## 选择

采用方案 B。

## 设计

### 1. provider runtime policy

新增独立策略模块，集中描述每个 provider 的运行时特征：

- `firstPassConcurrency`
- `retryPassConcurrency`
- `rescuePassConcurrency`
- `cooldownMs`
- `synthProbeText`
- `probeVoiceId` 或 `probeMode`
- `maxPasses`

这样主流程只消费统一策略，不再在 `audio-generator` / `audio-generation-runner` 里堆 `if (provider === "voxcpm")`。

### 2. 三阶段音频执行模型

本轮不引入新的队列类型，只在现有 runner 内增加稳定化编排：

1. `pass-1`: 按 provider 策略保守并发跑全量。
2. `pass-2`: 只对失败句重跑，使用更低并发。
3. `pass-3`: 对仍失败的句子按单句或极低并发救援。

每轮都产出：

- 输入句数
- 成功数 / 失败数
- provider 维度失败分布
- 平均句级耗时

整轮结束后再汇总到 task metadata。

### 3. 真实 synth 探针

新增 `tts-runtime-probe` 帮助函数，对 provider 执行一次最小真实合成请求：

- `indextts`: 使用可用参考音频做最短文本 synth
- `cosyvoice`: 使用 reference audio 或约定模式做最短 synth
- `voxcpm`: 直接走最短文本 synth

`/api/tts/providers/status` 增加 probe 能力，但保持默认轻量：

- 默认：返回普通 `healthCheck`
- 显式请求 probe 时：追加真实 synth 结果

这样能避免每次页面加载都打真实合成，同时让运维/验收有权拿到真健康结论。

### 4. 可靠性指标沉淀

在 `processingTask.taskData.metadata` 中增加统一结构：

- `audioReliability.passSummaries`
- `audioReliability.firstPassSuccessRate`
- `audioReliability.retryRounds`
- `audioReliability.providerFailures`
- `audioReliability.averageDurationMs`
- `audioReliability.probe`

后续 Phase 2 的 closeout、handoff、人工排障都直接消费这份数据。

### 5. 文件拆分

当前 `audio-generator.ts`、`audio-generation-runner.ts` 过大，这轮顺手拆出最小必要模块：

- `apps/web/src/lib/audio-runtime-policy.ts`
- `apps/web/src/lib/tts-runtime-probe.ts`
- `apps/web/src/lib/audio-retry-plan.ts`

原则是只抽“会继续长”的逻辑，不做无意义重构。

## 不做的事

- 不改前端音频设置 UI
- 不重写任务队列架构
- 不引入 provider 独立 worker
- 不处理 Phase 3 的 QC 策略升级

## 验证

- provider policy / retry plan / synth probe 单测通过
- audio generation runner 新增三阶段执行回归通过
- provider status route 新增 probe 回归通过
- `pnpm --filter web typecheck`
- Phase 2 相关目标测试通过

