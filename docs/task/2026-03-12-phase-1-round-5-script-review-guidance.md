# Task Round 2026-03-12 Phase 1 Round 5

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 5
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 把 `SCRIPT_VALIDATION` 复核详情从“可查看失败上下文”推进到“可直接判断下一步动作”，让复核人员能在卡片内看到完整问题列表与返工建议。

## 本轮范围

- 扩展脚本失败详情 helper，补齐 `issueMessages` 与建议动作展示模型。
- 在 review 队列卡片详情区展示完整问题列表与按子类型归纳的返工建议。
- 为 helper / 卡片渲染补充回归测试。

## 本轮不做的事

- 不修改 manual review resolve API 语义。
- 不新增新的任务状态或 issueType。
- 不接入 metrics / dispatch 统计。

## 背景与问题分析

- 上一轮已经能展开 `SCRIPT_VALIDATION` 的失败详情，但复核人员仍然只能看到首条摘要与若干 preview。
- 如果不能在卡片里看到完整问题列表与“下一步该怎么做”，人工复核仍然要自己推断返工路径，离真实作业台还差一层。

## 关键假设

- 现有 `issueDetail.issueMessages` 与 `scriptSubtype` 已足够支持第一版建议动作推导。
- 建议动作先做只读提示，不直接改变现有按钮行为，可以降低回归风险。

## 执行计划

1. 先写失败测试，锁定 helper 输出与卡片渲染的目标行为。
2. 用最小改动扩展详情 helper，并把问题列表 / 建议动作接到 review 卡片。
3. 跑受影响测试、typecheck 与 build，更新 handoff。

## 验收标准

- `SCRIPT_VALIDATION` 详情区可展示完整 `issueMessages` 列表。
- 详情区可展示与 `scriptSubtype` 对应的建议返工动作。
- 新增测试通过，相关回归、typecheck、build 通过。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 建议动作依赖 `scriptSubtype` 质量；历史数据缺字段时需要优雅降级。
- 卡片详情信息密度提升后，必须避免把已有批量操作与 resolve 按钮挤坏。

## 预期产物

- 代码：脚本失败详情 helper、review 卡片、对应测试
- 文档：本轮 task / handoff
- 数据 / 验收记录：本轮测试、typecheck、build 输出
