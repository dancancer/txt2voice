# Quote-Span Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提升失败段 refinement 对 attributed dialogue 与长 quoted span 的切片质量，降低真实样本中的 SCRIPT_VALIDATION 失败数。

**Architecture:** 不改上游 splitter，不改 validator，只增强 failed-segment refinement helper，让失败段能按语义切片后重试，并继续映射回父段统一落库。

**Tech Stack:** TypeScript、Next.js、Jest

---

### Task 1: 为 refinement helper 写 attributed dialogue / long quote 失败测试

**Files:**
- Modify: `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`

**Step 1: Write the failing test**

新增两类断言：
- `动作语 + 引号对白 + narration` 应拆成 3-4 个语义片段
- 长 quoted span 应按内部句界拆成多段

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts`
Expected: FAIL because current helper still保留过长 quoted span 或 narration 过碎

**Step 3: Write minimal implementation**

- 合并连续 narration slices
- 对 pure quoted long span 按内部句界拆分

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/failed-segment-refinement.test.ts apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts
git commit -m "feat: refine quoted script failure slices"
```

### Task 2: 保护 processor 回映射行为不回退

**Files:**
- Modify: `apps/web/src/lib/__tests__/segment-processor-refinement.test.ts`

**Step 1: Write the failing test**

为新的 refinement 结果增加断言：
- `segmentId` 仍回到父段
- `sourceStart/sourceEnd` 仍按父段坐标递增
- 仍只落库一次

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-processor-refinement.test.ts`
Expected: FAIL if new slice shape breaks parent remap

**Step 3: Write minimal implementation**

仅修正 remap 逻辑，不改变 broader semantics。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-processor-refinement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/segment-processor-refinement.test.ts apps/web/src/lib/script-generator/pipeline/segment-processor.ts
git commit -m "test: protect refined slice parent remapping"
```

### Task 3: 回归验证与 handoff

**Files:**
- Create: `docs/task/2026-03-13-phase-1-round-12-quote-span-refinement.md`
- Create: `docs/handoff/2026-03-13-phase-1-round-12-quote-span-refinement.md`

**Step 1: Write task and handoff docs**

记录本轮目标、验证命令与 remaining blockers。

**Step 2: Run broader verification**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/smart-text-splitter.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/audiobook-regression.test.ts && pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/task/2026-03-13-phase-1-round-12-quote-span-refinement.md docs/handoff/2026-03-13-phase-1-round-12-quote-span-refinement.md
git commit -m "docs: record quote-span refinement round"
```
