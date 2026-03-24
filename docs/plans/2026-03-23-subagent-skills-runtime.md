# Subagent Skills Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为角色识别、台本生成、修复与质检主链路重建一套 `subagent + skills + workflow` 运行时，使文件化定义贴近 Codex / Claude 生态，同时保持强类型协议、可恢复执行、可观测 trace 与受控副作用边界。

**Architecture:** 新增独立的 `agent-runtime` 代码层，并在仓库根目录新增 `agents/`、`skills/`、`workflows/` 作为文件化定义层。运行时先把文件定义解析为 typed protocol，再通过阶段化 workflow 执行 agent、tool、artifact 和 trace；现有业务入口仅负责把任务切入新 runtime，而不再直接组织 prompt、修复与持久化逻辑。

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Bull, Redis, Jest.

---

### Task 1: 建立 runtime 协议骨架

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/artifacts.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/events.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `AgentDefinition`、`SkillDefinition`、`WorkflowDefinition`、`ToolContract` 可以被类型守卫识别。
- `ArtifactEnvelope` 与 `ExecutionEvent` 的最小字段完整。
- 缺少 `id`、`version`、`kind` 等关键字段时会被拒绝。

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`

Expected: FAIL，因为 `agent-runtime/protocol` 尚不存在。

**Step 3: Write minimal implementation**

- 定义 `AgentDefinition`、`SkillDefinition`、`WorkflowDefinition`、`ToolContract`
- 定义 `ArtifactEnvelope<T>`、`ExecutionEvent`
- 提供最小类型守卫与统一导出

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/artifacts.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/events.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/index.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/protocol-definitions.test.ts
git commit -m "feat: add agent runtime protocol skeleton"
```

### Task 2: 为执行实体补齐 Prisma 模型

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/prisma/schema.prisma`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- Prisma schema 中存在 `WorkflowRun`、`StageRun`、`AgentRun`、`ToolCall`、`TraceEvent`
- 这些模型具备最小关联键：`bookId`、`processingTaskId`、`workflowRunId`、`stageRunId`、`agentRunId`

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`

Expected: FAIL，因为 schema 里还没有这些执行实体。

**Step 3: Write minimal implementation**

- 在 `schema.prisma` 中新增：
  - `WorkflowRun`
  - `StageRun`
  - `AgentRun`
  - `ToolCall`
  - `TraceEvent`
- 字段以最小可用集为准，artifact 相关负载先使用 `Json`

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/prisma/schema.prisma /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts
git commit -m "feat: add agent runtime execution models"
```

### Task 3: 实现文件定义加载器

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/load-definition.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/validate-definition.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Create: `/Users/xupeng/mycode/txt2voice/agents/character-discovery/agent.toml`
- Create: `/Users/xupeng/mycode/txt2voice/agents/character-discovery/AGENT.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml`
- Create: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/SKILL.md`
- Create: `/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml`
- Create: `/Users/xupeng/mycode/txt2voice/workflows/script-production/WORKFLOW.md`

**Step 1: Write the failing test**

写测试覆盖：

- 能从 `agents/`、`skills/`、`workflows/` 读取 definition
- `agent.toml` 与 `skill.toml` 缺字段时抛结构化错误
- `AGENT.md` / `SKILL.md` / `WORKFLOW.md` 缺失时报 authoring 错误

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`

Expected: FAIL，因为 registry 与 definition 文件尚不存在。

**Step 3: Write minimal implementation**

- 实现最小 TOML 子集解析
- 实现结构化 `DefinitionRegistryError`
- 创建最小样板 definition 文件

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/load-definition.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/validate-definition.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/index.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts /Users/xupeng/mycode/txt2voice/agents/character-discovery/agent.toml /Users/xupeng/mycode/txt2voice/agents/character-discovery/AGENT.md /Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml /Users/xupeng/mycode/txt2voice/skills/character-extraction/SKILL.md /Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml /Users/xupeng/mycode/txt2voice/workflows/script-production/WORKFLOW.md
git commit -m "feat: add agent skill workflow definition loader"
```

### Task 4: 建立 artifact 与 memory 协议

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/memory-types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/artifact-types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `CharacterMemory` 能区分 `assertedFacts` 与 `inferredHints`
- `SegmentScriptDraft`、`ValidationReport`、`RepairDecision`、`QualityVerdict` 具有最小字段
- `MemoryPatch` 合并前后保持 canonical identity 不丢失

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts`

Expected: FAIL，因为 artifact 与 memory 协议尚未定义。

**Step 3: Write minimal implementation**

- 定义 `CharacterMemory`、`MemoryPatch`
- 定义 `SegmentScriptDraft`、`ValidationReport`、`RepairDecision`、`QualityVerdict`

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/memory-types.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/artifact-types.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/index.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts
git commit -m "feat: define runtime artifacts and memory contracts"
```

### Task 5: 实现上下文构建器

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/budget-policy.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `script-generation-agent` 只拿到单段输入、压缩角色记忆、policy context 和执行预算
- `repair-agent` 拿到失败 artifact，而不是整本书全文
- 超预算时优先裁剪 reference memory，而不是输入原文

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`

Expected: FAIL，因为 context builder 尚未存在。

**Step 3: Write minimal implementation**

- 在 `build-context.ts` 中按 agent 类型构造五层上下文
- 在 `budget-policy.ts` 中实现最小裁剪策略

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/budget-policy.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts
git commit -m "feat: add agent context builder"
```

### Task 6: 建立 tool contract 与内置 deterministic tools

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/contracts.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/io-tools.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/validation-tools.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/task-tools.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- tool allowlist 能限制 agent 可调用工具
- `validate-structured-output` 与 `check-script-coverage` 的返回值稳定可断言
- `commit-script-sentences`、`save-character-memory` 被标记为副作用 tool

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/tool-contracts.test.ts`

Expected: FAIL，因为 tools 目录与 contract 还不存在。

**Step 3: Write minimal implementation**

- 定义 `ToolContract`
- 实现最小 IO tool、validation tool、task tool

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/tool-contracts.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/contracts.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/io-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/validation-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/task-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts
git commit -m "feat: add built-in runtime tools"
```

### Task 7: 实现 workflow runtime skeleton 与 trace 持久化

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `run-workflow()` 会创建 `WorkflowRun` 与 `StageRun`
- 每个 stage 都会产出 trace event
- agent 失败时能进入 `retrying` 或 `repairing`，而不是直接吞掉

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

Expected: FAIL，因为 runtime skeleton 尚未存在。

**Step 3: Write minimal implementation**

- `run-workflow.ts` 驱动阶段顺序
- `run-stage.ts` 创建 `StageRun` 并调用 agent
- `run-agent.ts` 负责 agent 执行与失败路由
- `write-trace.ts` 写统一 trace event

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts
git commit -m "feat: add workflow runtime skeleton"
```

### Task 8: 封装 LLM adapter，隔离模型调用面

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- adapter 能统一返回 `content`、`usage`、`latencyMs`、`provider`、`model`
- agent runtime 通过 adapter 发起调用，而不是直接依赖 `LLMService` 实例

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

Expected: FAIL，因为 adapter 尚未存在。

**Step 3: Write minimal implementation**

- 封装独立 `llm-adapter`
- 复用现有 `runLLMRequest()` 与 provider helper

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts
git commit -m "refactor: add llm adapter for agent runtime"
```

### Task 9: 落地 character discovery 阶段

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml`
- Create: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/system.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 角色识别阶段会读取文本样本并产出 `CharacterMemoryDraft`
- 角色输出会区分 canonical identity、alias evidence、asserted fact、inferred hint
- 当前阶段不会直接写 `CharacterProfile` 业务表

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

Expected: FAIL，因为阶段执行器和 agent 尚未存在。

**Step 3: Write minimal implementation**

- 实现 `character-discovery-agent`
- 实现 `run-character-discovery-stage`
- 补 prompt 与最小运行路径

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts /Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml /Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/system.md /Users/xupeng/mycode/txt2voice/skills/character-extraction/prompts/user.md /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts
git commit -m "feat: add character discovery stage"
```

### Task 10: 落地 segment scripting 阶段

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Create: `/Users/xupeng/mycode/txt2voice/skills/script-generation/skill.toml`
- Create: `/Users/xupeng/mycode/txt2voice/skills/script-generation/SKILL.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/system.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 单段输入会产出 `SegmentScriptDraft`
- draft 中包含 `sourceText`、`speaker`、`text`、`orderInSegment` 等关键字段
- 当前阶段结束后只保存 draft，不直接写 `ScriptSentence`

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

Expected: FAIL，因为脚本阶段 agent 与 skill 尚未存在。

**Step 3: Write minimal implementation**

- 实现 `script-generation-agent`
- 实现 `run-segment-scripting-stage`
- 保持只产出 draft，不接 DB

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts /Users/xupeng/mycode/txt2voice/skills/script-generation/skill.toml /Users/xupeng/mycode/txt2voice/skills/script-generation/SKILL.md /Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/system.md /Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/user.md /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts
git commit -m "feat: add segment scripting stage"
```

### Task 11: 接入 deterministic validation 与 repair 闭环

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts`
- Create: `/Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml`
- Create: `/Users/xupeng/mycode/txt2voice/skills/json-repair/SKILL.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/system.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- JSON 破损进入 `format repair`
- coverage/结构问题进入 `semantic_retry`
- 超预算进入 `input_refinement`
- `repairDepth` 超限后进入 `manual_review`

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`

Expected: FAIL，因为 repair stage 与 repair skill 尚未实现。

**Step 3: Write minimal implementation**

- 实现最小 repair taxonomy
- 让 repair stage 只消费失败 artifact 与 validation 结果
- 保持不接 DB / persist / manual review stage

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts /Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml /Users/xupeng/mycode/txt2voice/skills/json-repair/SKILL.md /Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/system.md /Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/user.md /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts
git commit -m "feat: add repair loop for runtime artifacts"
```

### Task 12: 落地 quality judgement 与 manual review handoff

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/quality-judge-agent.ts`
- Create: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml`
- Create: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/SKILL.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/system.md`
- Create: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- deterministic validation 通过后，quality judge 才会介入
- 低置信输出会被标记为 `manual_review_required`
- 升级人工时会构造结构化证据包

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`

Expected: FAIL，因为 quality stage 尚未实现。

**Step 3: Write minimal implementation**

- `run-quality-stage.ts` 只消费 artifact，不吃原始 prompt/response
- `quality-judge-agent.ts` 产出 `QualityVerdict`
- handoff 只返回结构化 review 证据，不接 DB

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/quality-judge-agent.ts /Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml /Users/xupeng/mycode/txt2voice/skills/quality-judgement/SKILL.md /Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/system.md /Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/user.md /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git commit -m "feat: add quality judgement and review handoff"
```

### Task 13: 实现 persist 阶段，把 artifact 提交为业务事实

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/persist-tools.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/persist-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `CharacterMemory` 能被提交成 `CharacterProfile`
- `SegmentScriptDraft` 能被提交成 `ScriptSentence`
- 同一 artifact 重放提交时保持幂等

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/persist-stage.test.ts`

Expected: FAIL，因为 persist stage 和新工具尚未实现。

**Step 3: Write minimal implementation**

- 新建 `persist-tools.ts`
- 复用现有 `persistence.ts` 与 `character-utils.ts`
- 保证提交顺序稳定且可重放

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && npm test -- --runInBand src/lib/agent-runtime/__tests__/persist-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/persist-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/persist-stage.test.ts
git commit -m "feat: commit runtime artifacts into business tables"
```
