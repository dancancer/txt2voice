# LLM Runtime State Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前 LLM 主链重构为围绕单一运行时状态、统一结构化上下文、共享 schema 契约和统一失败语义运行的稳定系统，彻底修复已识别的 5 类问题，并消除同类问题的再生机制。

**Architecture:** 先建立 `WorkflowRuntimeState` 与共享 memory / contract 核心，再把 prompt 上下文构建收口为统一结构化管道，随后让 scripting、repair、quality、persist 共用同一份 state，最后收紧失败传播与契约验证。整个实施严格采用串行门禁模式，任何步骤的产出物不达标或验证失败，禁止进入下一步。

**Tech Stack:** Next.js, TypeScript, Jest, Prisma, Mastra runtime bridge, agent-runtime protocol.

---

## 执行规则

1. 每一步只完成一个明确动作。
2. 每一步都必须有明确产出物。
3. 每一步都必须有明确验证方法。
4. 只有当前步骤验证通过，才允许进入下一步。
5. 每个 Task 完成后必须做任务级验证。
6. 若验证失败，先修当前步骤，禁止跳步。

## 全局门禁

### Step Gate

每个步骤必须同时满足以下条件：

1. 指定文件已创建或修改完成。
2. 指定验证命令执行通过，或者按预期失败。
3. 产出物与步骤目标一致。
4. 没有破坏上一步已经通过的验证。

### Task Gate

每个 Task 完成后必须执行该 Task 的“任务级验证”。任务级验证未通过，不得进入下一 Task。

## Task 1: 建立单一运行时状态模型

**目标产出物**

- 新增 `WorkflowRuntimeState`
- 提供最小状态初始化与更新 helper
- 明确当前 segment、draft、validation、failed artifact 的唯一存放位置

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/runtime-state.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/shared-types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-state.test.ts`

### Step 1.1: 写失败测试，固定 runtime state 的基本形状

**产出物：**
- 新增 `runtime-state.test.ts`
- 覆盖：
  - 可以从 book/profile 初始化 state
  - current segment 更新不会污染 character memory
  - current draft、canonicalized draft、validationReport、failedArtifact 各有唯一位置

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-state.test.ts`
- Expected: FAIL，原因应为目标模块尚不存在或行为未实现

**通过标准：**
- 测试失败原因准确落在状态模型缺失，不是路径、语法或 fixture 错误

### Step 1.2: 实现 `runtime-state.ts` 最小闭环

**产出物：**
- `runtime-state.ts`
- 导出：
  - `createWorkflowRuntimeState()`
  - `setCurrentSegment()`
  - `setCurrentDraft()`
  - `setCanonicalizedDraft()`
  - `setValidationReport()`
  - `setFailedArtifact()`
  - `updateCharacterMemoryState()`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-state.test.ts`
- Expected: PASS

**通过标准：**
- 所有状态更新 helper 都是纯函数或最小可验证包装
- 没有引入 workflow 行为改动

### Step 1.3: 任务级验证

**产出物：**
- 可供 workflow/stage 接入的统一状态模块

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-state.test.ts`
- Expected: PASS

**任务通过标准：**
- state 模块存在且可被后续 Task 复用

---

## Task 2: 收敛 Character Memory 核心能力

**目标产出物**

- 统一 `CharacterMemorySnapshot`
- 统一 patch merge
- 统一 speaker canonicalization
- 统一角色摘要与角色归一化提示生成

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/merge.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/summary.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`

### Step 2.1: 写失败测试，固定 memory merge 语义

**产出物：**
- 扩展 `character-memory-store.test.ts`
- 覆盖：
  - bootstrap snapshot version = 1
  - patch 合并后 version 增长
  - alias evidence 不重复
  - remap 后 fact bucket 指向 canonical id

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在 merge/store 目标语义

### Step 2.2: 写失败测试，固定 canonicalization 语义

**产出物：**
- 扩展 `character-memory-canonicalize.test.ts`
- 覆盖：
  - direct match
  - alias match
  - unresolved speaker
  - alias conflict

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在 canonicalization 目标语义

### Step 2.3: 实现 memory 核心能力

**产出物：**
- 完整更新 `types.ts/store.ts/merge.ts/summary.ts/canonicalize.ts`
- `buildCharacterMemorySummary()` 与 `buildCharacterResolutionHints()` 统一围绕 snapshot 工作

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**通过标准：**
- snapshot/merge/summary/canonicalize 行为一致
- 后续 stage 不再需要自己解释角色语义

### Step 2.4: 任务级验证

**产出物：**
- 完整可复用的角色记忆核心模块

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**任务通过标准：**
- 角色记忆作为共享规则层可被后续 Task 直接依赖

---

## Task 3: 重构 Prompt Context Pipeline，禁止坏 JSON 进入 prompt

**目标产出物**

- 统一结构化 prompt context helper
- 统一预算裁剪策略
- `character_memory_summary` 等关键字段不再由调用方随意传裸字符串

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-context.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-budget.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-artifact-summary.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-budget.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-template.test.ts`

### Step 3.1: 写失败测试，固定结构化字段不会被截成坏 JSON

**产出物：**
- 扩展 `prompt-budget.test.ts`
- 覆盖：
  - `character_memory_summary` 裁剪后仍为可解析 JSON
  - `validation_report_json`/`failed_artifact_json` 使用结构化摘要，而不是直接 `slice()`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-budget.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在默认裁剪逻辑与结构化字段处理缺失

### Step 3.2: 写失败测试，固定 relevance-aware summary 不能被全量摘要覆盖

**产出物：**
- 扩展 `context-builder.test.ts`
- 增加或扩展测试，验证当前段落相关角色优先保留

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Expected: FAIL 或已有测试失败在目标语义上

**通过标准：**
- 测试能钉住“统一上下文构建链路”的预期

### Step 3.3: 实现统一 prompt context helper

**产出物：**
- 新增 `prompt-context.ts`
- `build-context.ts` 输出结构化 reference/artifact 数据
- `prompt-budget.ts` 对结构化变量按策略裁剪，而不是默认坏截断

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-budget.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts src/lib/agent-runtime/__tests__/prompt-template.test.ts`
- Expected: PASS

**通过标准：**
- 关键 JSON 字段不会生成半截结构
- relevance-aware 摘要成为统一来源

### Step 3.4: 任务级验证

**产出物：**
- 可供所有 stage 共用的安全上下文构建管道

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-budget.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts src/lib/agent-runtime/__tests__/prompt-template.test.ts`
- Expected: PASS

**任务通过标准：**
- “坏 JSON 进入 prompt”这条问题链被切断

---

## Task 4: 把 scripting stage 切到单一 state + 统一 prompt context

**目标产出物**

- `segment_scripting` 直接消费统一 state 和 prompt context
- 不再绕过 relevance-aware summary
- stage 输出显式写回 state

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-single-segment-types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

### Step 4.1: 写失败测试，固定 scripting 只能走统一 summary 来源

**产出物：**
- 扩展 `segment-scripting-stage.test.ts`
- 覆盖：
  - prompt 中角色摘要来自统一 context helper
  - stage 不再用 `buildCharacterMemorySummary(memorySnapshot)` 覆盖摘要
  - 输出带 `memoryVersion`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在 stage 的旧上下文拼接逻辑

### Step 4.2: 重构 scripting stage

**产出物：**
- scripting stage 使用 `WorkflowRuntimeState`
- prompt context 通过统一 helper 构建
- stage 结果写回 `currentDraft`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**通过标准：**
- Finding 3 在 scripting 路径上被根治，而不是局部回避

### Step 4.3: 任务级验证

**产出物：**
- scripting 成为围绕 state 与统一上下文工作的 stage

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Expected: PASS

**任务通过标准：**
- scripting 不再自带第二套角色摘要逻辑

---

## Task 5: 把 repair 与 quality stage 切到单一 state + 统一证据

**目标产出物**

- repair 与 quality 共用同一份角色基线、draft 与证据
- repair 不再回退 alias
- quality 有结构化角色归一化证据可判

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/finalize-segment.test.ts`

### Step 5.1: 写失败测试，固定 repair 读取统一角色提示

**产出物：**
- 扩展 `repair-stage.test.ts`
- 覆盖：
  - repair prompt 中使用统一 memory summary / resolution hints
  - repair 成功后会重新走 canonicalization

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点在 repair 旧上下文/旧输出路径

### Step 5.2: 写失败测试，固定 quality 使用统一角色证据

**产出物：**
- 扩展 `quality-stage.test.ts`
- 覆盖：
  - unresolved speakers / alias conflicts 基于统一 evidence 判定
  - quality prompt 使用统一摘要与证据来源

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点在 quality 旧证据注入路径

### Step 5.3: 写失败测试，固定 finalize 成功返回的 draft 就是最终 draft

**产出物：**
- 扩展 `finalize-segment.test.ts`
- 明确断言：
  - success result.draft === persisted draft
  - success result.draft === artifact draft

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/finalize-segment.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点明确落在返回值与最终落库对象不一致

### Step 5.4: 重构 repair / quality / finalize

**产出物：**
- repair / quality 使用统一 state、统一 evidence、统一上下文
- `finalize-segment.ts` 成功返回 `canonicalized.draft`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/finalize-segment.test.ts`
- Expected: PASS

**通过标准：**
- Finding 2 被彻底修复
- repair / quality 不再靠局部对象拼接上下文

### Step 5.5: 任务级验证

**产出物：**
- repair / quality / finalize 已围绕同一份状态运行

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/finalize-segment.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**任务通过标准：**
- 同一次 segment 处理不再存在多份语义不一致的 draft

---

## Task 6: 统一失败传播语义，修复 discovery persist 被吞

**目标产出物**

- character discovery persist 失败显式上抛为 failure
- workflow summary / degraded mode / trace 都读取统一失败结果

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

### Step 6.1: 写失败测试，固定 discovery persist 失败必须向上游返回 failure

**产出物：**
- 扩展 `character-discovery-pass.test.ts`
- 覆盖：
  - discovery 成功但 persist 失败时，返回 `failure`
  - errorCode 为 `PERSIST_STAGE_FAILED`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在现有静默吞错行为

### Step 6.2: 写失败测试，固定 workflow 会消费这类 failure

**产出物：**
- 扩展 `run-script-production-workflow.test.ts`
- 覆盖：
  - bootstrap discovery persist 失败会导致 workflow fail 或 degraded 明确记录
  - 不会再被记成成功且 `persistedCharacterCount = 0`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在 workflow 的旧分支判断

### Step 6.3: 实现统一失败传播

**产出物：**
- `run-character-discovery-pass.ts` 显式返回 persist failure
- `run-script-production-workflow.ts` 消费该 failure

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**通过标准：**
- Finding 1 被彻底修复
- discovery persist 失败不再 silent fallback

### Step 6.4: 任务级验证

**产出物：**
- workflow 的失败传播语义统一

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**任务通过标准：**
- 所有 discovery 失败都能进 summary / trace / degraded handling

---

## Task 7: 对齐共享 schema 契约，先收口 gender 与关键字段枚举

**目标产出物**

- prompt、parser、持久化围绕同一字段约束工作
- `gender` 中英文输入统一归一化

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/contracts/character-discovery.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/storage/character-utils.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/system.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts`

### Step 7.1: 写失败测试，固定 gender 中英文值都会正确归一化

**产出物：**
- 扩展 `character-memory-store.test.ts` 或新增更贴近 consumer 的断言
- 覆盖：
  - `男` / `男性` -> `male`
  - `女` / `女性` -> `female`
  - 其它 -> `unknown`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在当前归一化函数只接受英文枚举

### Step 7.2: 写失败测试，固定 prompt 明确要求枚举

**产出物：**
- 扩展 `character-discovery-stage.test.ts`
- 覆盖：
  - system prompt / user prompt 明确要求 `male/female/unknown`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在 prompt 契约仍为开放字符串

### Step 7.3: 落共享 contract 并更新 prompt 与 parser

**产出物：**
- 新增 `contracts/character-discovery.ts`
- `character-utils.ts` 兼容中英文映射
- character extraction prompt 明确枚举

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Expected: PASS

**通过标准：**
- Finding 5 被修复
- prompt / parser / persist 契约一致

### Step 7.4: 任务级验证

**产出物：**
- 第一批共享 schema 契约落地

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Expected: PASS

**任务通过标准：**
- 高风险字段不再存在 prompt/消费端契约分裂

---

## Task 8: 端到端回归验证与清理兼容分支

**目标产出物**

- 所有关键回归测试通过
- 不再保留多余的旧上下文拼接逻辑
- 输出一份最终变更验证记录

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Modify: 受影响实现文件中的过渡分支
- Create: `/Users/xupeng/mycode/txt2voice/docs/handoff/2026-04-09-llm-runtime-state-refactor-handoff.md`

### Step 8.1: 跑局部回归集合

**产出物：**
- 一组局部回归通过记录

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-state.test.ts src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts src/lib/agent-runtime/__tests__/prompt-budget.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/finalize-segment.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: PASS

**通过标准：**
- 所有关键局部行为稳定

### Step 8.2: 跑 workflow 回归集合

**产出物：**
- workflow 级回归通过记录

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**通过标准：**
- workflow 行为和 prompt guardrail 同时稳定

### Step 8.3: 删除多余兼容分支并写 handoff

**产出物：**
- 清理后的实现
- `2026-04-09-llm-runtime-state-refactor-handoff.md`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-state.test.ts src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts src/lib/agent-runtime/__tests__/prompt-budget.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/finalize-segment.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**通过标准：**
- 全部回归通过
- 兼容分支清理后无行为回退

### Step 8.4: 任务级验证

**产出物：**
- 可交付的完整重构结果与 handoff 文档

**验证方法：**
- 复核：
  - Finding 1 已由测试覆盖
  - Finding 2 已由测试覆盖
  - Finding 3 已由测试覆盖
  - Finding 4 已由测试覆盖
  - Finding 5 已由测试覆盖

**任务通过标准：**
- 5 个 findings 都有对应代码与测试闭环

---

## 建议执行顺序

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8

任何时候都不得跳步。

## 预期里程碑

### 里程碑 A

完成 Task 1-3 后，系统已经具备：

- 单一状态模型
- 统一角色记忆核心
- 安全的结构化 prompt context

### 里程碑 B

完成 Task 4-6 后，系统已经具备：

- scripting / repair / quality 共用同一语义基线
- discovery persist 失败显式上抛
- success draft 与落库对象一致

### 里程碑 C

完成 Task 7-8 后，系统已经具备：

- 关键 schema 契约一致
- 5 个 findings 全部闭环
- 有完整回归与 handoff

## 完成定义

只有当以下条件全部满足时，整个计划才算完成：

1. 设计文档中的四个设计支柱已全部落地。
2. 五个 review findings 都有明确修复实现。
3. 五个 review findings 都有明确测试覆盖。
4. 所有任务级验证通过。
5. 最终回归集通过。
