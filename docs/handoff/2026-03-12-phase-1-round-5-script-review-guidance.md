# Handoff 2026-03-12 Phase 1 Round 5

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Round 5
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 对应 task：docs/task/2026-03-12-phase-1-round-5-script-review-guidance.md

## 本轮已完成内容

- 扩展 `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`，让 `SCRIPT_VALIDATION` 详情模型除了摘要/issue codes/previews 之外，还能输出建议返工动作。
- 为不同 `scriptSubtype` 增加第一版建议动作映射，覆盖覆盖率不足、原文切片缺失、对白/旁白冲突、重复抽取、超长台词、LLM 解析失败等主路径问题。
- `ReviewQueueList` 详情区新增“完整问题列表”和“建议动作”两块，让复核人员不用只看首条摘要就猜下一步。
- 新增 `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`，验证脚本失败卡片会把完整问题列表与建议动作渲染出来。
- 扩展 `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`，覆盖建议动作映射与兜底策略。

## 变更清单

- 代码变更：
  - `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
  - `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
  - `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- 配置变更：无
- 数据变更：无
- 运行时操作：在隔离 worktree 中执行 `pnpm install --frozen-lockfile`

## 已执行验证

- `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：新增卡片测试与 helper 测试通过，manual review / script subtype 相关回归通过，typecheck 通过，build 通过。
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 版本过旧提示仍然存在，但本轮为非阻塞告警。

## 结果与结论

- `SCRIPT_VALIDATION` 复核卡片从“能看到失败上下文”进一步推进到“能直接判断返工方向”。
- 复核人员现在可以在同一张卡片里看到完整问题列表、原文预览与建议动作，离 roadmap 里要求的“真实作业台”又近了一步。

## 遗留问题

- 当前建议动作仍是只读提示，还没有和“通过 / 驳回 / 重生”按钮形成更细粒度的推荐动作联动。
- 详情区里的 `issue codes` / `issue previews` / `segment preview` 仍保留英文标题，后续可统一中文化。
- 历史数据若没有 `scriptSubtype`，仍需要依赖动态推导；若线上样本量大，可考虑补回填脚本。

## 风险判断

- 建议动作映射当前基于主 subtype，复合型脚本失败仍会有信息压缩。
- 详情区信息密度继续上升，后续如果再加更多字段，可能需要重新整理视觉层级。

## 下一轮建议目标

- 把建议动作与现有 resolve 按钮做轻量联动，例如默认高亮推荐动作。
- 统一详情区文案为中文，并把 `scriptSubtype` / 建议动作接入导出与 metrics。
- 用真实书籍样本走一轮人工复核，验证建议动作是否能缩短定位与决策时间。
