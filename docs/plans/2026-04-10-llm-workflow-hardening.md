# LLM Workflow Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前 LLM workflow 中四个高风险断点，确保 quality gate 不会在证据缺失时自动放行、speaker canonical 约束不会被静默吞掉、character discovery 的失败语义与 repair policy 一致、空 discovery 结果不会继续伪装成成功。

**Architecture:** 本次整改不改主链拓扑，仍保持 `character_discovery -> segment_scripting -> segment_repair -> quality_judgement -> persist`。修复重点放在运行时护栏：一条线把“裁剪过核心证据”的 case 强制降级成人审；一条线把 alias/canonical 违规从“自动修正”改成“显式暴露”；另一条线统一 character discovery 的失败、重试和 degraded 语义；最后用测试把这些行为钉死，避免后续 prompt 或 runtime 小改动再次静默退化。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Mastra runtime, Prisma-backed persistence.

---

## 执行总原则

1. 先修静默放行，再修体验问题。
2. 不新增新的隐式修正分支，优先把问题暴露成明确决策信号。
3. 所有“metadata 写了但 runtime 没执行”的地方，都要么落实，要么删掉。
4. quality gate 的默认策略必须是保守，而不是在证据残缺时继续自动通过。
5. 每个任务必须先写失败测试，再做最小实现，再跑回归。

---

### Task 1: 阻止 quality gate 在核心证据被裁剪后自动通过

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定“核心证据一旦被裁剪就不能 auto_pass”**

**产出：**
- 在 `quality-stage.test.ts` 增加用例，构造超长：
  - `segmentScriptDraft`
  - `validationReport`
  - `characterResolutionEvidence`
- 断言当 `fitPromptToBudget(...).trimmedKeys` 包含以上任一核心证据字段时，stage 最终决策必须是 `manual_review_required`，不能是 `auto_pass`。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL，当前实现仍可能返回 `auto_pass`

**Step 2: 在 quality runtime 中区分“预算可容纳”和“证据已被裁剪”**

**产出：**
- 在 `run-mastra-quality-stage.ts` 增加核心字段集合，例如：
  - `segment_script_draft_json`
  - `validation_report_json`
  - `character_resolution_evidence_json`
- 如果 `trimmedKeys` 命中这些字段，即使 `overBudget === false`，也直接返回：
  - `decision: "manual_review_required"`
  - 明确 `reasons`，例如 `quality_core_evidence_trimmed`
- 保留现有 `overBudget` 兜底逻辑，但让它成为更晚的兜底，而不是唯一护栏。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 3: 增加回归测试，确保非核心字段裁剪时仍允许走 LLM judgement**

**产出：**
- 补一个正向用例：只裁剪 `failed_artifact_json` 或 `quality_signals_json` 时，stage 仍可继续走 quality agent，并保留当前 decision 逻辑。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 4: 任务收口**

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git commit -m "fix: block auto pass when quality evidence is trimmed"
```

---

### Task 2: 让 canonical speaker 违规变成显式质量信号，而不是 runtime 静默吞掉

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定 alias 输出不能在 quality 前被完全洗白**

**产出：**
- 在 `segment-scripting-stage.test.ts` 增加用例：
  - LLM 原始输出 speaker 为 alias
  - memory 中 alias 可解析到 canonical
- 断言 runtime 必须保留“发生过 alias canonicalization”的证据，而不是只返回改写后的 draft。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: FAIL

**Step 2: 给 character resolution evidence 增加可判责信号**

**产出：**
- 在 `canonicalize.ts` 的 evidence 中新增一个可稳定消费的字段，例如：
  - `aliasMatchCount`
  - 或 `canonicalizationViolations`
- 该字段必须反映“模型原始输出不是 canonical，但 runtime 帮它修正了”。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**Step 3: 调整 quality decision，让 alias canonicalization 至少降级为人工复核**

**产出：**
- 在 `run-mastra-quality-stage.ts` 的 `resolveSemanticDecision(...)` 中新增条件：
  - 如果 evidence 显示 alias 被 runtime 修正过，则不能 `auto_pass`
  - 推荐直接 `manual_review_required`
- 保持 `unresolvedSpeakers` 和 `aliasConflicts` 的现有逻辑不变，新增的是“alias 修正本身也是风险信号”。

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL 后转 PASS

**Step 4: 明确 finalize 阶段只在 evidence 持久化后再落盘 canonicalized draft**

**产出：**
- 检查并补测试，保证：
  - quality 看到的是 canonicalized draft
  - 但 evidence 能明确告诉我们这个 canonicalized draft 是否依赖 runtime 修正

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git commit -m "fix: surface alias canonicalization in quality gate"
```

---

### Task 3: 让 character discovery 的 repair policy 与实际 runtime 行为一致

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/skill.toml`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

**Step 1: 先决定策略，只能二选一**

**推荐方案：**
- 真正实现 `retry-on-json-parse`

**备选方案：**
- 删除 `skill.toml` 里的 `retry-on-json-parse`，改成与现状一致的 policy

**推荐理由：**
- 其它 stage 已经有 parse failure -> repairing 的运行时语义；让 character discovery 单独硬失败，既不一致，也更难排查。

**Step 2: 写失败测试，固定 character discovery 的 parse failure 语义**

**产出：**
- 在 `character-discovery-stage.test.ts` 增加用例：
  - adapter 返回非 JSON
  - adapter 返回缺字段 JSON
- 期望：
  - stage 不应只给一个裸失败字符串
  - 至少要有 `retrying` 或 `repairing` 语义
  - 并且保留原始响应上下文

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: FAIL

**Step 3: 给 character-discovery-agent 增加失败上下文封装**

**产出：**
- 参考 `script-generation-agent.ts` / `repair-agent.ts`
- 在 parse/schema 校验失败时抛出带 `output.failedArtifact` 的错误
- 至少保留：
  - `rawResponse`
  - `provider`
  - `model`
  - `message`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS 一部分断言

**Step 4: 给 discovery stage 加 `resolveFailure` 语义**

**产出：**
- 在 `run-mastra-character-discovery-stage.ts` 为可恢复错误配置 `resolveFailure`
- 最小实现可以先支持：
  - `Invalid character discovery payload`
  - `canonicalIdentities must be an array`
  - `aliasEvidence must be an array`
- 这些错误应返回 `retrying`，而不是直接 `failed`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS

**Step 5: 对齐 skill metadata**

**产出：**
- 如果 runtime 已实现 retry 语义，则保留 `repairPolicy = "retry-on-json-parse"`
- 如果最终不实现，则必须修改 `skill.toml`，删除误导性 metadata

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery-stage.ts apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts skills/character-extraction/skill.toml apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts
git commit -m "fix: align character discovery repair policy with runtime"
```

---

### Task 4: 把“空 discovery 结果”从静默成功改成可观测退化

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: 写失败测试，固定“completed + 空 draft”必须发出 degraded/failure 信号**

**产出：**
- 在 `character-discovery-pass.test.ts` 增加用例：
  - discovery stage 返回 `completed`
  - 但 `characterMemoryDraft` 为空
- 期望：
  - 不能只是 `{ persistedCharacterCount: 0 }`
  - 必须带明确 failure 或 degraded 原因

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Expected: FAIL

**Step 2: 定义空结果的语义**

**推荐方案：**
- 在 `run-character-discovery-pass.ts` 中把空 draft 视作一个明确 failure：
  - `errorCode: "CHARACTER_DISCOVERY_EMPTY_DRAFT"`
  - `retryable: false`

**替代方案：**
- 扩展返回类型，新增 `degradedReason`

**推荐理由：**
- 改动小，且现有 workflow 已经有处理 `failure` -> `degradedMode` 的通道。

**Step 3: 修改 workflow 聚合逻辑，让空结果进入观测面板**

**产出：**
- 在 `run-script-production-workflow.ts` 中保证：
  - `characterDiscoveryStatus` 不再记成 `completed`
  - `workflowIssues` 会记录 `CHARACTER_DISCOVERY_EMPTY_DRAFT`
  - `degradedMode` 会被置位

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: FAIL 后转 PASS

**Step 4: 回归 character discovery pass 及 workflow 汇总**

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "fix: surface empty character discovery as degraded state"
```

---

### Task 5: 全链路回归与风险兜底

**Files:**
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: 跑定向测试集**

```bash
pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
```

**Expected:**
- 全绿

**Step 2: 如果仓库已有更大粒度的 runtime 回归，补跑一次**

```bash
pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts
```

**Expected:**
- PASS

**Step 3: 手工检查输出行为**

**检查项：**
- quality 核心证据裁剪后是否必转人工复核
- alias speaker 是否仍能在 evidence 中暴露
- character discovery 坏 JSON 是否保留失败上下文
- 空 discovery 是否进入 degraded/workflow issues

**Step 4: 汇总变更并提交**

```bash
git add apps/web/src/lib/agent-runtime docs/plans/2026-04-10-llm-workflow-hardening.md skills/character-extraction/skill.toml
git commit -m "docs: add llm workflow hardening plan"
```

