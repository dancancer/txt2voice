# LLM Workflow Review Hardening Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 以门禁式步骤修复本轮 review 暴露的 LLM workflow 问题，确保每一步都有明确产出物、验证方法和前进条件。

**Architecture:** 先修正会直接误伤正确性的状态语义，再处理角色归一化和人工审核生命周期，最后补强 workflow telemetry 与真实集成测试。每一步都遵循 TDD：先写失败测试，再做最小实现，再跑验证，验证通过后才能进入下一步。

**Tech Stack:** TypeScript, Jest, Prisma runtime store, Mastra runtime, prompt bundles under `skills/*/prompts`

---

## 执行规则

1. 每一步开始前必须确认上一步“产出物已生成 + 验证通过”。
2. 任一步验证失败，禁止进入下一步，必须在当前步内修到通过。
3. 每一步的验证至少包含：
   - 定向测试
   - 必要的回归测试
4. 每一步的产出物必须是可见文件改动或可见测试用例，不接受“只更新心智模型”。
5. 如某一步需要改语义，先改测试，再改实现。

---

## Phase 1: 修正状态语义误判

### Step 1.1: 为“空角色发现是合法 no-op”写失败测试

**目标：**
- 把“空 character discovery draft 不再当 failure”固定成测试约束

**产出物：**
- 在 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts` 新增失败测试
- 在 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts` 新增 workflow 侧失败测试

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: FAIL，且失败原因是当前把空 discovery draft 当成 failure

**前进条件：**
- 两个测试都已写入仓库
- 测试失败原因符合预期，不是语法错误或 mock 配置错误

### Step 1.2: 实现空 discovery 的 no-op 语义

**目标：**
- 删除“空 draft == failure”的旧语义

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- 定向测试通过
- workflow 不再因空 discovery draft 误失败

### Step 1.3: 为 discovery refresh diagnostics 写失败测试

**目标：**
- 固定 `discovery_refresh` snapshot 的 source / diagnostics 一致性

**产出物：**
- 在 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts` 新增失败测试
- 在 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts` 新增 refresh 侧失败测试

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: FAIL，且失败原因是 refresh snapshot 仍带 bootstrap diagnostics

**前进条件：**
- 失败测试已落盘
- 失败原因锁定在 snapshot diagnostics 语义

### Step 1.4: 实现 discovery refresh snapshot 专用构造函数

**目标：**
- 禁止再用 bootstrap snapshot 伪装 refresh snapshot

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- `source = discovery_refresh`
- `sampleCoverage.strategy = incremental`
- `discoveryRunCount` 与 refresh 语义一致

---

## Phase 2: 收紧角色归一化边界

### Step 2.1: 为 alias 误判和 quality 硬升级写失败测试

**目标：**
- 固定“唯一显式 alias 命中不应无条件人工审核”

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts --runInBand`
- Expected: FAIL，当前 alias 命中仍会直接 `manual_review_required`

**前进条件：**
- 定向失败测试已落地
- 失败原因与 alias 硬升级相关

### Step 2.2: 收紧自动姓名变体规则

**目标：**
- 自动变体不再直接进入强 alias 链路

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-name-variations.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- 自动启发式变体不再被当成强 alias 使用
- 显式 alias 命中测试保持通过

### Step 2.3: 调整 quality gate 的 alias 决策

**目标：**
- 只有 alias 冲突、未解析 speaker、低置信度等情况才进入人工审核

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/quality-stage.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- 唯一显式 alias 命中可 auto pass
- alias conflict / unresolved speaker 仍保持人工审核

### Step 2.4: 为缺失 `speaker` 写失败测试

**目标：**
- 固定“缺失 speaker 是结构错误，不是 `未知`”

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts --runInBand`
- Expected: FAIL，当前实现仍会静默补成 `未知`

**前进条件：**
- 失败测试明确命中 missing speaker 语义

### Step 2.5: 实现 missing speaker 进入 repair

**目标：**
- 让缺失 `speaker` 明确暴露为结构错误

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- 缺失 `speaker` 触发 repairable schema error
- 显式 `speaker: "未知"` 仍可被正常处理

---

## Phase 3: 重构 manual review 生命周期

### Step 3.1: 为 review item 覆盖和误关写失败测试

**目标：**
- 固定“同段不同失败签名不能互相覆盖”
- 固定“后续成功不能按 segment 粗粒度全关”

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: FAIL

**前进条件：**
- 至少包含两类失败签名共存测试
- 至少包含“部分成功不应关闭无关 review item”的测试

### Step 3.2: 引入 review item 失败签名

**目标：**
- 把 review item 身份从 segment 粗粒度改为失败签名粒度

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts --runInBand`
- Expected: PASS 一部分测试

**前进条件：**
- 不同签名的 review item 可以并存
- 同签名重复失败只更新对应项

### Step 3.3: 收紧 auto-resolve 规则

**目标：**
- 自动关闭只作用于匹配签名的 review item

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- 成功只会关闭对应签名 review item
- 历史无关待审项仍保持 pending

### Step 3.4: 修正 manual review summary 统计语义

**目标：**
- 把 `pending` 从“touched 数”改成“真实当前待处理总量”

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts`
- 必要时修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- summary 中不再出现语义冲突的 `pending=1, resolved=1`
- trace 和 workflow summary 使用同一套计数语义

---

## Phase 4: 提升 workflow 可观测性

### Step 4.1: 为逐次 stage prompt metadata 写失败测试

**目标：**
- 固定“workflow summary 必须保留逐次 stage metadata”

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: FAIL，当前仍按 `stageId` 覆盖

**前进条件：**
- 失败测试明确依赖 per-run metadata，而不是 latest metadata

### Step 4.2: 实现 per-run stage skill metadata

**目标：**
- 保留每次 stage run 的 prompt fingerprint / policy 信息

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- summary 能回放逐次 stage metadata
- latest 视图仍可读

---

## Phase 5: 建立真实 runtime/prompt 集成护栏

### Step 5.1: 新增真实 runtime 集成测试骨架

**目标：**
- 让真实 `skills/*/prompts`、`skill.toml`、contract、budget、parser 链路进入测试覆盖

**产出物：**
- 新建 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts`

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts --runInBand`
- Expected: FAIL，直到真实链路被覆盖并跑通

**前进条件：**
- 测试不 mock stage runner
- 只 fake adapter，不 fake runtime contract

### Step 5.2: 跑通真实 discovery / scripting / quality 基本链路

**目标：**
- 覆盖真实 bundle 加载和关键契约

**产出物：**
- 修改 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts`
- 必要时补辅助 fake adapter

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts --runInBand`
- Expected: PASS

**前进条件：**
- real prompt bundle 成功加载
- scripting / quality 至少有一条 happy path 跑通
- contract mismatch 用例可明确 fail

---

## Final Verification Gate

### Step F.1: 跑 agent-runtime 全量回归

**产出物：**
- 无新增代码，只产生一次完整验证记录

**验证方法：**
- Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__ --runInBand`
- Expected: PASS

**前进条件：**
- 全量 `agent-runtime` 测试通过

### Step F.2: 跑 typecheck

**产出物：**
- 无新增代码，只产生一次类型检查记录

**验证方法：**
- Run: `pnpm --filter web typecheck`
- Expected: PASS

**前进条件：**
- typecheck 通过

### Step F.3: 收口交付说明

**产出物：**
- 最终变更说明
- 每个 phase 的验证结果摘要
- 残余风险说明

**验证方法：**
- 人工检查文档与测试记录一致

**前进条件：**
- 交付内容可被执行者直接照单推进

---

## 推荐执行顺序

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Final Verification Gate

任何 phase 未通过，不得进入下一 phase。
