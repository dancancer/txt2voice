# Quote-Safe Segmentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 smart splitter 在引号对白内部断句的问题，避免上游生成残缺 segment，降低 Phase 1 真实样本的 SCRIPT_VALIDATION 失败数。

**Architecture:** 不改风险画像，只在 sentence splitting 与 force split 阶段引入 quote-safe 边界判断。现有 text processor、validator、refinement 继续复用更健康的 segment 输入。

**Tech Stack:** TypeScript、Next.js、Jest

---

### Task 1: 为 smart splitter 写引号安全断句测试

**Files:**
- Modify: `apps/web/src/lib/__tests__/smart-text-splitter.test.ts`

**Step 1: Write the failing test**

新增用例，证明对话内部标点不会造成引号中间断句：

```ts
const text = '“宁大哥，宁大爷！行行好，您嗦的那皮儿能扔碗里不？”宁尘眼也不睁，脸上挂起笑：“瞧您说的！您耿老大都发话了，我能下这面子吗。”'.repeat(4)
const segments = splitTextSmartly(text, { targetLength: 40, maxLength: 80, minLength: 20 })
expect(segments.some((segment) => segment.content.includes('“宁大哥，宁大爷！行行好，您嗦的那皮儿能扔碗里不？”'))).toBe(true)
expect(segments.some((segment) => segment.content.includes('“瞧您说的！您耿老大都发话了，我能下这面子吗。”'))).toBe(true)
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/smart-text-splitter.test.ts`
Expected: FAIL because current splitter breaks inside quoted speech

**Step 3: Write minimal implementation**

在 sentence splitting 逻辑里加入 quote stack，只有引号闭合后才允许在句界断开。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/smart-text-splitter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/smart-text-splitter.test.ts apps/web/src/lib/smart-text-splitter.ts
git commit -m "fix: avoid splitting quoted dialogue mid-sentence"
```

### Task 2: 为 text processor 写残缺引号段回归测试

**Files:**
- Modify: `apps/web/src/lib/__tests__/text-processor-script-correctness.test.ts`
- Modify: `apps/web/src/lib/text-processor.ts` (only if needed for metadata/assertion support)

**Step 1: Write the failing test**

新增一个 chapter content，用 `createChapterSegmentRecords()` 断言不会产生以右引号结尾的残缺对白尾巴：

```ts
const content = `第一章\n\n${syntheticText}`
const result = createChapterSegmentRecords('book-1', content, { maxSegmentLength: 120, minSegmentLength: 40, preserveFormatting: true })
expect(result.segmentRecords.some((segment) => /[^“"「『][”"」』]\s*$/.test(segment.content.trim()) && !segment.content.includes('“'))).toBe(false)
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/text-processor-script-correctness.test.ts`
Expected: FAIL if current segmentation still produces orphaned quoted tails

**Step 3: Write minimal implementation**

如果 smart splitter 修复已足够，则无需额外修改 text processor；仅保持测试通过。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/text-processor-script-correctness.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/text-processor-script-correctness.test.ts apps/web/src/lib/smart-text-splitter.ts apps/web/src/lib/text-processor.ts
git commit -m "test: protect quote-safe text segmentation"
```

### Task 3: 回归验证与 closeout 更新

**Files:**
- Create: `docs/task/2026-03-13-phase-1-round-11-quote-safe-segmentation.md`
- Create: `docs/handoff/2026-03-13-phase-1-round-11-quote-safe-segmentation.md`
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`

**Step 1: Write task and handoff docs**

记录本轮目标、验证命令、风险与 closeout 影响。

**Step 2: Run targeted regression**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/smart-text-splitter.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts`
Expected: PASS

**Step 3: Run broader verification**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audiobook-regression.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts && pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS

**Step 4: Update closeout review**

记录 quote-safe segmentation 后，真实样本 `failed segments / pending review` 是否下降。

**Step 5: Commit**

```bash
git add docs/task/2026-03-13-phase-1-round-11-quote-safe-segmentation.md docs/handoff/2026-03-13-phase-1-round-11-quote-safe-segmentation.md docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: record quote-safe segmentation validation"
```
