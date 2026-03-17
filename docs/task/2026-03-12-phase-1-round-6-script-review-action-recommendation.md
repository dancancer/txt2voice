# Task Round 2026-03-12 Phase 1 Round 6

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 6
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 把 `SCRIPT_VALIDATION` 的建议动作真正联动到处置按钮层，让复核人员一眼知道系统当前更推荐“通过 / 驳回 / 重生”中的哪一个。

## 本轮范围

- 为脚本失败详情模型增加推荐动作字段。
- 在 review 队列卡片的按钮区高亮推荐动作，并补充最小提示文案。
- 补充 helper / 卡片渲染测试，覆盖推荐动作映射与按钮联动。

## 本轮不做的事

- 不改 manual review resolve API。
- 不自动触发任何处置动作。
- 不引入新的 issueType / 状态机分支。

## 背景与问题分析

- Round 5 已经把完整问题列表和建议动作写进详情区，但复核人员还需要再把提示翻译成按钮选择。
- 如果建议动作不能直接落到处置按钮层，这条链路仍然多了一次人为转换，离“1 分钟内定位 -> 决策”还差一步。

## 关键假设

- 当前 Phase 1 的 `SCRIPT_VALIDATION` 问题主路径仍以“建议优先重生台本”为主。
- 推荐动作先做只读联动和视觉提示，不改变现有按钮语义，风险最低。

## 执行计划

1. 先写失败测试，锁定 `recommendedAction` 与按钮联动展示。
2. 用最小数据结构收敛脚本问题的建议动作配置，避免继续膨胀 `switch` 分支。
3. 跑回归、typecheck、build，补 handoff。

## 验收标准

- `SCRIPT_VALIDATION` 详情模型能输出推荐动作。
- 卡片按钮区能明确标出推荐动作。
- 新增测试通过，相关回归、typecheck、build 通过。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 推荐动作若写死在组件里，后续 subtype 增长时容易脆化，因此需要收敛到 helper / 配置层。
- 按钮视觉高亮必须保持轻量，不能破坏既有批量操作和按钮层级。

## 预期产物

- 代码：推荐动作模型、按钮联动、测试
- 文档：本轮 task / handoff
- 数据 / 验收记录：测试、typecheck、build 输出
