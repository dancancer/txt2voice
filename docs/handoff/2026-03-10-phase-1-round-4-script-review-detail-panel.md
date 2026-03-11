# Handoff 2026-03-10 Phase 1 Round 4

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 4
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 对应 task：docs/task/2026-03-10-phase-1-round-4-script-review-detail-panel.md

## 本轮已完成内容

- 新增 `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`，把 `SCRIPT_VALIDATION` 的 `issueDetail` 统一解析为前端展示模型。
- 新增 helper 单测 `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`，覆盖摘要、去重 issue codes、覆盖率格式化与空 payload 兜底。
- `ReviewQueueList` 改为消费 helper，并为 `SCRIPT_VALIDATION` 卡片增加可展开详情区。
- 展开详情区当前展示：
  - `stage`
  - `errorCode`
  - `coverage`
  - `issueCodes`
  - `issuePreviews`
  - `segmentPreview`
- 保留现有子类型 badge 和主摘要展示，详情展开仅做增强，不改现有复核动作语义。

## 变更清单

- 新增：
  - `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`
  - `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
  - `docs/task/2026-03-10-phase-1-round-4-script-review-detail-panel.md`
  - `docs/handoff/2026-03-10-phase-1-round-4-script-review-detail-panel.md`
- 修改：
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`

## 已执行验证

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 结果：新增 helper 测试通过，manual review / script subtype 相关回归通过，typecheck 通过，build 通过。
- 备注：构建与测试中仍有 `baseline-browser-mapping` 版本过旧提示，属非阻塞告警。

## 结果与结论

- `SCRIPT_VALIDATION` 复核项现在不只知道“是哪一类问题”，还可以直接展开看到为什么被判成这个问题。
- 这让 review 工作台更接近“真实作业台”，复核者不必在数据库字段和 UI 之间来回猜测上下文。

## 遗留问题

- 当前详情区还未展示完整 `issueMessages` 列表，只展示主摘要与预览。
- 详情区尚未加入“建议动作”或“直接跳转返工”的上下文按钮。

## 风险判断

- 详情展示依赖 `issueDetail` 字段质量；若线上历史数据缺字段，UI 会优雅降级，但信息密度会下降。
- 当前使用原生 `<details>`，交互足够轻但样式控制有限；后续若要更复杂折叠行为，可再换成受控组件。

## 下一轮建议目标

- 在详情区加入 `issueMessages` 全量列表与建议返工动作提示。
- 把 `scriptSubtype` 与详情数据接入 metrics，形成可观测的脚本失败分布。
- 用真实书籍样本走一轮人工复核，确认详情信息是否足够支持 1 分钟内定位决策。
