# Quote Tracker Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提取共享对白引号栈 helper，并让分句/细分链路复用同一套开闭规则。

**Architecture:** 新增一个轻量 helper，只负责对白引号对、栈更新与 inside-quote map；保留各业务模块自己的 span 提取与归属语判断。实现顺序按 TDD：先补 helper 失败测试，再接入三个消费者，最后跑整组回归测试。

**Tech Stack:** TypeScript, Jest, Next.js monorepo

---

### Task 1: Add failing tests for shared quote tracking

**Files:**
- Create: `apps/web/src/lib/__tests__/dialogue-quote-tracker.test.ts`

**Step 1: Write the failing test**

覆盖两个行为：
- `I'm here. It's done.` 不进入引号态
- `“你好。”她说。` 只在中文对白内部标记为引号内

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts`

Expected: FAIL，因为共享 helper 尚不存在。

**Step 3: Write minimal implementation**

新增共享 helper 文件，先只实现：
- `DIALOGUE_QUOTE_PAIRS`
- `updateDialogueQuoteStack`
- `buildInsideDialogueQuoteMap`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts`

Expected: PASS

### Task 2: Replace duplicated quote stack logic in consumers

**Files:**
- Create: `apps/web/src/lib/dialogue-quote-tracker.ts`
- Modify: `apps/web/src/lib/smart-text-splitter.ts`
- Modify: `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- Modify: `apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`

**Step 1: Wire `smart-text-splitter.ts` to the helper**

用共享 helper 替换本地：
- `QUOTE_PAIRS`
- `OPEN_QUOTE_MAP`
- `updateQuoteStack`
- `buildInsideQuoteMap`

保留 `CLOSING_QUOTE_PATTERN` 的业务特有括号规则。

**Step 2: Wire `segment-processor.ts` to the helper**

删除本地 quote pair / open-close map，仅保留句界与归属语规则，分句时调用共享 `updateDialogueQuoteStack`。

**Step 3: Wire `failed-segment-refinement.ts` to the helper**

同样删除本地 quote stack 重复实现，复用共享 helper。

**Step 4: Run focused tests**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/dialogue-quote-tracker.test.ts src/lib/__tests__/segment-processor-canonicalization.test.ts src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/smart-text-splitter.test.ts`

Expected: PASS

### Task 3: Verify broader regressions

**Files:**
- Modify: none
- Test: `apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- Test: `apps/web/src/lib/__tests__/segment-processor-canonicalization.test.ts`
- Test: `apps/web/src/lib/__tests__/segment-processor-refinement.test.ts`
- Test: `apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`
- Test: `apps/web/src/lib/__tests__/segment-script-validator.test.ts`
- Test: `apps/web/src/lib/__tests__/smart-text-splitter.test.ts`

**Step 1: Run the broader suite**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/segment-processor-canonicalization.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/smart-text-splitter.test.ts`

Expected: PASS

**Step 2: Inspect output**

确认：
- 无失败测试
- apostrophe 场景仍然通过
- quote-safe segmentation 与 refinement 现有断言未回归

**Step 3: Summarize the final diff**

记录：
- 哪些重复逻辑被删掉
- 哪些测试提供了回归保护
