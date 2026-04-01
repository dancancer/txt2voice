# Task Round 2026-03-17 Phase 2 Round 1

## 基本信息

- 日期：2026-03-17
- 轮次：Phase 2 / Round 1
- 阶段：阶段 2：台本 -> 音频 生成稳定性收敛
- 分支：`codex/phase-2-audio-reliability`
- 负责人：Codex

## 本轮目标

- 建立 provider 级音频运行时策略。
- 为 provider status 增加真实 synth 探针能力。
- 把音频 runner 从单轮批跑收敛为保守首轮 + failed-only 补跑 + 单句救援。
- 为每次音频任务沉淀可靠性指标，支撑后续 Phase 2 closeout。

## 本轮范围

- 新增 `audio-runtime-policy`、`audio-retry-plan`、`tts-runtime-probe` 三个基础模块。
- 改造 `audio-generation-runner` 与 `tts/providers/status` 路由接入新策略。
- 增加针对 provider policy、retry pass、synth probe、runner reliability 的回归测试。

## 本轮不做的事

- 不改前端音频设置 UI。
- 不重写任务队列架构。
- 不引入 provider 独立 worker。
- 不处理 Phase 3 的 QC 召回策略。

## 背景与问题分析

- Phase 1 已具备结项证据，主线已转向音频稳定性。
- 当前音频链路只有全局 `batchSize`，没有 provider 分级并发策略。
- 当前 provider status 只看 `/api/health`，无法识别 `health 绿但 synth 不可用`。
- 当前 runner 只有单轮全量生成，无法把失败收敛到 failed-only 补跑和单句救援。

## 关键假设

- `batchSize` 在现阶段可作为 provider pass 并发度的直接控制面。
- provider 级 runtime policy 可以先以静态配置落地，后续再按真实运行数据调参。
- synth probe 默认不自动执行，只在显式请求时触发，避免把探活变成额外压力源。

## 执行计划

1. 先用 TDD 落地 provider runtime policy 与 retry pass 规划。
2. 再用 TDD 落地 synth probe 与 provider status route 扩展。
3. 最后用 TDD 改造 audio runner 三阶段执行与 reliability metadata。

## 验收标准

- provider policy 能区分 `indextts / cosyvoice / voxcpm` 的首轮、补跑、救援并发。
- provider status route 能在显式 probe 时返回真实 synth 结论。
- audio runner 能在一次任务内完成 `pass-1 / pass-2 / pass-3`，且补跑只针对失败句。
- task metadata 能输出首轮成功率、补跑次数、provider 失败分布、平均句级耗时。

## 本轮代码质检计划

- 工具：Jest、TypeScript typecheck、Next build
- 计划执行时机：每个 TDD 子任务绿灯后执行对应目标测试；本轮结束前执行 broader verification 与 build
- 通过标准：新增目标测试通过，相关回归通过，`pnpm --filter web typecheck` 通过，`pnpm --filter web build` 通过

## 风险与回滚点

- 若三阶段重跑把 runner 复杂度拉爆，需要继续拆小 helper，避免把逻辑塞回大文件。
- 若真实 synth probe 对某 provider 依赖过重，需退回为显式 probe only，不自动接入常规页面加载。
- 若 retry pass 打乱 manual review / qc retry 现有逻辑，优先回滚到 runner 内部封装，而不是回退整个策略层。

## 预期产物

- 代码：
  - `apps/web/src/lib/audio-runtime-policy.ts`
  - `apps/web/src/lib/audio-retry-plan.ts`
  - `apps/web/src/lib/tts-runtime-probe.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
  - `apps/web/src/app/api/tts/providers/status/route.ts`
- 文档：
  - `docs/task/2026-03-17-phase-2-round-1-audio-runtime-policy.md`
  - `docs/handoff/2026-03-17-phase-2-round-1-audio-runtime-policy.md`
- 数据 / 验收记录：
  - runner reliability metadata 回归
  - provider status probe 回归
