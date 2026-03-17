# Task Round 2026-03-13 Phase 1 Round 12

## 基本信息

- 日期：2026-03-13
- 轮次：Phase 1 / Round 12
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 提升 failed-segment refinement 对 attributed dialogue / 长 quoted span 的切片质量。

## 本轮范围

- 只增强 refinement helper 与对应回归测试。
- 不修改上游 splitter，不放宽 validator。

## 本轮不做的事

- 不做新的 UI / export / metrics 功能。
- 不调整 manual review item 的主分类语义。

## 背景与问题分析

- Round 11 之后，上游 quote-safe segmentation 已经比之前稳定；剩余失败继续集中在 attributed dialogue 与多句 quoted span。
- 这类失败在 refinement 后仍可能保留过长 quoted block 或 narration 过碎，导致重试收益不足。

## 关键假设

- 只要 refinement helper 能按更合理的语义边界切片，真实样本的 SCRIPT_VALIDATION 失败数还有继续下降空间。

## 执行计划

1. 先补 refinement helper 的失败测试。
2. 实现最小语义切片规则。
3. 跑回归并记录 handoff。

## 验收标准

- attributed dialogue 与长 quoted span 都有稳定的 refinement 切片结果。
- broader regression / typecheck / build 全过。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/smart-text-splitter.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/audiobook-regression.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 若 refinement 切得过碎，LLM 调用数会继续膨胀；必须保持“只打失败段”的边界。

## 预期产物

- 代码：refinement helper 与回归测试
- 文档：本轮 task / handoff
- 数据 / 验收记录：回归、typecheck、build 输出
