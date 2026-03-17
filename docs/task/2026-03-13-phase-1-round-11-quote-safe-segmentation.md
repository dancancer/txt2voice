# Task Round 2026-03-13 Phase 1 Round 11

## 基本信息

- 日期：2026-03-13
- 轮次：Phase 1 / Round 11
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 修复 smart splitter 在引号对白内部断句的问题，避免上游生成残缺 segment。

## 本轮范围

- 在 `smart-text-splitter` 的句子切分与强制切段里增加 quote-safe 边界。
- 为 text processor 补“不会产出残缺引号段”的回归测试。
- 更新 closeout review，确认真实样本失败数是否下降。

## 本轮不做的事

- 不修改 validator。
- 不删除 refinement。
- 不回退到传统 splitter。

## 背景与问题分析

- Round 10 已证明 refinement 会命中真实失败段，但日志同时暴露：某些失败段在进入 script generation 前就已经被切坏，只剩“半句对白 + 右引号”的残缺切片。
- 这说明真正根因在上游 `smart-text-splitter`，不是下游 validator 或 review workbench。

## 关键假设

- 只要确保引号内部不被断句，就能显著减少 `TEXT_SOURCE_MISMATCH / NON_WHITESPACE_GAP` 这类由坏 segment 引发的失败。

## 执行计划

1. 先写 smart splitter 与 text processor 的失败测试。
2. 最小实现 quote-safe sentence splitting。
3. 跑回归和真实样本验证，更新 closeout review。

## 验收标准

- 对话内部的 `！/？/…` 不再导致 segment 在引号内部断开。
- 不再产出“只剩右引号的残缺对白尾巴”这类 segment。
- closeout 样本的 `failed segments / pending review` 相对当前基线下降。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand src/lib/__tests__/smart-text-splitter.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/audiobook-regression.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 若 quote-safe 规则过于保守，会抬高 segment 长度并影响均匀性；需要靠 regression 验证防回退。
- 若仅处理 `“”` 而忽略其他引号对，仍会留下隐藏边界问题。

## 预期产物

- 代码：quote-safe splitter、回归测试
- 文档：本轮 task / handoff、closeout review 更新
- 数据 / 验收记录：真实样本失败段变化记录
