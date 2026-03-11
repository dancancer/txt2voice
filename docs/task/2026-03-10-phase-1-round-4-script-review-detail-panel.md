# Task Round 2026-03-10 Phase 1 Round 4

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 4
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 负责人：Codex

## 本轮目标

- 为 `SCRIPT_VALIDATION` 复核项增加可展开的详情视图，让复核人员直接看到 issue codes、失败摘要、原文预览和失败上下文，而不是只看到一个子类型标签。

## 本轮范围

- 新增脚本失败详情解析 helper，统一把 `issueDetail` 转换为前端可展示结构。
- review 队列卡片为 `SCRIPT_VALIDATION` 项增加展开详情区域。
- 详情区域至少展示：主失败摘要、errorCode/stage、issueCodes、issuePreviews、segmentPreview、coverageRatio（若有）。
- 补充 helper 单测并做受影响链路回归。

## 本轮不做的事

- 不改 manual review resolve 动作。
- 不改 metrics / dispatch 统计。
- 不增加新的 API 路由。

## 背景与问题分析

- 当前 workbench 已经能按子类型筛选，但卡片只显示主摘要，不足以支持“定位 -> 判断 -> 决策返工”。
- 失败原因、问题码和原文预览都还埋在 `issueDetail` 中，人工复核时仍需猜测为什么它被归到这个子类型。

## 执行计划

1. 提取纯 helper 解析 `SCRIPT_VALIDATION` 展示模型。
2. 先补 helper 失败测试。
3. 在 review 队列卡片增加展开详情区域。
4. 跑 helper、manual review、Phase 1 相关测试与 build。

## 验收标准

- `SCRIPT_VALIDATION` 卡片可展开查看完整失败上下文。
- 详情内容至少包含主问题、问题码和原文预览。
- 新增 helper 测试通过，相关回归通过。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`
