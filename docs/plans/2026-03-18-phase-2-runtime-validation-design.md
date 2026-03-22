# Phase 2 Runtime Validation Design

## 背景

`2026-03-17` 的 Phase 2 Round 1 已经把音频稳定性的第一层地基补上：

- provider runtime policy 已落地
- 三阶段补跑已接入批量音频生成
- provider status 已支持显式 `probe=true`
- `processingTask.taskData.metadata.audioReliability` 已开始沉淀首轮成功率、补跑轮次和 provider 失败分布

但这些能力目前还主要停留在“代码已经有了”的状态，缺少一条可重复执行、可落文档、可直接用于阶段验收的真实运行验证链路。

如果没有脚本化验证，Phase 2 很容易退回到两种低质量状态：

1. 每次靠人工现点接口，证据散落在终端历史里
2. reliability 字段虽然写进了 task metadata，但没人稳定消费，也就没人能真正用它判断“是否收敛”

## 目标

- 提供一条可脚本化执行的远端 Phase 2 验证流程。
- 在验证开始前强制执行真实 synth probe，而不是只看 `/api/health`。
- 跑完一次 `chapter` 或 `book` 级音频生成后，自动提取 `audioReliability` 并写成 review 文档。
- 让 Phase 2 的“稳定性验收”有统一入口、统一记录格式和统一结论口径。

## 方案比较

### 方案 A：只更新 runbook

优点：

- 改动最少。

缺点：

- 仍然依赖人工拷贝 task id、手抄结果、手写 review。
- 证据链不稳定，很难形成阶段性对比。

### 方案 B：runbook + 脚本化验证 + review 落档（推荐）

优点：

- 既保留人工 runbook，又把关键执行步骤脚本化。
- 可以直接消费 `audioReliability`，和 Round 1 的实现天然衔接。
- 最适合作为 Phase 2 的验收入口。

缺点：

- 需要新增脚本、参数解析、轮询逻辑和 review 生成逻辑。
- 需要真实远端环境配合验证。

### 方案 C：直接把 reliability 指标接到 review / metrics UI

优点：

- 可视化更好。

缺点：

- 当前缺的不是“展示”，而是“真实运行证据”。
- 如果先做 UI，会把优先级从验收偏到可视化。

## 选择

采用方案 B。

## 设计

### 1. 脚本入口

新增脚本：

- `scripts/phase2-audio-validation.js`

职责：

1. 解析 CLI 参数
2. 先调用 `/api/tts/providers/status?probe=true`
3. 再触发 `/api/books/[id]/audio/generate`
4. 轮询 `/api/books/[id]/audio/generate?includeProgress=true`
5. 提取 `audioReliability`
6. 生成 markdown review

这条脚本只解决 Phase 2 的验证，不做通用运维框架。

### 2. 输入边界

脚本最小参数集：

- `--base-url`
- `--provider`
- `--type=chapter|book`
- `--book-id`
- `--chapter-id`（仅 `type=chapter` 时要求）
- `--batch-size`
- `--repeat-count`
- `--poll-interval-ms`
- `--timeout-ms`
- `--review-path`

默认值：

- `baseUrl=http://192.168.88.9:3001`
- `provider=voxcpm`
- `type=chapter`
- `repeatCount=1`

当前不做“自动建书 / 自动上传 / 自动文本处理 / 自动台本生成”，避免把脚本范围膨胀成端到端全流程编排器。

### 3. 验证门禁

每轮运行都必须先 probe：

- provider `healthy` 必须为 `true`
- `probeHealthy` 必须为 `true`

否则：

- 当前轮直接中止
- review 仍然写出失败原因
- 脚本以非零退出

这样能把 “health 绿但 synth 不可用” 直接变成显式失败，而不是等到音频任务中途才暴露。

### 4. reliability 提取与结论

从 `taskDetails.metadata.audioReliability` 提取：

- `firstPassSuccessRate`
- `retryRounds`
- `averageDurationMs`
- `providerFailures`
- `passSummaries`

并生成固定结论：

- `completed`
- `partial_failure`
- `failed`
- `probe_failed`

结论规则只围绕本轮运行事实，不引入额外启发式评分。

### 5. review 文档

新增 review 文档：

- `docs/review/2026-03-18-phase-2-runtime-validation.md`

内容至少包含：

- 执行环境
- provider probe 结果
- 每轮 run 的 task id / progress / verdict
- `audioReliability` 摘要
- 最终结论
- 是否建议调低某 provider 并发

如果 `repeatCount > 1`，则按表格方式追加多轮记录，类似 Phase 1 convergence runbook 的写法。

### 6. runbook 更新

更新：

- `docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

新增内容：

- 如何用脚本执行 Phase 2 验证
- 推荐命令模板
- probe 失败 / 任务失败时如何判定问题层级

## 不做的事

- 不改 review UI
- 不改 metrics 面板
- 不为历史 `audioReliability` 空值任务做兼容回填
- 不把脚本扩展成全自动建书上传流水线

## 验证

- 参数解析、probe 门禁、review markdown 生成逻辑有单测
- 脚本主流程有 fetch mock 测试
- 至少执行一次真实远端验证，并生成 review 文档

