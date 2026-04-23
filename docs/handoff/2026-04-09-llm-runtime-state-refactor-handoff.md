# 2026-04-09 LLM Runtime State Refactor Handoff

## 本轮完成内容

本轮围绕 `docs/plans/2026-04-09-llm-runtime-state-refactor-design.md` 与
`docs/plans/2026-04-09-llm-runtime-state-refactor.md` 已完成以下收口：

1. 建立最小 `WorkflowRuntimeState` 状态模型
2. 校对并复用现有 `character-memory` 核心能力
3. 新增结构化 prompt 裁剪 helper，默认不再把 JSON 变量直接截成坏字符串
4. `segment_scripting` 改为使用 `buildAgentContext()` 产出的 relevance-aware summary
5. `segment_repair` 改为使用统一 summary 来源
6. `quality_judgement` 改为使用统一 summary 来源
7. `finalizeSegment()` 成功返回值改为返回真正 canonicalized 后的 draft
8. `runCharacterDiscoveryPass()` 在 persist 失败时显式返回 `failure`
9. `gender` 契约收口为共享枚举，并兼容中文输入归一化

## 已修复的 review findings

### Finding 1

`run-character-discovery-pass.ts` 中 persist 失败被静默吞掉的问题已修复。

### Finding 2

`finalize-segment.ts` 成功返回值里的 draft 与质检/落库对象不一致的问题已修复。

### Finding 3

`segment_scripting`、`segment_repair`、`quality_judgement` 现已统一使用 relevance-aware 的角色摘要来源。

### Finding 4

`prompt-budget.ts` 默认会把结构化 JSON 变量裁剪成可解析结果，不再直接 `slice()`。

### Finding 5

角色抽取 prompt 与持久化端的 `gender` 契约已对齐为共享枚举。

## 关键改动文件

### 新增

- `apps/web/src/lib/agent-runtime/runtime/script-production/runtime-state.ts`
- `apps/web/src/lib/agent-runtime/runtime/prompt-context.ts`
- `apps/web/src/lib/agent-runtime/runtime/contracts/character-discovery.ts`
- `apps/web/src/lib/agent-runtime/__tests__/runtime-state.test.ts`

### 修改

- `apps/web/src/lib/agent-runtime/runtime/prompt-budget.ts`
- `apps/web/src/lib/agent-runtime/context/build-context.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair-stage.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/storage/character-utils.ts`
- `skills/character-extraction/prompts/system.md`
- `skills/character-extraction/prompts/user.md`

## 新增或扩展的测试

- `apps/web/src/lib/agent-runtime/__tests__/prompt-budget.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/finalize-segment.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

## 本轮验证

已通过的关键回归命令：

```bash
pnpm --filter web test -- --runInBand \
  src/lib/agent-runtime/__tests__/runtime-state.test.ts \
  src/lib/agent-runtime/__tests__/character-memory-store.test.ts \
  src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts \
  src/lib/agent-runtime/__tests__/prompt-budget.test.ts \
  src/lib/agent-runtime/__tests__/context-builder.test.ts \
  src/lib/agent-runtime/__tests__/prompt-template.test.ts \
  src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts \
  src/lib/agent-runtime/__tests__/repair-stage.test.ts \
  src/lib/agent-runtime/__tests__/quality-stage.test.ts \
  src/lib/agent-runtime/__tests__/finalize-segment.test.ts \
  src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts \
  src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts \
  src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
```

结果：

- 12 个 test suites 通过
- 118 个 tests 通过

## 当前计划状态

### 已完成

- Task 1
- Task 2
- Task 3
- Task 4
- Task 5 的关键 correctness 与 quality 接入
- Task 6
- Task 7

### 待完成

- Task 8：端到端收尾、兼容分支清理、必要的最终交付整理

## 下一步建议

1. 复核是否还需要把 `WorkflowRuntimeState` 真正接入 workflow 主调度对象，而不仅是建立最小模型
2. 盘点是否仍有绕过统一 state 的旧字段传递路径
3. 做最后一轮 cleanup：
   - 删除多余兼容逻辑
   - 复核未使用 helper
   - 视需要补一份最终 closeout 文档
