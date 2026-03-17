# Handoff 2026-03-12 Phase 1 Round 6

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 6
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 对应 task：docs/task/2026-03-12-phase-1-round-6-script-review-action-recommendation.md

## 本轮已完成内容

- 将脚本失败详情模型从“建议动作文本”升级为“建议动作文本 + 推荐处置动作”，新增 `recommendedAction` 与 `recommendedActionLabel`。
- 把原先逐渐膨胀的 `switch` 收敛为配置化 guidance 映射，统一管理 `scriptSubtype -> actionHints / recommendedAction`。
- `ReviewQueueList` 的按钮区新增轻量联动：当存在推荐动作时，卡片会显示 `推荐动作：...`，并把对应按钮标成 `（推荐）`。
- 保持现有 resolve API 与按钮语义不变，只做可视化推荐，不自动执行处置。
- 扩展脚本失败 helper 测试与卡片渲染测试，覆盖推荐动作字段与按钮联动展示。

## 变更清单

- 代码变更：
  - `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
  - `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
  - `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- 配置变更：无
- 数据变更：无
- 运行时操作：无

## 已执行验证

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：新增测试通过，相关 manual review / script subtype 回归通过，typecheck 通过，build 通过。
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 仍有版本过旧告警，但不影响本轮验证通过。

## 结果与结论

- 这轮把“建议动作”从说明文字真正推进到了操作层，复核者现在能更快把脚本失败映射到具体按钮。
- 通过配置化 guidance，后续若要继续扩展 subtype 规则，不必再堆更多分支判断。

## 遗留问题

- 当前推荐动作几乎都落在 `重生`，还没有引入更细粒度的 `approve / reject` 推荐策略。
- 推荐动作仍只存在于当前卡片视图，尚未同步到导出、metrics 或批量操作区。
- 详情区里的 `issue previews` / `segment preview` 标题仍未统一中文化。

## 风险判断

- 若未来 subtype 与推荐动作不再一一稳定对应，当前 guidance 配置需要进一步拆出优先级或条件表达能力。
- 当前只高亮单条卡片按钮，批量处理区尚无“按推荐动作批量执行”的护栏。

## 下一轮建议目标

- 把详情区剩余英文标题中文化，并统一 review workbench 文案。
- 将 `recommendedAction` 接到导出或 metrics，观察真实书籍样本中的脚本失败处置分布。
- 若真实数据证明有稳定模式，再考虑把 `approve / reject` 也做成有证据的推荐策略。
