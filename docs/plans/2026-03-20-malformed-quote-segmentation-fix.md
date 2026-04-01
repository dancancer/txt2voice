# Malformed Quote Segmentation Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix smart text segmentation so malformed Chinese quotes like `……“` do not poison quote tracking and collapse the remainder of a chapter into one oversized final segment.

**Architecture:** Tighten quote tracking at the source by letting an opening quote character act as a malformed closing quote when its matching close is already expected on the stack. Add a small splitter guard so dynamic-programming segmentation does not emit an oversized final segment when sentence detection drifts.

**Tech Stack:** TypeScript, Jest, Next.js shared library code

---

### Task 1: Reproduce malformed-quote tracking failure

**Files:**
- Modify: `apps/web/src/lib/__tests__/dialogue-quote-tracker.test.ts`
- Modify: `apps/web/src/lib/__tests__/smart-text-splitter.test.ts`

**Step 1: Write the failing test**
- Add a quote-tracker test proving text after `“我，我没事……“` should no longer be treated as inside dialogue.
- Add a splitter test proving repeated malformed closing quotes do not collapse into one oversized final segment.

**Step 2: Run test to verify it fails**
Run: `npm test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts src/lib/__tests__/smart-text-splitter.test.ts`
Expected: FAIL on malformed-quote cases.

### Task 2: Fix quote tracking at the source

**Files:**
- Modify: `apps/web/src/lib/dialogue-quote-tracker.ts`
- Test: `apps/web/src/lib/__tests__/dialogue-quote-tracker.test.ts`

**Step 1: Write minimal implementation**
- When the current char is an opening quote but the top of the stack already expects its matching closing quote, treat it as a malformed close and pop instead of pushing a new quote frame.
- Keep ASCII symmetric quote handling unchanged.

**Step 2: Run test to verify it passes**
Run: `npm test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts`
Expected: PASS.

### Task 3: Add splitter-level oversized final-segment guard

**Files:**
- Modify: `apps/web/src/lib/smart-text-splitter.ts`
- Test: `apps/web/src/lib/__tests__/smart-text-splitter.test.ts`

**Step 1: Write minimal implementation**
- In sentence-DP segmentation, do not accept a plan segment that exceeds `maxLength`, even if it is the last segment.
- Let the splitter fall back to the existing lower-level path when DP cannot produce a bounded plan.

**Step 2: Run test to verify it passes**
Run: `npm test -- --runInBand src/lib/__tests__/smart-text-splitter.test.ts`
Expected: PASS.

### Task 4: Verify regression surface

**Files:**
- Existing tests only

**Step 1: Run focused regression suite**
Run: `npm test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts src/lib/__tests__/smart-text-splitter.test.ts src/lib/__tests__/text-splitter.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts`
Expected: PASS.

**Step 2: Run typecheck**
Run: `npm run typecheck`
Expected: PASS.

### Task 5: Redeploy remote runtime and verify target book

**Files:**
- Modify runtime only

**Step 1: Sync changed files to remote**
- `apps/web/src/lib/dialogue-quote-tracker.ts`
- `apps/web/src/lib/smart-text-splitter.ts`
- related tests are local only

**Step 2: Restart remote web runtime**
- Regenerate Prisma only if schema changed; otherwise just restart web.

**Step 3: Verify target book**
- Re-run text processing or the minimal book reprocess path for `1e9adaa3-7e2c-405e-9443-87a20429e46f`.
- Confirm no segment returns a 20k+ final segment.
