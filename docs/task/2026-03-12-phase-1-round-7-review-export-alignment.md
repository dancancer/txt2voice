# Task Round 2026-03-12 Phase 1 Round 7

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 7
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 让 `SCRIPT_VALIDATION` 的 review 卡片与 CSV 导出复用同一套详情语义，并完成详情区中文化收口。

## 本轮范围

- 抽取共享脚本失败详情 helper，供 UI 与导出共用。
- 把详情区剩余英文标题统一成中文。
- 为 CSV 导出增加脚本失败标签、推荐动作、摘要和问题列表字段。

## 本轮不做的事

- 不修改 manual review resolve API。
- 不接入 metrics / dispatch 统计。
- 不改变按钮行为与批量操作语义。

## 背景与问题分析

- 当前 review workbench 已经能展示完整问题列表与推荐动作，但 CSV 导出还带不走这些关键信息。
- 页面和导出如果继续各写一套脚本失败展示规则，后续很容易漂移，复核链路会重新碎裂。

## 关键假设

- `SCRIPT_VALIDATION` 的核心展示语义已经相对稳定，适合下沉为共享 helper。
- 非脚本问题在导出中新增列时允许留空，不需要强造语义。

## 执行计划

1. 先写失败测试，锁定中文标题和 CSV 新字段。
2. 把脚本失败详情归一化逻辑抽到共享层，最小改动接回 UI 与导出。
3. 跑回归、typecheck、build，并补 handoff。

## 验收标准

- review 卡片详情区不再残留英文标题。
- CSV 导出包含 `issueSubtypeLabel`、`recommendedAction`、`scriptSummary`、`scriptIssueMessages`。
- UI 与 CSV 的脚本失败摘要、推荐动作来源一致。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 共享 helper 若仍依赖 app 层类型，会形成坏方向依赖，必须保持在 `lib` 可复用层。
- CSV 增列会改变列顺序，若外部脚本有固定索引依赖，需要同步更新。

## 预期产物

- 代码：共享 helper、review 中文化、CSV 对齐、测试
- 文档：本轮 task / handoff、设计文档、实现计划
- 数据 / 验收记录：测试、typecheck、build 输出
