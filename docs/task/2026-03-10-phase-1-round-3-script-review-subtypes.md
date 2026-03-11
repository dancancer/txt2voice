# Task Round 2026-03-10 Phase 1 Round 3

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 3
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 负责人：Codex

## 本轮目标

- 在不拆顶层 `issueType=SCRIPT_VALIDATION` 的前提下，把脚本问题子类型接入人工复核工作台，支持展示、筛选与导出。

## 本轮范围

- 新增脚本问题子类型纯函数映射，统一从 `issueDetail.errorCode/issueCodes` 归类主子类型。
- `manual-review-service` 支持 `scriptSubtype` 查询参数、JSON path 过滤、响应字段透传。
- `script-generation-runner` 在创建/更新 `manual_review_items` 时写入 `issueDetail.scriptSubtype`。
- review 工作台增加脚本问题子类型筛选器、子类型 badge 与失败摘要展示。
- CSV 导出增加 `issueSubtype` 列。
- 补充对应单测并做 Phase 1 回归验证。

## 本轮不做的事

- 不改数据库顶层 `issueType` 结构。
- 不改人工复核处置动作语义。
- 不引入新的 metrics 表或独立 Script QC 统计任务。

## 背景与问题分析

- `SCRIPT_VALIDATION` 已经入队，但复核页只能按顶层 issueType 过滤，无法快速区分覆盖率不足、对白/旁白冲突、边界漂移等常见脚本错误。
- 若直接把顶层 `issueType` 拆细，会影响现有 summary、筛选、统计与状态机，改动面不必要地扩大。

## 关键假设

- 将主子类型作为 `issueDetail.scriptSubtype` 的轻量派生字段写入，足以支撑 workbench 筛选和后续统计。
- 历史数据允许在服务端响应时动态回退推导；筛选优先命中新写入字段。

## 执行计划

1. 新增 `script-validation-review` 纯函数与测试。
2. 扩展 `manual-review-service` 的 query/filter/formatting。
3. 扩展 `script-generation-runner` 写入 `scriptSubtype`。
4. 接入 review workbench 的筛选和卡片展示。
5. 运行相关测试、typecheck 与 build。

## 验收标准

- `SCRIPT_VALIDATION` 项在 review 工作台中显示中文子类型标签。
- review/items API 支持按 `scriptSubtype` 过滤。
- 新创建的 script failure manual review item 持久化 `issueDetail.scriptSubtype`。
- 导出的 CSV 保留 `issueSubtype`。

## 本轮代码质检计划

- `pnpm --filter web test -- --runInBand src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-generator.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 风险与回滚点

- 旧数据若未写入 `scriptSubtype`，筛选会优先依赖新字段；必要时可回滚为“仅展示不筛选”。
- JSON path 过滤依赖 PostgreSQL Json filter；若部署环境行为异常，可退回客户端筛选。

## 预期产物

- 代码：子类型 helper、manual review filter、runner 写入、review workbench 展示
- 测试：helper/service/runner 单测与 Phase 1 回归
- 文档：本 task 文档、对应 handoff 文档、设计/实现计划文档
