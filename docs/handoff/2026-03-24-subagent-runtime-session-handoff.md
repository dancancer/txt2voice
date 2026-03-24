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

### Task 14：已完成入口 seam 切换

- 已新增：
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- 已完成：
  - `script-generation-runner.ts` 不再直接调用 `getScriptGenerator()` 分发 full / partial / regenerate
  - 三条入口统一经 `runScriptProductionWorkflow()` 进入一层 bridge
  - runner 后半段的 task progress、manual review sync、book/task 状态回写逻辑保持不变
- 当前 bridge 状态：
  - 这是一个 **thin seam**
  - 现在仍然只是统一入口，不是完整的 stage-based orchestrator
  - `segment_scripting -> validation -> repair -> quality -> persist` 还没有在 bridge 内部显式串起来

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

### 测试改动

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/persist-stage.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.task13.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.task13.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

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
- `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm run typecheck`
  - 结果：`EXIT_CODE=0`

## 审查结论

### Task 13

- 规格审查：通过
- 关键结论：
  - persist 顺序稳定
  - segment 路径不再越界创建业务角色
  - fresh replay 能从数据库恢复 canonical / alias 映射

### Task 14（当前窄规格）

- 规格审查：通过
- 当前通过范围仅包括：
  - 旧 runner 入口已统一切到 `runScriptProductionWorkflow()`
  - runner 后置状态语义未回退

## 结果与结论

- 当前分支的真实状态不是“Task 14 完成”，而是：
  - Task 13 已闭环
  - Task 14 已完成 **入口 seam 切换**
  - Task 14 的完整 runtime bridge 仍未完成
- 所以当前可以安全声称的阶段成果是：
  - persist 业务事实提交边界已经收紧
  - script generation 入口已经从硬编码 generator 调用中抽离
  - 下一步可以在不动 route / queue 契约的前提下，把 seam 往真正的 stage orchestrator 推进

## 当前阻断 / 遗留风险

- `runScriptProductionWorkflow()` 目前还是 thin wrapper
  - 还没有显式串联：
    - `segment_scripting`
    - deterministic validation
    - `segment_repair`
    - `quality`
    - `persist`
- `workflows/script-production/workflow.toml` 仍未更新到完整阶段集
  - 目前仍只有 `prepare / character_discovery / segment_scripting / segment_repair`
- 通用 `runWorkflow()` 仍未接入真实业务链路
  - 主要原因是当前 runtime stage API 还不负责 artifact 自动传递
- Task 15/16 还没开始：
  - replay / summary / metadata 聚合
  - 最终文档更新

## 下一会话建议起手顺序

1. 扩展 `runScriptProductionWorkflow()`，从 thin seam 推到真正的 stage bridge
   - 先闭环：
     - `segment_scripting`
     - deterministic validation
     - `segment_repair`
     - `quality`
     - `persist`

2. 决定是否最小导出旧 workflow helper
   - 候选：
     - `loadBookForGeneration`
     - `resolvePartialSegments`
   - 目标：
     - 避免在新 bridge 里复制 full / partial / regenerate 的段落选择逻辑

3. 等 bridge 真正落地后，再更新 `workflows/script-production/workflow.toml`
   - 让 definition 与真实 runtime 阶段一致

4. 再做 Task 15 / Task 16
   - replay / summary / metadata 聚合
   - 最终设计/计划/handoff 清理

## 新会话建议直接读取的文件

- `/Users/xupeng/mycode/txt2voice/docs/handoff/2026-03-24-subagent-runtime-session-handoff.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

## 分支建议

- 继续在当前仓库根目录与当前分支上推进：
  - `/Users/xupeng/mycode/txt2voice`
  - `codex/subagent-runtime`
- 暂时不建议再开新 worktree，除非要并行做 Task 15/16 或做独立实验分支
