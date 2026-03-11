# Handoff 2026-03-10 Phase 1 Round 3

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 3
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 对应 task：docs/task/2026-03-10-phase-1-round-3-script-review-subtypes.md

## 本轮已完成内容

- 新增 `apps/web/src/lib/script-validation-review.ts`，统一维护 `SCRIPT_VALIDATION` 子类型映射与中文标签。
- 新增 `scriptSubtype` 查询/返回链路：
  - `manual-review-service` 支持 `scriptSubtype` 参数解析与 JSON path 过滤。
  - `formatManualReviewItem` 为 `SCRIPT_VALIDATION` 项透出 `issueSubtype`。
- `script-generation-runner` 在 script failure manual review item 的 `issueDetail` 中持久化 `scriptSubtype`。
- review 工作台新增脚本问题子类型筛选器，并在队列卡片上展示：
  - 顶层 `台本校验` 标签
  - 子类型 badge
  - 主失败摘要与原文预览兜底展示
- CSV 导出新增 `issueSubtype` 列。
- 补充两组新增测试：
  - `apps/web/src/lib/__tests__/script-validation-review.test.ts`
  - `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`
- 扩展既有 runner 测试，防止 `scriptSubtype` 回归丢失。

## 变更清单

- 新增：
  - `apps/web/src/lib/script-validation-review.ts`
  - `apps/web/src/lib/__tests__/script-validation-review.test.ts`
  - `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`
  - `docs/plans/2026-03-10-script-validation-review-subtypes-design.md`
  - `docs/plans/2026-03-10-script-validation-review-subtypes.md`
  - `docs/task/2026-03-10-phase-1-round-3-script-review-subtypes.md`
  - `docs/handoff/2026-03-10-phase-1-round-3-script-review-subtypes.md`
- 修改：
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/lib/script-generation-runner.ts`
  - `apps/web/src/lib/__tests__/script-generation-runner.test.ts`
  - `apps/web/src/app/books/[id]/review/models/types.ts`
  - `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
  - `apps/web/src/app/books/[id]/review/page.tsx`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-generator.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 结果：新增测试通过，相关回归测试通过，typecheck 通过，build 通过。
- 备注：现有测试中保留 `console.warn` / `console.error` 用于暴露脚本校验失败上下文；`baseline-browser-mapping` 版本提示仍为非阻塞告警。

## 结果与结论

- `SCRIPT_VALIDATION` 终于不再只是一个粗粒度桶，复核工作台已经能直接分辨主要脚本问题类型。
- 复核人员现在可以在不改数据库主分类语义的情况下，对脚本问题做更快的聚合筛选和导出分析。
- 这为后续把 script failure 接到 metrics / workbench 深化视图提供了稳定落点。

## 遗留问题

- 历史 `SCRIPT_VALIDATION` 数据如果没有显式写入 `issueDetail.scriptSubtype`，列表响应会动态推导，但服务端筛选仍优先依赖新字段。
- 当前卡片只展示主子类型和首条摘要，尚未把全部 `issueCodes/issuePreviews` 做成展开式详情视图。

## 风险判断

- 若线上历史数据很多且用户强依赖子类型筛选，可能需要补一轮历史数据回填脚本。
- 当前子类型仍是单一主因归类；对于多问题复合失败，统计维度仍会有一定压缩损失。

## 下一轮建议目标

- 在 review workbench 增加 `SCRIPT_VALIDATION` 详情展开区，展示全部 issue codes、issue previews 与失败上下文。
- 把 `scriptSubtype` 接入 metrics / dispatch 维度，形成覆盖率不足、边界漂移等问题的长期分布视图。
- 用真实书籍样本验证 `scriptSubtype` 分布是否符合人工主观判断，必要时调整映射优先级。
