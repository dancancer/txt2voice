# Subagent Runtime Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐 subagent runtime 在主 workflow、runtime-owned manual review、authoring protocol、tool/trace 协议上的剩余缺口，让当前实现更接近 `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md` 的目标形态。

**Architecture:** 继续在现有 `agent-runtime` 上增量收口，而不是重写。先把已经存在但尚未接入主链路的 `character_discovery` 接进 script-production bridge，再把人工审查 handoff 从 `script-generation-runner.ts` 下沉到 runtime stage / tool，最后补齐文件化定义、trace taxonomy 和缺失的通用工具面。

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Bull, Redis, Jest.

---

## Current Status Review

### Completed

- Task 1 到 Task 13 已完成，Task 14 和 Task 15 也已在后续迭代中闭环。
- `protocol / schema / registry / context / tools / workflow skeleton / llm adapter` 已存在并有测试。
- `character_discovery / segment_scripting / repair / quality / persist` 都有独立 stage 实现。
- `script-generation-runner.ts` 已经切到 `runScriptProductionWorkflow()`，runtime replay / summary / metadata 也已写通。
- 本轮已把 `character_discovery` 接入 script-production bridge，并在主 workflow 中先提交 `character-memory-draft` 再继续段落生成。

### Partially Completed

- 主 workflow 还没有接入设计稿里的完整阶段机。
  - 当前 `workflow.toml` 已包含 `character_discovery`，但仍缺 `prepare / manual_review_handoff / complete`。
- runtime 已经能产出质量审查证据包，但人工审查落库仍由 `script-generation-runner.ts` 直接操作 `ManualReviewItem`。
- `runWorkflow()` 已经能驱动 lifecycle，但状态集仍只有 `completed / failed / retrying / repairing`，没有设计稿里的 `blocked / manual_review_required`。
- `ToolCall` 和 replay 已能工作，但 generic coverage 仍主要集中在 script-production 的高价值动作。

### Not Yet Implemented

- `manual_review_handoff` 还不是 runtime stage。
- `prepare` / `complete` 还没有在 workflow 定义中体现。
- `script-generation-agent`、`repair-agent`、`quality-judge-agent`、`coordinator-agent` 的文件化 authoring 定义还没补齐。
- `skill.toml` 还没有设计稿建议的 `promptBundle / modelPolicy / repairPolicy / successCriteria / telemetryTags`。
- 设计稿建议的 trace taxonomy 还没标准化为统一事件名。
- 设计稿里的 `load-segment-batch / load-character-memory / save-script-draft / create-manual-review-item / estimate-token-budget` 等工具还没形成正式 contract。
- runtime 目前是 run-centric replay，还没有 artifact-centric 的独立持久化面。

### Deferred For Later

- 向终端用户开放自定义 workflow。
- 完全通用 DAG 编排。
- 一次性迁移项目内所有 LLM 点位。

### Task 1: 将 `character_discovery` 接入 script-production 主 workflow（已在当前分支落地）

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- workflow 在进入 `segment_scripting` 前先调用 `runCharacterDiscoveryStage()`
- `character_discovery` 返回 `character-memory-draft` 后，会通过 `runPersistStage()` 单独提交一次
- 角色记忆提交后，后续段落仍继续走 `segment_scripting -> validation -> repair -> quality -> persist`
- workflow summary 中的 `persistedCharacterCount` 会计入角色记忆提交结果

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --testNamePattern='runs character discovery before segment scripting and persists the memory draft once'`

Expected: FAIL，因为当前 bridge 还没有调用 `runCharacterDiscoveryStage()`

**Step 3: Write minimal implementation**

- 给 `run-script-production-workflow.ts` 增加 `runCharacterDiscoveryStage` 依赖注入
- 在 coordinator 入口基于选中的 segments 构造最小采样文本
- 调用 `runCharacterDiscoveryStage()`
- 若 discovery 成功，则调用 `runPersistStage()` 提交 `character-memory-draft`
- 将 `character_discovery` 加入 runtime workflow stages 和 `workflow.toml`
- 保持 `characterProfiles` / `characterMap` 复用同一引用，让角色落库结果能被后续 segment scripting 复用

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --testNamePattern='runs character discovery before segment scripting and persists the memory draft once'`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts /Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "feat: wire character discovery into runtime workflow"
```

### Task 2: 新增 `manual_review_handoff` stage，并把人工审查落库下沉到 runtime

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/review-tools.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 当 `quality` 返回 `manual_review_required` 时，workflow 会进入 `manual_review_handoff`
- handoff stage 调用 runtime tool 创建/更新 review item
- runner 只消费 runtime 结果，不再自己同步失败 review items

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts --testNamePattern='manual review'`

Expected: FAIL，因为当前 manual review 仍然在 runner 内处理

**Step 3: Write minimal implementation**

- 新建 `create-manual-review-item` 工具 contract + 执行器
- 新增 `manual_review_handoff` stage，消费 quality handoff 证据包
- workflow 在 segment failure / quality manual review 时调 handoff stage
- runner 改为读取 runtime 结果，不再直接 orchestrate review sync

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts --testNamePattern='manual review'`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/review-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts
git commit -m "feat: move manual review handoff into runtime"
```

### Task 3: 补齐 workflow 状态模型与 definition parity

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `runWorkflow()` 支持 `manual_review_required` 与 `blocked`
- `script-production` definition 与 runtime coordinator 的阶段顺序一致

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

Expected: FAIL，因为当前状态集与 workflow definition 都还不完整

**Step 3: Write minimal implementation**

- 扩展 `WorkflowTerminalStatus`
- 同步修正 `script-production` workflow definition
- 保持现有 `retrying / repairing` 语义不回退

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts /Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts
git commit -m "feat: expand workflow terminal states"
```

### Task 4: 补齐缺失的 agent authoring 定义，并增强 skill metadata

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/agents/script-generation/agent.toml`
- Create: `/Users/xupeng/mycode/txt2voice/agents/script-generation/AGENT.md`
- Create: `/Users/xupeng/mycode/txt2voice/agents/repair/agent.toml`
- Create: `/Users/xupeng/mycode/txt2voice/agents/repair/AGENT.md`
- Create: `/Users/xupeng/mycode/txt2voice/agents/quality-judge/agent.toml`
- Create: `/Users/xupeng/mycode/txt2voice/agents/quality-judge/AGENT.md`
- Create: `/Users/xupeng/mycode/txt2voice/agents/coordinator/agent.toml`
- Create: `/Users/xupeng/mycode/txt2voice/agents/coordinator/AGENT.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/skill.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 新 agent definitions 都能被 loader 读取
- skill metadata 包含 `promptBundle / successCriteria / telemetryTags`
- authoring 文件缺失时仍报结构化错误

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`

Expected: FAIL，因为当前只有 `character-discovery-agent` 的文件化定义

**Step 3: Write minimal implementation**

- 新增缺失的 agent authoring 文件
- 扩展 skill metadata 的解析与校验
- 保持旧 skill.toml 向后兼容

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/agents /Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml /Users/xupeng/mycode/txt2voice/skills/script-generation/skill.toml /Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml /Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts
git commit -m "feat: complete runtime authoring definitions"
```

### Task 5: 扩大通用工具面并标准化 trace taxonomy

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/io-tools.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/task-tools.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 缺失工具 `load-segment-batch / load-character-memory / save-script-draft / create-manual-review-item / estimate-token-budget` 能被 contract 层识别
- trace 事件统一使用 `skill_selected / context_built / llm_requested / structured_output_received / validation_failed / repair_started / manual_review_escalated / artifact_committed`

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/tool-contracts.test.ts src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts`

Expected: FAIL，因为当前工具面与 trace taxonomy 仍然偏 script-production 特化

**Step 3: Write minimal implementation**

- 为缺失工具补 contract
- 在 runtime 关键路径写标准 trace event 名称
- 保持现有 replay 读取面兼容

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/tool-contracts.test.ts src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/io-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/task-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts
git commit -m "feat: standardize runtime tool and trace contracts"
```
