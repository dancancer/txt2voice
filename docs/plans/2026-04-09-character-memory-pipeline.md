# Character Memory Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前 LLM 主链路重构为统一、版本化、可追踪的 `Character Memory Pipeline`，彻底修复角色发现失败传播、repair 失忆、quality 无据判定和长文本角色召回不足的问题。

**Architecture:** 先建立 runtime 一级的 `CharacterMemorySnapshot` 与统一 canonicalization / summary 能力，再让 scripting、repair、quality 三个阶段共用同一份角色基线，随后把 workflow 升级为显式的 memory 驱动状态机，最后接入增量 discovery refresh。整个实施严格采用串行闸门模式，任何一步的工件未达标或验证失败，都不得进入下一步。

**Tech Stack:** Next.js, TypeScript, Jest, Prisma, Mastra runtime bridge, Bull-based LLM runtime.

---

## 执行总原则

1. 每一步只解决一个清晰问题，并产出可检查工件。
2. 每一步必须先验证通过，才能进入下一步。
3. 验证优先于解释，证据优先于推断。
4. 统一规则层优先于追加 prompt 约束。
5. 所有行为变更都必须有测试覆盖。

## 阶段闸门定义

### Step Gate

每个步骤都必须满足以下四项：

1. 产出物已落地到指定文件。
2. 指定测试或命令执行通过。
3. 没有引入上一步已覆盖行为的回归。
4. 当前步骤的“通过标准”全部满足。

若任一项不满足，停止，不进入下一步骤。

### Task Gate

每个 Task 完成后，必须执行该 Task 的“任务级验证”。任务级验证不过，禁止开始下一个 Task。

## Task 1: 建立统一的 Character Memory 核心模型

**目标产出：**

- 新增 `CharacterMemorySnapshot`、`CharacterResolutionEvidence` 类型
- 新增 memory store、merge、summary、canonicalize 骨架
- 新增最小测试，固定 snapshot 合并和 speaker canonicalization 行为

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/merge.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/summary.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`

### Step 1.1: 写失败测试，钉死 memory snapshot 合并语义

**产出物：**
- 新增 `character-memory-store.test.ts`
- 覆盖：
  - 从 profile bootstrap 得到 `version = 1`
  - patch 合并后版本递增
  - alias evidence 合并不重复
  - asserted / inferred bucket 会 remap 到已有 canonical id

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Expected: FAIL，错误应表明核心模块尚不存在或行为未实现

**通过标准：**
- 测试准确失败在目标能力上，不是路径错误或语法错误

**未通过时处理：**
- 修正测试夹具和目标断言，不进入 Step 1.2

### Step 1.2: 写失败测试，钉死 speaker canonicalization 语义

**产出物：**
- 新增 `character-memory-canonicalize.test.ts`
- 覆盖：
  - canonical speaker 保持不变
  - alias speaker 被回写成 canonical
  - unresolved speaker 会被标记出来
  - alias 冲突不会被强行改写

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: FAIL

**通过标准：**
- 测试准确描述预期语义

### Step 1.3: 实现类型、store、merge、summary、canonicalize 最小闭环

**产出物：**
- `types.ts` 定义统一 snapshot/evidence 类型
- `store.ts` 提供 `createBootstrapSnapshot()`、`applyMemoryPatch()`
- `merge.ts` 提供 patch 合并逻辑
- `summary.ts` 提供 prompt 摘要生成
- `canonicalize.ts` 提供统一 speaker 归一化

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**通过标准：**
- 两组测试全部通过
- 核心模块文件总数和职责边界与设计文档一致

### Step 1.4: 任务级验证

**产出物：**
- 可被后续 stage 直接复用的 memory 核心模块

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**任务通过标准：**
- snapshot、merge、summary、canonicalize 四件套齐备
- 没有修改任何 workflow 行为

---

## Task 2: 用统一 Memory 核心替换 scripting 局部角色逻辑

**目标产出：**

- `segment_scripting` 不再自己维护局部 speaker normalization
- scripting stage 输出包含 `memoryVersion`
- 统一 canonicalization 成为 validation 前的唯一入口

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

### Step 2.1: 写失败测试，固定 scripting 路径的 canonicalization 来源

**产出物：**
- 扩展 `segment-scripting-stage.test.ts`
- 覆盖：
  - scripting 不再依赖 stage 内私有 `normalizeDraftSpeakers`
  - alias 命中时，输出 speaker 会经过统一 canonicalize 层
  - stage 会保留 `memoryVersion`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点落在旧的局部 normalization 逻辑

### Step 2.2: 接入统一 canonicalization 与 summary

**产出物：**
- scripting stage 改为消费 `CharacterMemorySnapshot`
- prompt summary 由统一 `summary.ts` 生成
- draft 在出 stage 或入 validation 前统一 canonicalize

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**通过标准：**
- scripting 路径彻底改成调用共享模块

### Step 2.3: 任务级验证

**产出物：**
- scripting 已迁移到统一 memory 语义

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**任务通过标准：**
- 局部 speaker normalization 不再是唯一实现

---

## Task 3: 扩展 repair 契约，让 repair 拿到同一份角色基线

**目标产出：**

- `json-repair` skill 契约增加 `character_memory_summary` 与 `character_resolution_hints`
- repair prompt 能感知 canonical / alias 规则
- repair 输出也会经过统一 canonicalization

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/system.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/user.md`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`

### Step 3.1: 写失败测试，固定 repair skill 新契约

**产出物：**
- 扩展 `repair-stage.test.ts`
- 覆盖：
  - 缺失 `character_memory_summary` 时 contract 校验失败
  - repair prompt 中包含角色提示摘要

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: FAIL

**通过标准：**
- 测试反映的是新契约尚未落地

### Step 3.2: 修改 skill 与 prompt

**产出物：**
- `skill.toml` contextRequirements 更新
- system/user prompt 明确 canonical / alias 约束

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**通过标准：**
- prompt guardrails 中能检查到新的角色约束

### Step 3.3: 修改 runtime repair 路径

**产出物：**
- repair stage 接入 memory summary 和 resolution hints
- repair 结果统一 canonicalize

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Expected: PASS

**通过标准：**
- repair 后 speaker 不会回退为 alias

### Step 3.4: 任务级验证

**产出物：**
- repair 路径与 scripting 共用同一角色语义

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Expected: PASS

**任务通过标准：**
- Finding 4 被覆盖且有测试钉住

---

## Task 4: 扩展 quality 契约，让 quality 基于结构化角色证据判定

**目标产出：**

- `quality-judgement` skill 契约增加 `character_memory_summary` 与 `character_resolution_evidence`
- quality stage 真正能判 alias/canonical 一致性

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/system.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/user.md`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`

### Step 4.1: 写失败测试，固定 quality 新上下文契约

**产出物：**
- 扩展 `quality-stage.test.ts`
- 覆盖：
  - 没有 `character_resolution_evidence` 时无法完整执行角色归属判定
  - unresolved speaker 会进入 manual review 或 fail 决策

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL

**通过标准：**
- 测试明确暴露当前 quality 无法校验角色归属的问题

### Step 4.2: 修改 skill 与 prompt

**产出物：**
- `quality-judgement` skill.toml 契约扩展
- prompt 明确要求依据结构化角色证据判定

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**通过标准：**
- prompt guardrails 可断言新的 evidence 字段存在

### Step 4.3: 修改 runtime quality 路径

**产出物：**
- quality stage 生成并传递 `CharacterResolutionEvidence`
- semantic decision 可基于 unresolved speaker / alias conflict 降级

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**通过标准：**
- quality 对角色归属的判断不再是空口要求

### Step 4.4: 任务级验证

**产出物：**
- quality 与 repair、scripting 共享同一角色事实基线

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**任务通过标准：**
- Finding 1 被覆盖且有测试保障

---

## Task 5: 把 Character Memory 提升为 workflow 一级状态

**目标产出：**

- workflow 不再只把 discovery 当成前置动作
- runtime 显式维护 `characterMemorySnapshot`
- discovery failure 不再被吞

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/shared-types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`

### Step 5.1: 写失败测试，钉死 discovery failure 不可再被吞

**产出物：**
- 扩展 `run-script-production-workflow.test.ts`
- 覆盖：
  - bootstrap discovery failure 会进入 workflow summary
  - 无 bootstrap snapshot 时 workflow failed
  - 有 bootstrap snapshot 时 workflow degraded，但 issue 可见

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: FAIL

**通过标准：**
- 失败点明确落在当前空分支和 failure 传播缺失

### Step 5.2: 接入 CharacterMemoryStore 到 workflow 主链

**产出物：**
- workflow 初始化 bootstrap snapshot
- discovery 返回 patch 后更新 snapshot 版本
- 每个 segment 读取最新 snapshot

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**通过标准：**
- workflow summary 中带有 memory version / degradedMode

### Step 5.3: 任务级验证

**产出物：**
- workflow 对 memory 拥有显式控制权

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: PASS

**任务通过标准：**
- Finding 2 被修复且被测试覆盖

---

## Task 6: 接入 runtime artifact 与 trace 扩展

**目标产出：**

- 新增 `character-memory-snapshot` 与 `character-resolution-evidence` artifact
- trace 中新增 memory / canonicalization 事件

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/artifacts.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/events.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/write-trace.test.ts`

### Step 6.1: 写失败测试，固定新增 artifact / event 协议

**产出物：**
- 扩展 `artifact-memory-contract.test.ts`
- 扩展 `write-trace.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts src/lib/agent-runtime/__tests__/write-trace.test.ts`
- Expected: FAIL

### Step 6.2: 扩展协议与 store

**产出物：**
- protocol 接受新 artifact / event
- runtime store 能落这两类工件

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts src/lib/agent-runtime/__tests__/write-trace.test.ts`
- Expected: PASS

### Step 6.3: 任务级验证

**产出物：**
- memory 版本和角色归一化证据可回放、可观测

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts src/lib/agent-runtime/__tests__/write-trace.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**任务通过标准：**
- runtime artifacts 与 trace 已能承载新设计

---

## Task 7: 把 discovery 从一次性 bootstrap 升级成 incremental refresh

**目标产出：**

- 新增 refresh 触发器
- 新增局部样本策略
- 新角色可在运行中进入 memory

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/refresh.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

### Step 7.1: 写失败测试，固定 incremental refresh 触发条件

**产出物：**
- 扩展 `character-discovery-pass.test.ts`
- 覆盖：
  - unresolved speaker 触发 refresh
  - 章节切换触发 refresh
  - refresh 后 memory version 递增

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: FAIL

### Step 7.2: 实现 refresh 触发器与局部选样

**产出物：**
- `refresh.ts`
- workflow 中的 refresh orchestration

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: PASS

### Step 7.3: 验证长文本角色召回不再依赖首轮样本

**产出物：**
- workflow 测试夹具覆盖“后半段新角色”

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --testNamePattern='late introduced character'`
- Expected: PASS

### Step 7.4: 任务级验证

**产出物：**
- incremental refresh 正式接通

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**任务通过标准：**
- Finding 3 被真正解决，而不是靠放大 bootstrap 样本硬顶

---

## Task 8: 端到端回归与收口

**目标产出：**

- 设计目标对应的四个 findings 全部有测试覆盖
- 主链路回归通过
- 文档与代码契约对齐

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/AGENTS.md` 仅在需要补充 workflow 说明时修改
- Modify: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-04-09-character-memory-pipeline-design.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`

### Step 8.1: 运行端到端回归测试集

**产出物：**
- 一组可复用的最终验证命令

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

### Step 8.2: 做设计文档与实现一致性复核

**产出物：**
- 更新后的设计文档，如实现细节有偏差则回写文档

**验证方法：**
- 人工检查以下内容一致：
  - skill contextRequirements
  - workflow summary 字段
  - artifact / event 名称
  - refresh 触发器

**通过标准：**
- 文档与实现无关键偏差

### Step 8.3: 任务级验证

**产出物：**
- Character Memory Pipeline 可宣布进入可实现状态

**验证方法：**
- 全部端到端回归通过
- 四个 findings 各自有明确测试落点

**任务通过标准：**
- 只有在所有测试与文档复核都通过时，本计划才算完成

---

## 实施顺序总览

1. Task 1: 建立 Memory Core
2. Task 2: 迁移 Scripting
3. Task 3: 迁移 Repair
4. Task 4: 迁移 Quality
5. Task 5: 接管 Workflow 状态
6. Task 6: 扩展 Artifact / Trace
7. Task 7: 实现 Incremental Refresh
8. Task 8: 端到端回归与收口

## 停止条件

出现以下任一情况，立即停止继续实施：

1. 当前 Task 的任务级验证未通过。
2. 当前步骤的产出物与设计目标明显不一致。
3. 统一 memory 语义再次被复制到局部 helper，而不是落到共享模块。
4. 为了赶进度绕过测试或弱化断言。

## 完成定义

只有同时满足以下条件，才允许宣称方案完成：

1. 统一 `CharacterMemorySnapshot` 已进入 runtime 主链。
2. scripting / repair / quality 都读取同一份角色基线。
3. discovery failure 不再 silent。
4. incremental refresh 已能吸收后半段新角色。
5. 回归测试通过，文档与实现一致。
