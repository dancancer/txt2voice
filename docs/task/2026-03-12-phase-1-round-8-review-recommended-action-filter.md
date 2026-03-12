# Task Round 2026-03-12 Phase 1 Round 8

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 8
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 为 `SCRIPT_VALIDATION` 复核项增加按推荐动作筛选的能力，并保持列表、分页、导出语义一致。

## 本轮范围

- 在共享 helper 中补齐推荐动作元数据与逆向映射。
- 在服务端查询中支持 `recommendedAction`。
- 在 review filter bar 增加推荐动作下拉，并把参数接入列表与导出。

## 本轮不做的事

- 不修改数据库 schema。
- 不做批量“按推荐动作执行”。
- 不改 resolve API 和按钮行为。
- 不接 metrics / dashboard。

## 背景与问题分析

- 当前推荐动作已经能展示到卡片和 CSV，但还不能聚合筛选。
- 如果继续让复核人员肉眼扫“推荐动作：重生”，那这层推荐还没有真正形成作业效率。

## 关键假设

- 现阶段推荐动作主要用于 `SCRIPT_VALIDATION`，其他 issueType 无需强行接入。
- `recommendedAction -> subtype[]` 的规则可以稳定由共享 helper 提供，不必持久化到数据库。

## 执行计划

1. 先写 query / filter bar 失败测试。
2. 最小实现推荐动作逆向映射、服务端过滤和前端筛选控件。
3. 跑回归、typecheck、build，并补 handoff。

## 验收标准

- `recommendedAction` 可通过 query 解析并参与列表过滤。
- review filter bar 在脚本问题视角下显示推荐动作下拉。
- 当前筛选条件导出 CSV 时能带上同样的 `recommendedAction` 过滤。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 服务端筛选依赖 `issueDetail.scriptSubtype`，历史未回填数据的表现与现有 `scriptSubtype` 筛选保持一致。
- 当前推荐动作高度偏向 `重生`，UI 上可能出现选项不均衡，但这属于真实数据分布。

## 预期产物

- 代码：推荐动作共享元数据、服务端筛选、前端过滤条、测试
- 文档：本轮 task / handoff、设计文档、实现计划
- 数据 / 验收记录：测试、typecheck、build 输出
