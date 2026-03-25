# Subagent Runtime Session Handoff

## 基本信息

- 日期：2026-03-24
- 阶段：Subagent Runtime 重构
- 分支：`codex/subagent-runtime`
- 当前工作目录：`/Users/xupeng/mycode/txt2voice`
- 对应设计文档：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
- 对应实施计划：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`
- 说明：
  - 旧的 `.worktrees/subagent-runtime` 已移除，后续都直接在仓库根目录继续迭代。

## 历史基线

- Task 1 到 Task 12 已在前序提交中完成：
  - protocol / schema / registry / context / tools / workflow skeleton / llm adapter
  - character discovery / segment scripting / repair / quality
- Task 13 在早前提交中已完成基础实现：
  - commit: `6e39346`
- 旧阻断已在前序提交中处理：
  - `98c49c6`：恢复 agent-runtime `typecheck`
  - `b835ecd`：收窄 `CharacterMemory -> Candidate` 类型
- 本 handoff 的旧版本已在前序提交中落库：
  - `cd823f5`
  - `d307573`

## 本轮新增进展

### Task 13：persist 阶段已闭环

- 已修复 persist 真实语义中的三个核心问题：
  - `character-memory-draft` 固定先于 `segment-script-draft` 提交，消除输入顺序对结果的污染
  - `SegmentScriptDraft -> ScriptSentence` 路径不再偷偷创建新的 `CharacterProfile`
  - `upsertCharacterCandidates` 在 fresh replay 时会先查库回填 `CharacterProfile + CharacterAlias`，避免 alias 漂移成新角色
- 规格审查结论：
  - 已通过
- 当前实现边界：
  - `CharacterMemory -> CharacterProfile`
  - `SegmentScriptDraft -> ScriptSentence`
  - replay/fresh run 下 canonical 解析不再依赖复用同一批 in-memory profile 引用

### Task 14：runtime bridge 已闭环

- 已新增：
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- 已完成：
  - `script-generation-runner.ts` 不再直接调用 `getScriptGenerator()` 分发 full / partial / regenerate
  - `runScriptProductionWorkflow()` 现在显式串起：
    - `segment_scripting`
    - deterministic validation
    - `segment_repair`
    - `quality`
    - `persist`
  - full / partial / regenerate 继续复用旧 `workflow.ts` 的选段语义
  - `format_repair` 已能拿到结构化 `failedArtifact`，包含 `rawResponse / provider / model`
  - runner 后半段的 task progress、manual review sync、book/task 状态回写逻辑保持不变

### Task 15：runtime replay / summary / metadata 聚合已完成

- 已新增：
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- 已完成：
  - 默认生产路径会写入：
    - `WorkflowRun`
    - `StageRun`
    - `TraceEvent`
    - `AgentRun`
    - `ToolCall`
  - `WorkflowRun.summary` 已聚合：
    - `mode`
    - `selectedSegmentIds`
    - `totalSegments`
    - `processedSegments`
    - `failedSegments`
    - `failedSegmentIds`
    - `persistedSentenceCount`
    - `persistedCharacterCount`
    - `formatRepairCount`
    - `semanticRetryCount`
    - `manualReviewRequiredCount`
    - `qualityRejectedCount`
    - `startedAt`
    - `completedAt`
    - `durationMs`
    - `segmentOutcomeIndex`
  - `runScriptProductionWorkflow()` 现在返回兼容旧 `GeneratedScript` 的同时，额外挂出 `runtimeMetadata`
  - `script-generation-runner.ts` 会把 runtime 摘要合并到：
    - `processingTask.taskData.metadata.agentRuntime`
    - `book.metadata` 中的轻量 pointer 字段
  - 已提供轻量 replay 读取面：
    - `loadWorkflowReplay(workflowRunId)`
  - 当前 replay 已支持：
    - `stageRuns`
    - `stageRuns.agentRuns`
    - `stageRuns.agentRuns.toolCalls`
    - `stageRuns.traceEvents`
    - `traceEvents`

### 文档已恢复并纳管

- 已恢复并加入仓库跟踪：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`

## 当前变更清单

### 代码改动

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-helpers.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

### 测试改动

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/persist-stage.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.task13.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.task13.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts`

### 文档改动

- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`
- `/Users/xupeng/mycode/txt2voice/docs/handoff/2026-03-24-subagent-runtime-session-handoff.md`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/persist-stage.test.ts`
  - 结果：PASS
- `pnpm --filter web test -- --runInBand src/lib/script-generator/storage/character-utils.task13.test.ts`
  - 结果：PASS
- `pnpm --filter web test -- --runInBand src/lib/script-generator/storage/persistence.task13.test.ts`
  - 结果：PASS
- `pnpm --filter web test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`
  - 结果：PASS
- `pnpm --filter web test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts src/lib/agent-runtime/__tests__/persist-stage.test.ts src/lib/script-generator/storage/character-utils.task13.test.ts src/lib/script-generator/storage/persistence.task13.test.ts`
  - 结果：4 suites / 15 tests 全绿
- `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/llm-adapter.test.ts src/lib/__tests__/script-generation-runner.test.ts`
  - 结果：5 suites / 38 tests 全绿
- `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
  - 结果：3 suites / 18 tests 全绿
- `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm run typecheck`
  - 结果：`EXIT_CODE=0`

## 审查结论

### Task 13

- 规格审查：通过
- 关键结论：
  - persist 顺序稳定
  - segment 路径不再越界创建业务角色
  - fresh replay 能从数据库恢复 canonical / alias 映射

### Task 14

- 规格审查：通过
- 关键结论：
  - thin seam 已提升为显式 stage bridge
  - full / partial / regenerate 选段语义未回退
  - `format_repair` 失败上下文已可透传
  - runner 后置状态语义未回退

### Task 15

- 规格审查：通过
- 代码质量审查：通过
- 关键结论：
  - 默认生产路径已写通 `WorkflowRun / StageRun / TraceEvent`
  - `AgentRun / ToolCall` 已接入 replay 链路
  - runtime summary 与 replay 读取面已具备最小可用闭环
  - runner metadata 已通过独立命名空间接入，未污染既有业务 summary / `reviewSync` / `llmMetrics`

## 结果与结论

- 当前分支的真实状态已经变成：
  - Task 13 已闭环
  - Task 14 已闭环
  - Task 15 已闭环
  - Task 16 已完成本轮 handoff 更新
- 当前可以安全声称的阶段成果是：
  - script production 主链路已经具备显式 stage bridge
  - runtime replay / summary / metadata 聚合已经写通到 agent/tool 级
  - workflow-level 生命周期与 adapter 透传已通过通用 `runWorkflow()` coordinator 模式收回 runtime
  - runner / book metadata 已能稳定挂接 workflow 运行指针

## 当前阻断 / 遗留风险

- `input_refinement` 现已覆盖两条主路径：
  - `semantic_retry` 用尽后进入切片重试
  - `format_repair` 返回 `refine` 后进入切片重试
- 当前仍有两层保守边界：
  - refinement 深度仍受限
  - 对纯 `LOW_COVERAGE` 这类宽口径失败，虽然现在会优先复用旧 validator 细码，但最终兜底切片仍保留通用句界启发式
- `AgentRun / ToolCall` 已接入当前 runtime 与 script-production replay
  - `ToolCall` 现在已经具备通用 runtime 能力，但当前落地覆盖仍以 script-production 的高价值 deterministic 动作为主
- `runWorkflow()` 已支持 coordinator/B-lite 模式
  - 当前已收回 workflow-level 生命周期
  - 段级循环、业务聚合和部分 stage 结果组装仍留在 `run-script-production-workflow.ts`

## 下一会话建议起手顺序

1. 决定是否进一步强化 input refinement
   - 方向：
     - 增加更深层 refinement 递归覆盖
     - 继续收紧纯 `LOW_COVERAGE` 场景下的通用句界兜底

2. 决定是否继续推进“完全去特化”
   - 方向：
     - 将段级循环与业务聚合进一步从 `run-script-production-workflow.ts` 下沉到通用 coordinator/segment executor
     - 缩薄 script-production bridge，减少手工 stage result 组装

3. 决定是否继续扩大 generic ToolCall 覆盖面
   - 方向：
     - 从当前 script-production 高价值 deterministic 动作，推广到更多 workflow/agent

## 新会话建议直接读取的文件

- `/Users/xupeng/mycode/txt2voice/docs/handoff/2026-03-24-subagent-runtime-session-handoff.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-helpers.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

## 分支建议

- 继续在当前仓库根目录与当前分支上推进：
  - `/Users/xupeng/mycode/txt2voice`
  - `codex/subagent-runtime`
- 暂时不建议再开新 worktree，除非要并行做 Task 15/16 或做独立实验分支
