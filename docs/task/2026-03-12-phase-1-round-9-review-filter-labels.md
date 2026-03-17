# Task Round 2026-03-12 Phase 1 Round 9

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 9
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 把 review 过滤条当前选中值从原始 value 改成中文标签，消除 `pending / SCRIPT_VALIDATION / regenerate` 这类直接暴露给复核人员的内部值。

## 本轮范围

- 仅清理 review filter bar 的当前值展示。
- 保持现有筛选语义、query 参数和值本身不变。
- 补充过滤条渲染测试，锁定中文显示。

## 本轮不做的事

- 不修改 Select 基础组件。
- 不改其他页面的 Select 展示。
- 不调整 review 筛选逻辑。

## 背景与问题分析

- 当前过滤条已经能按推荐动作筛选，但 Select 触发器显示的是原始 value，而不是用户语义标签。
- 这会把内部枚举值直接泄露到 UI，降低复核工作台的可读性。

## 关键假设

- 仅在 `ReviewQueuePanel` 层显式映射当前值到标签，就足够解决问题，不必冒险改通用 Select 组件。

## 执行计划

1. 先写过滤条失败测试，锁定中文标签期望。
2. 在 `ReviewQueuePanel` 中为状态、问题类型、脚本子类型、推荐动作、优先级显式渲染当前标签。
3. 跑受影响测试、typecheck、build，并补 handoff。

## 验收标准

- 过滤条默认选中项不再显示原始 value。
- 脚本问题视角下的推荐动作筛选显示中文标签。
- 新增测试通过，相关回归通过。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 若直接改通用 Select，会扩大影响面；本轮必须把变化收在 review 过滤条内部。

## 预期产物

- 代码：过滤条标签映射与测试
- 文档：本轮 task / handoff
- 数据 / 验收记录：测试、typecheck、build 输出
