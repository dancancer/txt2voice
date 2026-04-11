# LLM Workflow Review Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前 LLM 工作流 review 中暴露出的正确性、状态语义、人工复核生命周期与可观测性问题，降低误判、误审和误报。

**Architecture:** 先修正会直接影响正确性的运行时决策，再统一 runtime state / telemetry 的语义，最后补强 manual review 生命周期和真实集成测试。修复以“消除特殊情况”为优先，尽量把“空发现”“别名命中”“同段多次失败”等情况纳入统一状态机，而不是继续靠额外分支兜底。

**Tech Stack:** TypeScript, Jest, Prisma runtime store, agent-runtime, Mastra runtime, prompt bundles under `skills/*/prompts`

---

## 问题分组

### A. 角色发现与角色归一化

- 空角色发现结果被误判为失败，导致 narration-heavy 或角色后置文本错误降级甚至直接失败。
- 自动姓名变体会把隐式 alias 注入强归一化链路，增加错误角色吸附风险。
- `alias_match` 被无条件升级为人工审核，吞吐量会被大量正常简称/别名击穿。

### B. Runtime 状态与观测语义

- `discovery_refresh` snapshot 复用了 bootstrap diagnostics，状态和历史执行不一致。
- workflow 级 `stageSkillMetadata` 只保留每个 stage 最后一条记录，无法回答“哪一段用了哪套 prompt”。
- `speaker` 缺失被静默补成 `未知`，结构错误被伪装成业务不确定性。

### C. Manual Review 生命周期

- 同段不同失败类型共用一条 review item，后一次失败会覆盖前一次证据。
- 任意一次成功都会批量关闭该段所有待审项，可能误关未真正解决的问题。
- `manualReviewSync.pending` 的实现语义错误，summary/trace 会上报自相矛盾的统计。

### D. 测试覆盖

- workflow 主测试以编排 mock 为主，无法证明真实 prompt bundle、contract、budget trimming、canonicalization 链路是通的。

---

### Task 1: 修正空角色发现语义

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

```ts
it("treats empty character discovery draft as no-op instead of failure", async () => {
  mockRunCharacterDiscoveryStage.mockResolvedValue({
    stageRunId: "discovery-1",
    status: "completed",
    artifact: createEmptyCharacterMemoryDraftArtifact(),
  } as any);

  const result = await runCharacterDiscoveryPass(/* ... */);

  expect(result.failure).toBeUndefined();
  expect(result.persistedCharacterCount).toBe(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts --runInBand`

Expected: FAIL，因为当前实现会返回 `CHARACTER_DISCOVERY_EMPTY_DRAFT`

**Step 3: Write minimal implementation**

- 删除“空 draft == failure”的判定。
- 将“空发现”建模为成功完成但 `persistedCharacterCount = 0` 的 no-op。
- 保留真正的 stage failure 作为 degraded / failed 判定依据。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/__tests__/character-discovery-pass.test.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "fix: treat empty character discovery as no-op"
```

### Task 2: 统一 discovery refresh snapshot 的状态语义

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

```ts
it("creates discovery refresh snapshots with matching source and diagnostics", () => {
  const snapshot = createDiscoveryRefreshCharacterMemorySnapshot(/* ... */);

  expect(snapshot.source).toBe("discovery_refresh");
  expect(snapshot.diagnostics.sampleCoverage.strategy).toBe("incremental");
  expect(snapshot.diagnostics.discoveryRunCount).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-store.test.ts --runInBand`

Expected: FAIL，因为当前 refresh snapshot 仍带有 bootstrap diagnostics

**Step 3: Write minimal implementation**

- 在 [store.ts](/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts) 增加显式 helper，例如 `createDiscoveryRefreshCharacterMemorySnapshot`。
- 让 refresh snapshot 的 `source`、`diagnostics.discoveryRunCount`、`sampleCoverage.strategy`、`lastDiscoveryAt` 同步更新。
- 替换 workflow 中两处手工展开 bootstrap snapshot 的写法。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/character-memory-store.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/__tests__/character-memory-store.test.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "fix: align discovery refresh snapshot diagnostics"
```

### Task 3: 降低 alias 误判并把别名命中从硬闸门改成风险信号

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/character-name-variations.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`
- Modify: `apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: Write the failing test**

```ts
it("does not force manual review for a uniquely resolved explicit alias", async () => {
  const result = await runMastraQualityStage({
    /* alias_match but no unresolved speaker / no alias conflict */
  });

  expect(result.status).toBe("completed");
  expect(result.decision).toBe("auto_pass");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts --runInBand`

Expected: FAIL，因为当前 alias 命中会直接 `manual_review_required`

**Step 3: Write minimal implementation**

- 收紧 [character-name-variations.ts](/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-name-variations.ts) 的变体生成规则，默认不再把“去首字/去尾字”直接当强 alias。
- 如果仍保留启发式变体，必须和显式 alias 区分来源，不能直接进入强 canonical map。
- quality stage 只在以下情况触发人工审核：
  - alias 冲突
  - unresolved speaker
  - 低分 / 低置信度
  - 强制人工审核信号
- 唯一且无冲突的显式 alias 命中应允许自动通过。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/quality-stage.test.ts src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/character-name-variations.ts apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts apps/web/src/lib/agent-runtime/__tests__/character-memory-canonicalize.test.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git commit -m "fix: reduce alias false positives in quality gate"
```

### Task 4: 把缺失 speaker 重新定义为结构错误，而不是静默降级

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`

**Step 1: Write the failing test**

```ts
it("routes missing speaker to repair instead of defaulting to 未知", async () => {
  await expect(agent.execute(/* line without speaker */)).rejects.toThrow(
    /speaker/
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts --runInBand`

Expected: FAIL，因为当前实现会补成 `未知`

**Step 3: Write minimal implementation**

- 去掉 `script-generation-agent.ts` 中 `speaker ?? "未知"` 的静默兜底。
- 让缺失 speaker 成为结构错误，进入 repair 路径。
- 保留 `未知` 只作为模型显式输出、且后续校验接受的业务值。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts
git commit -m "fix: treat missing speaker as repairable schema error"
```

### Task 5: 重构 manual review item 身份与关闭规则

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

```ts
it("keeps distinct review items for different failure signatures on the same segment", async () => {
  await syncRuntimeManualReviewItems(/* validation failure */);
  await syncRuntimeManualReviewItems(/* quality manual review failure */);

  expect(mockPrisma.manualReviewItem.create).toHaveBeenCalledTimes(2);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`

Expected: FAIL，因为当前逻辑会按 segment 粗粒度覆盖/关闭

**Step 3: Write minimal implementation**

- 为 review item 引入更细粒度的匹配键：
  - 至少包含 `segmentId + scriptSubtype + errorCode`
  - 如有必要，再补 `issueCodes` 指纹
- 自动关闭时只关闭“与本次成功对应的同签名待审项”，不要按 segment 全扫。
- 将 summary 字段语义拆清：
  - `touched` 或 `upserted`
  - `resolved`
  - `pendingCount` 表示真实当前待处理总量

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/__tests__/manual-review-handoff-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "fix: preserve manual review item identity and counters"
```

### Task 6: 提升 workflow 级 prompt 可观测性

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts`
- Test: `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

```ts
it("records stage skill metadata per stage run instead of overwriting by stage id", async () => {
  const result = await runScriptProductionWorkflow(/* multi-segment */);

  expect(result.runtimeMetadata?.summary.stageSkillMetadataIndex).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ stageId: "segment_scripting", segmentId: "seg-1" }),
      expect.objectContaining({ stageId: "segment_scripting", segmentId: "seg-2" }),
    ])
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`

Expected: FAIL，因为当前只保留每个 stage 的最后一条 metadata

**Step 3: Write minimal implementation**

- 将 `stageSkillMetadata` 从 `Record<stageId, metadata>` 改为数组或 `Record<stageRunId, metadata>`。
- 每条记录至少带上 `stageRunId`、`stageId`、可选 `segmentId`。
- workflow summary 继续保留可读聚合，但不能丢掉逐次运行信息。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "feat: preserve per-run prompt metadata in workflow summary"
```

### Task 7: 增加真实 runtime/prompt 集成测试

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Modify: `apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Modify: `apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Create: `apps/web/src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts`

**Step 1: Write the failing test**

```ts
it("loads real prompt bundle and validates runtime contract end-to-end", async () => {
  const result = await runSegmentScriptingStage({
    workspaceRoot: process.cwd(),
    adapter: fakeAdapterReturningValidJson,
    /* real skill bundle */
  });

  expect(result.status).toBe("completed");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts --runInBand`

Expected: FAIL，直到真实 bundle / contract / budget / parsing 链路被纳入覆盖

**Step 3: Write minimal implementation**

- 使用真实 `skills/*/prompts` 与 `skill.toml`。
- fake adapter 只替代外部模型调用，不 mock stage runner。
- 覆盖至少以下路径：
  - discovery 正常完成
  - scripting 正常完成
  - quality 在 alias 无冲突时自动通过
  - prompt variable 缺失 / contract mismatch 会明确失败

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts
git commit -m "test: add real runtime prompt integration coverage"
```

---

## 总体验证

在所有任务完成后运行：

```bash
pnpm --filter web test -- src/lib/agent-runtime/__tests__ --runInBand
pnpm --filter web test -- src/lib/agent-runtime/__tests__/workflow-runtime-integration.test.ts --runInBand
pnpm --filter web typecheck
```

预期：

- `agent-runtime` 全量测试通过
- 新增真实 runtime 集成测试通过
- typecheck 通过

---

## 交付顺序建议

1. Task 1 + Task 2：先修状态语义错误，避免 workflow 继续误报 failed / degraded。
2. Task 3 + Task 4：再修 speaker / alias 归一化，降低错误人工审核。
3. Task 5：最后修 manual review 生命周期，避免误关和证据覆盖。
4. Task 6 + Task 7：补强观测和测试，把这次 review 暴露的问题转成长期护栏。

---

## 非目标

- 不在这次修复中重写 prompt 文案风格，只修正 prompt 与 runtime 契约失配处。
- 不重做整个 manual review 数据模型，只在现有表结构允许范围内先修正匹配键与统计语义。
- 不引入新的 workflow engine 或新的持久化后端。
