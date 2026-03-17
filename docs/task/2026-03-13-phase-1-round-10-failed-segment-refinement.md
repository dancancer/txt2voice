# Task Round 2026-03-13 Phase 1 Round 10

## 基本信息

- 日期：2026-03-13
- 轮次：Phase 1 / Round 10
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 对 `SCRIPT_VALIDATION` 的高风险失败段做二次细分重跑，在不放宽 validator 的前提下压低真实样本失败段数量。

## 本轮范围

- 新增失败段细分 helper。
- 在 `processSegmentAndSave()` 中仅对命中边界漂移/漏抽类错误的失败段执行 refinement。
- 更新 closeout 结论，记录真实样本失败段是否下降。

## 本轮不做的事

- 不改 Prompt 契约。
- 不放宽 validator。
- 不全局提高 text processor 的切段激进程度。

## 背景与问题分析

- `uploads/sample.txt(limitToSegments=10)` 的 3 次真实回归已经稳定证明：当前失败段数收敛到 `7/10`，说明问题是结构性失败，不是随机抖动。
- 失败主因集中在 `TEXT_SOURCE_MISMATCH / NON_WHITESPACE_GAP / SOURCE_NOT_FOUND`，且大多发生在“旁白 + 引号对白 + 归属语”混合段。

## 关键假设

- 仅对失败段执行二次细分，能在保持 validator 严格性的同时降低失败段数量。
- 子段只在内存中存在，最终仍按父段统一落库，不会污染 `segmentId` 关系。

## 执行计划

1. 先为 refinement helper 与 processor recovery 写失败测试。
2. 实现最小失败段二次细分逻辑，并保证子段结果回映射到父段。
3. 跑 targeted / broader 回归，更新 closeout review。

## 验收标准

- 命中 `TEXT_SOURCE_MISMATCH / NON_WHITESPACE_GAP / SOURCE_NOT_FOUND` 的失败段可被二次细分重跑。
- refinement 成功时，该父段不再进入 `failedSegmentIds`。
- closeout 真实样本 `failed segments` 相比当前基线显著下降，且结果仍可重复。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 如果 refinement 后的子段 synthetic id 泄漏到数据库，会破坏 `segmentId` 关系；这是本轮必须严守的回滚点。
- 如果子段切得过碎导致上下文丢失，可能把失败模式从 `validator` 问题转成 `speaker` 猜错；需要通过测试样本约束切分策略。

## 预期产物

- 代码：失败段细分 helper、processor refinement、回归测试
- 文档：本轮 task / handoff、closeout review 更新
- 数据 / 验收记录：真实样本失败段变化记录
