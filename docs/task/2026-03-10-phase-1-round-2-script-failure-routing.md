# Task Round 2026-03-10 Phase 1 Round 2

## 基本信息

- 日期：2026-03-10
- 轮次：Phase 1 / Round 2
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-failure-routing
- 负责人：Codex

## 本轮目标

- 把段落级 Script Validator 的失败结果沉淀为结构化数据，并在任务失败时自动投递到人工复核队列，形成“失败可定位、可追踪、可处置”的闭环。

## 本轮范围

- 为台本生成流程补充段落失败结构化明细（失败阶段、错误码、覆盖率、问题码、问题预览、段落定位信息）。
- 在 `runScriptGenerationTask` 的部分失败路径中：
  - 将结构化失败详情写入 `processing_tasks.taskData.metadata`。
  - 将失败段落同步为 `manual_review_items`（`issueType=SCRIPT_VALIDATION`），避免沉默失败。
- 失败时把书籍状态更新为 `manual_review_pending`，并允许该状态继续触发台本重跑。
- 补充对应单测，覆盖失败明细传递和复核项落库。

## 本轮不做的事

- 不改动 TTS provider 并发策略和音频补跑逻辑。
- 不改动 review 页面 UI 交互。
- 不引入新的独立 Script QC 任务类型。

## 背景与问题分析

- 当前失败段只汇总为 `failedSegmentIds`，缺少可用于排查和复核处置的上下文。
- 失败不会自动进入 `manual_review_items`，导致“知道失败但无法在复核工作台直接处理”。
- `book.status` 在部分失败后回落为 `processed`，无法体现“当前需要人工介入”的状态语义。

## 关键假设

- 结构化失败明细直接在现有 `taskData.metadata` 和 `manual_review_items.issueDetail` 落地即可支撑下一轮复核工作台能力，不需要新增表结构。
- 以 `bookId + segmentId + issueType + status in (pending,reprocessing)` 做去重，足以避免复跑造成复核队列爆炸。

## 执行计划

1. 扩展 script workflow 汇总模型，传递 `failedSegmentDetails`。
2. 在 segment 处理路径补充标准化失败细节构造。
3. 在 script runner 失败分支写入任务 metadata 并同步 manual review item。
4. 放开 `manual_review_pending` 状态下的台本重跑入口。
5. 增加 runner/workflow 单测验证。

## 验收标准

- 部分失败任务在 `taskData.metadata` 中可读到结构化失败段详情。
- 失败段会自动出现在 `manual_review_items`，重复运行不会无限新增重复 pending 项。
- 书籍进入 `manual_review_pending` 后仍可重新触发台本生成任务。

## 本轮代码质检计划

- 工具：Jest、TypeScript typecheck
- 计划命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-workflow.test.ts`
  - `pnpm --filter web typecheck`
- 通过标准：新增测试通过，typecheck 通过

## 风险与回滚点

- 若人工复核项入队逻辑与现有复核流程冲突，可回滚到“仅写入 task metadata，不自动建复核项”。
- 若 `manual_review_pending` 影响现有用户流程，可将书籍状态恢复为 `processed`，仅保留复核项与任务明细。

## 预期产物

- 代码：workflow 失败明细、runner 复核入队、状态放开、单测
- 文档：本 task 文档、对应 handoff 文档
- 验收记录：测试命令执行结果
