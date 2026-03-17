# Failed Segment Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `SCRIPT_VALIDATION` 失败段增加二次细分重跑能力，在不放宽 validator 的前提下提升真实样本通过率。

**Architecture:** 新增一个只服务失败段的细分 helper；首轮 segment 失败后，若 issue codes 命中边界漂移/漏抽类错误，则切成更小的子段再次调用现有 `processSegment`，成功后把子段结果映射回父段统一落库。

**Tech Stack:** TypeScript、Next.js、Jest

---

### Task 1: 写失败段细分 helper 与纯单测

**Files:**
- Create: `apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`
- Create: `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`

**Step 1: Write the failing test**

在 `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts` 里写最小断言：

```ts
expect(refineFailedSegment({
  segment: { id: 'seg-1', content: '张三说：“你好。”闵弘芳皱起眉头：“属下近日听得风响。”' },
  failure: { issueCodes: ['TEXT_SOURCE_MISMATCH', 'NON_WHITESPACE_GAP'] },
})).toEqual([
  expect.objectContaining({ content: '张三说：“你好。”' }),
  expect.objectContaining({ content: '闵弘芳皱起眉头：“属下近日听得风响。”' }),
]);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts`
Expected: FAIL because helper does not exist yet

**Step 3: Write minimal implementation**

实现：
- `shouldRefineSegmentFailure()`
- `refineFailedSegment()`
- 只切引号边界 / 句子边界 / 归属语边界

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts apps/web/src/lib/__tests__/failed-segment-refinement.test.ts
git commit -m "feat: add failed segment refinement helper"
```

### Task 2: 让 segment processor 对失败段执行二次细分重跑

**Files:**
- Modify: `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- Modify: `apps/web/src/lib/__tests__/segment-processor.test.ts`
- Reference: `apps/web/src/lib/script-generator/storage/persistence.ts`
- Reference: `apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`

**Step 1: Write the failing test**

在 `apps/web/src/lib/__tests__/segment-processor.test.ts` 增加用例：
- 首轮整段返回会触发 `SCRIPT_VALIDATION_FAILED`
- 二次切分后两个子段分别能通过 validator
- 最终返回父段 `dialogueLines`，且 `sourceStart/sourceEnd` 已回映射到父段坐标

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-processor.test.ts`
Expected: FAIL because processor does not retry refined subsegments yet

**Step 3: Write minimal implementation**

在 `processSegmentAndSave()` 中：
- 捕获首轮 `TTSError`
- 若 `shouldRefineSegmentFailure()` 命中，则对 synthetic 子段调用 `processSegment()`
- 合并子段 lines，修正 `segmentId/orderInSegment/sourceStart/sourceEnd`
- 仅对父段执行一次 `saveSegmentScriptToDatabase()`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-processor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/script-generator/pipeline/segment-processor.ts apps/web/src/lib/__tests__/segment-processor.test.ts
git commit -m "feat: retry script validation failures with refined subsegments"
```

### Task 3: 保护 workflow / runner 行为不回退

**Files:**
- Modify: `apps/web/src/lib/__tests__/script-workflow.test.ts`
- Modify: `apps/web/src/lib/__tests__/script-generation-runner.test.ts`

**Step 1: Write the failing test**

补充一条最小回归：当 refinement 成功时，不应把该父段计入 `failedSegmentIds`。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
Expected: FAIL if workflow / runner still treats refined-success segment as failed

**Step 3: Write minimal implementation**

如需要，仅修正统计与 summary 计算，不改 broader semantics。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/script-workflow.test.ts apps/web/src/lib/__tests__/script-generation-runner.test.ts
git commit -m "test: protect refined segment success accounting"
```

### Task 4: 回归验证与 closeout 更新

**Files:**
- Create: `docs/task/2026-03-13-phase-1-round-10-failed-segment-refinement.md`
- Create: `docs/handoff/2026-03-13-phase-1-round-10-failed-segment-refinement.md`
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`

**Step 1: Write task and handoff docs**

记录本轮目标、验证命令、风险与 closeout 影响。

**Step 2: Run targeted regression**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts`
Expected: PASS

**Step 3: Run broader verification**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts && pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS

**Step 4: Update closeout review**

将本轮结果写入 `docs/review/2026-03-12-phase-1-closeout.md`：
- 是否降低真实样本 `failed segments`
- 是否仍保持多次运行收敛

**Step 5: Commit**

```bash
git add docs/task/2026-03-13-phase-1-round-10-failed-segment-refinement.md docs/handoff/2026-03-13-phase-1-round-10-failed-segment-refinement.md docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: record phase 1 failed segment refinement"
```
