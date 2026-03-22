# Task Round 2026-03-18 Phase 2 Round 2

## 基本信息

- 日期：2026-03-18
- 轮次：Phase 2 / Round 2
- 阶段：阶段 2：台本 -> 音频 生成稳定性收敛
- 分支：`codex/phase-2-audio-reliability`
- 负责人：Codex

## 本轮目标

- 把 Phase 2 的真实运行验证流程脚本化。
- 用真实 synth probe 作为音频验收的准入门槛。
- 把远端一次真实音频验证结果写入 review 文档。

## 本轮范围

- 新增远端音频运行验证脚本。
- 更新远端 TTS runtime runbook。
- 生成本轮 review 与 handoff 文档。
- 至少执行一次真实远端验证。

## 本轮不做的事

- 不改 review UI
- 不接入 metrics 面板
- 不新增历史任务数据回填逻辑
- 不改建书 / 上传 / 文本处理 / 台本生成流程

## 背景与问题分析

- Phase 2 Round 1 已经把 reliability 数据写进 `taskData.metadata.audioReliability`，但当前缺少稳定消费这份数据的验收入口。
- 当前远端运行验证仍偏人工，容易出现“只知道跑过，不知道结果如何归档”的问题。
- 真实 synth probe 已经可用，正好适合作为 Phase 2 验收门禁。

## 关键假设

- 远端 `192.168.88.9:3001` 当前仍可访问。
- 远端存在至少一本可直接触发音频生成的书籍或章节。
- 本轮只做 `chapter/book` 级音频生成验证，不扩展为全流程自动建书脚本。

## 执行计划

1. 先用 TDD 落地脚本参数解析、probe 门禁、review markdown 输出。
2. 再更新 runbook / task / handoff / review 文档骨架。
3. 最后跑一次真实远端验证，并把结果写回 review / handoff。

## 验收标准

- 脚本能在 probe 失败时中止，并写出失败 review。
- 脚本能在任务完成后提取 `audioReliability` 并生成 markdown review。
- runbook 中出现可直接复用的脚本命令模板。
- 至少有 1 次真实远端验证结果被正式写入 `docs/review/2026-03-18-phase-2-runtime-validation.md`。

## 本轮代码质检计划

- 工具：Jest、TypeScript typecheck、Next build、真实远端命令执行
- 计划执行时机：脚本完成后先跑目标测试，再跑 broader verification / typecheck / build，最后执行真实远端验证
- 通过标准：目标测试通过，broader verification 通过，`typecheck` 通过，`build` 通过，远端验证有正式 review 记录

## 风险与回滚点

- 远端环境可能因 provider 波动导致 probe 或任务失败；这属于应记录的真实结果，不应被脚本吞掉。
- 如果远端没有可用书籍 / 章节，本轮应先收集现状并把“环境缺前置样本”作为验证阻塞记录，而不是硬编码假数据。
- 若脚本逻辑开始膨胀成全流程 orchestration，应立刻收口，只保留 Phase 2 所需最小验证链路。

## 预期产物

- 代码：
  - `scripts/phase2-audio-validation.js`
  - `apps/web/src/lib/__tests__/phase2-audio-validation-script.test.ts`
- 文档：
  - `docs/plans/2026-03-18-phase-2-runtime-validation-design.md`
  - `docs/plans/2026-03-18-phase-2-runtime-validation.md`
  - `docs/task/2026-03-18-phase-2-round-2-runtime-validation.md`
  - `docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md`
  - `docs/review/2026-03-18-phase-2-runtime-validation.md`
- 数据 / 验收记录：
  - 真实 provider probe 结果
  - 任务级 `audioReliability` 摘要
