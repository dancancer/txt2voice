# Handoff 2026-03-13 Phase 1 Round 10

## 基本信息

- 日期：2026-03-13
- 轮次：Phase 1 / Round 10
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 对应 task：docs/task/2026-03-13-phase-1-round-10-failed-segment-refinement.md

## 本轮已完成内容

- 新增 `apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`，把 `SCRIPT_VALIDATION` 失败段的细分规则从主流程中抽离出来。
- 新增纯 helper：
  - `shouldRefineSegmentFailure()`
  - `refineFailedSegment()`
- `processSegmentAndSave()` 现在会在命中 `TEXT_SOURCE_MISMATCH / NON_WHITESPACE_GAP / SOURCE_NOT_FOUND` 等边界漂移类错误时，对失败段做二次细分并递归重试。
- refinement 子段只在内存中存在，成功后统一映射回父段 `segmentId` / `orderInSegment` / `sourceStart` / `sourceEnd`，仍然只对父段落库一次。
- 新增两组测试：
  - `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`
  - `apps/web/src/lib/__tests__/segment-processor-refinement.test.ts`
- 设计文档与实现计划已补齐：
  - `docs/plans/2026-03-13-failed-segment-refinement-design.md`
  - `docs/plans/2026-03-13-failed-segment-refinement.md`

## 变更清单

- 代码变更：
  - `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
  - `apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`
  - `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`
  - `apps/web/src/lib/__tests__/segment-processor-refinement.test.ts`
- 文档变更：
  - `docs/plans/2026-03-13-failed-segment-refinement-design.md`
  - `docs/plans/2026-03-13-failed-segment-refinement.md`
  - `docs/task/2026-03-13-phase-1-round-10-failed-segment-refinement.md`
  - `docs/handoff/2026-03-13-phase-1-round-10-failed-segment-refinement.md`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：refinement helper / processor 回归通过，相关 script workflow / runner / manual review 回归通过，typecheck 通过，build 通过。
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 版本过旧提示仍为非阻塞告警。

## 结果与结论

- 这轮把“高风险失败段只能人工复核”推进成了“失败段先尝试更细粒度重跑，再决定是否进入人工复核”。
- 当前实现已经保证 refinement 不会把 synthetic segment id 泄漏进数据库，也不会改变原有 validator 语义。

## 遗留问题

- 真实样本 closeout 验证仍在跑，尚未正式写回 `docs/review/2026-03-12-phase-1-closeout.md`，因此还不能确认 `failed segments` 是否已从 7 显著下降。
- 某些复杂失败段（尤其带动作语、嵌套对白、长句连续切换）即使 refinement 后仍可能继续失败，需要结合真实样本再调切分策略。
- 当前 refinement 只针对脚本边界漂移类错误，不处理 `LOW_COVERAGE` 以外的其他根因。

## 风险判断

- refinement 会增加失败段的 LLM 调用次数，真实样本运行耗时会变长，需要观察 closeout 样本的运行成本。
- 如果 refinement 后仍大量命中 `TEXT_SOURCE_MISMATCH`，说明问题可能不只是段粒度，而是 validator 与 prompt 对“动作语+对白”这类结构的契约仍有缝。

## 下一轮建议目标

- 用 `uploads/sample.txt(limitToSegments=10)` 完成一次正式的 refinement 后真实样本回归，并写回 closeout review。
- 若 `failed segments` 未显著下降，优先分析哪一类失败段仍未被当前 splitter 命中，再决定是否增强 quote/attribution 切分规则。
