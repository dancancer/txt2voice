# Handoff 2026-03-10 Phase 1 Round 2

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 2
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 对应 task：docs/task/2026-03-10-phase-1-round-2-script-failure-routing.md

## 本轮已完成内容

- 为段落级失败新增结构化明细模型 `SegmentFailureDetail`，覆盖失败阶段、错误码、覆盖率、问题码、问题描述、问题预览、段落定位与内容预览。
- 在 script workflow 中把段落失败从“仅 segmentId”升级为“segmentId + failure detail”并写入 summary。
- 在 segment processor 中对 Script Validator 失败、超长句失败、LLM 解析失败补齐结构化错误 details。
- 在 script runner 的部分失败路径中：
  - 将失败详情写入 `processing_tasks.taskData.metadata.failedSegmentDetails`（含截断控制）。
  - 自动同步 `manual_review_items`（`issueType=SCRIPT_VALIDATION`），并基于 `bookId + segmentId + issueType + status in (pending,reprocessing)` 去重更新。
- 部分失败时，书籍状态由 `processed` 调整为 `manual_review_pending`（若确有 pending 复核项），并在 metadata 中记录复核入队统计。
- 放开 `manual_review_pending` 状态下的台本重跑入口。
- 新增 workflow/runner 两组单测，覆盖失败详情透传与 manual review 去重入队。

## 变更清单

- 代码变更：
  - `apps/web/src/lib/script-generator/types.ts`
  - `apps/web/src/lib/script-generator/pipeline/summary.ts`
  - `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
  - `apps/web/src/lib/script-generator/pipeline/workflow.ts`
  - `apps/web/src/lib/script-generation-runner.ts`
  - `apps/web/src/app/api/books/[id]/script/generate/route.ts`
- 测试新增：
  - `apps/web/src/lib/__tests__/script-workflow.test.ts`
  - `apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- 文档新增：
  - `docs/task/2026-03-10-phase-1-round-2-script-failure-routing.md`
  - `docs/handoff/2026-03-10-phase-1-round-2-script-failure-routing.md`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-generator.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 结果：新增测试通过，Phase 1 相关回归测试通过，typecheck 通过，build 通过。
- 备注：测试日志中保留了 workflow 对段落失败的 `console.error` 与 validator 的 `console.warn`，用于暴露失败上下文，属预期输出。

## 结果与结论

- 台本阶段失败从“黑盒失败”变为“可结构化审计失败”。
- 失败段现在会自动进入人工复核队列，且重复执行不会无限堆积重复 pending 项。
- 任务层与书籍层状态语义更贴近“需要人工介入”的真实情况。

## 遗留问题

- 当前仅把失败段送入复核队列，尚未把这些 detail 映射为 review 工作台更友好的字段分组（例如主问题类型、建议动作模板）。
- Script failure 的 issueType 目前统一为 `SCRIPT_VALIDATION`，后续可细分为覆盖率/重复抽取/边界漂移子类，以提升统计与筛选价值。

## 风险判断

- 如果上层流程对 `manual_review_pending` 的状态语义假设不足，可能需要在 auto-pipeline 里补一层兼容逻辑。
- 如果真实书籍的失败段很多，`taskData.metadata` 仍有体积压力；当前已加入截断控制，但建议后续改为“详情表 + taskData 摘要”。

## 下一轮建议目标

- 在 review 工作台聚合展示 script failure detail（原文片段、失败类型、校验码、建议动作）。
- 增加 Script failure metrics（失败类型分布、覆盖率分布、复跑收敛率）并接入阶段回顾模板。
- 为 `SCRIPT_VALIDATION` 引入子类型映射，减少人工筛选成本。
