# Handoff 2026-03-12 Phase 1 Round 7

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 7
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 对应 task：docs/task/2026-03-12-phase-1-round-7-review-export-alignment.md

## 本轮已完成内容

- 新增 `apps/web/src/lib/script-validation-detail.ts`，把 `SCRIPT_VALIDATION` 的详情归一化逻辑正式下沉到共享层。
- `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts` 改为直接复用共享 helper，避免 app 侧和导出侧各写一套规则。
- `ReviewQueueList` 详情区剩余英文标题已中文化：`问题代码`、`问题原文预览`、`段落原文预览`。
- `toManualReviewCsv()` 已补齐脚本失败导出列：`issueSubtypeLabel`、`recommendedAction`、`scriptSummary`、`scriptIssueMessages`。
- CSV 的脚本子类型标签、推荐动作和摘要，现已直接复用共享 helper，和 review 卡片保持同源。
- 新增 / 扩展测试覆盖：
  - Review 卡片中文标题与推荐动作渲染
  - CSV 导出新列与脚本失败字段
  - 共享 helper 仍保持既有 detail 语义
- 设计文档与实现计划已补齐：
  - `docs/plans/2026-03-12-review-export-alignment-design.md`
  - `docs/plans/2026-03-12-review-export-alignment.md`

## 变更清单

- 代码变更：
  - `apps/web/src/lib/script-validation-detail.ts`
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`
  - `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`
  - `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
  - `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- 配置变更：无
- 数据变更：无
- 运行时操作：无

## 已执行验证

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx src/lib/__tests__/manual-review-service.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：targeted tests 通过，manual review / script subtype 相关回归通过，typecheck 通过，build 通过。
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 版本过旧提示仍然存在，但不影响本轮验证通过。

## 结果与结论

- review workbench 与 CSV 导出现在终于开始说同一种语言：同一个脚本失败，在页面上看到什么，导出时也能带走什么。
- 共享 helper 消掉了 UI 规则和导出规则分叉的坏味道，为后续把 `recommendedAction` 接到 metrics 留下了干净落点。

## 遗留问题

- CSV 目前导出的 `scriptIssueMessages` 使用 ` | ` 平铺，足够实用，但还没有更结构化的导出格式。
- `recommendedAction` 仍主要是 `重生`，还没有形成稳定的 `通过 / 驳回` 推荐策略。
- 当前只是补齐导出，没有把推荐动作带到筛选器、统计面板或批量操作区。

## 风险判断

- 如果外部脚本按固定列序解析旧 CSV，本轮新增列后需要同步更新解析逻辑。
- 共享 helper 目前同时服务 UI 与导出，后续若继续扩字段，要守住“共享层只做领域归一化，不夹带页面行为”的边界。

## 下一轮建议目标

- 把 `recommendedAction` 与 `issueSubtypeLabel` 接到导出后的分析链路或 metrics，看真实样本分布。
- 若真实数据证明某些 subtype 可稳定推荐 `通过 / 驳回`，再逐步扩展推荐动作映射。
- 评估是否需要在 review filter bar 增加按推荐动作筛选，而不是先做批量自动化。
