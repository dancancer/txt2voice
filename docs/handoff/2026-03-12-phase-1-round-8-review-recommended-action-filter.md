# Handoff 2026-03-12 Phase 1 Round 8

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 8
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 对应 task：docs/task/2026-03-12-phase-1-round-8-review-recommended-action-filter.md

## 本轮已完成内容

- 扩展 `apps/web/src/lib/script-validation-detail.ts`，新增推荐动作选项、动作标签 helper 与 `recommendedAction -> subtype[]` 逆向映射 helper。
- `manual-review-service` 已支持 `recommendedAction` 查询参数：
  - list query / export query 都会解析该字段
  - 服务端把推荐动作翻译成 subtype OR 查询
  - `formatManualReviewItem()` 现会返回 `recommendedAction` 与 `recommendedActionLabel`
- review workbench 过滤条新增“推荐动作”下拉，且仅在 `issueType === SCRIPT_VALIDATION` 时显示。
- `buildReviewParams()` 已把 `recommendedAction` 带入列表查询与导出查询，保证页面、分页、导出过滤一致。
- 新增 `ReviewQueuePanel` 渲染测试，补齐推荐动作筛选 UI 的回归保护。

## 变更清单

- 代码变更：
  - `apps/web/src/lib/script-validation-detail.ts`
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`
  - `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`
  - `apps/web/src/app/books/[id]/review/models/types.ts`
  - `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
  - `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`
  - `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
  - `apps/web/src/app/books/[id]/review/page.tsx`
  - `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
- 配置变更：无
- 数据变更：无
- 运行时操作：无

## 已执行验证

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：推荐动作 helper / 服务端筛选 / 过滤条渲染测试通过，manual review / script subtype 相关回归通过，typecheck 通过，build 通过。
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 版本过旧提示仍存在，但不影响本轮验证通过。

## 结果与结论

- 推荐动作不再只是“看得到”的提示，而是已经成为可筛选、可导出的工作台维度。
- 通过共享 helper 的逆向映射，服务端查询不需要改数据库，也能保持 UI / 导出 / 分页语义一致。

## 遗留问题

- 当前推荐动作仍然强烈偏向 `regenerate`，`approve / reject` 维度短期内可能几乎没有结果。
- 服务端筛选依赖 `issueDetail.scriptSubtype`，对历史未回填数据的支持水平与现有 `scriptSubtype` 服务端筛选相同。
- 过滤条中的 Select 当前仍展示原始 value，而不是中文 label；如果后续想做更精致的交互，可以单独清理。

## 风险判断

- 如果未来推荐动作不再能稳定映射到 subtype，当前逆向映射 helper 需要升级为更复杂的规则层。
- 当前“推荐动作”筛选只作用于 `SCRIPT_VALIDATION`，这是有意收边界；若要推广到其他 issueType，必须先定义它们的推荐动作语义。

## 下一轮建议目标

- 把 `recommendedAction` 接到 metrics / 导出后的分析链路，观察真实书籍中的动作分布。
- 评估是否需要在过滤条里补充中文 label 展示，减少 `regenerate / approve / reject` 原始值暴露。
- 若真实样本显示可行，再考虑把推荐动作与批量处理或默认焦点联动，但先不要自动执行。
