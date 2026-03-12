# Review Recommended Action Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `SCRIPT_VALIDATION` 复核项增加按推荐动作筛选的能力，并保证分页、导出、列表展示语义一致。

**Architecture:** 在共享脚本失败 helper 中增加推荐动作逆向映射，服务端基于该映射执行查询过滤，前端过滤条只负责展示与拼装 query。实现坚持 TDD，先写失败测试，再做最小实现。

**Tech Stack:** TypeScript、Next.js、Jest

---

### Task 1: 扩展共享推荐动作 helper

**Files:**
- Modify: `apps/web/src/lib/script-validation-detail.ts`
- Test: `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`

**Step 1: Write the failing test**

为共享 helper 增加动作标签/逆向映射断言，例如：

```ts
expect(listScriptValidationSubtypesByRecommendedAction("regenerate")).toContain("COVERAGE");
expect(getScriptValidationRecommendedActionLabel("regenerate")).toBe("重生");
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
Expected: FAIL because helper does not export these APIs yet

**Step 3: Write minimal implementation**

新增推荐动作选项、标签 helper 和逆向映射 helper。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/script-validation-detail.ts apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts
git commit -m "feat: expose script recommended action metadata"
```

### Task 2: 服务端支持 recommendedAction 查询

**Files:**
- Modify: `apps/web/src/lib/manual-review-service.ts`
- Modify: `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`
- Modify: `apps/web/src/lib/__tests__/manual-review-service.test.ts`

**Step 1: Write the failing test**

扩展测试：

```ts
const query = parseManualReviewQuery(
  new URLSearchParams("issueType=SCRIPT_VALIDATION&recommendedAction=regenerate")
);
expect(query.recommendedAction).toBe("regenerate");
```

并断言服务端 where 会把 `regenerate` 翻译成 subtype OR 查询。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/manual-review-service.test.ts`
Expected: FAIL because query parser and filtering do not support `recommendedAction` yet

**Step 3: Write minimal implementation**

- 扩展 query / export query 解析
- 扩展 `buildListWhere()`
- 让 `formatManualReviewItem()` 返回 `recommendedAction` 与 `recommendedActionLabel`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/manual-review-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/manual-review-service.ts apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts apps/web/src/lib/__tests__/manual-review-service.test.ts
git commit -m "feat: add manual review recommended action filter"
```

### Task 3: 前端过滤条接入 recommendedAction

**Files:**
- Modify: `apps/web/src/app/books/[id]/review/models/types.ts`
- Modify: `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
- Modify: `apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
- Modify: `apps/web/src/app/books/[id]/review/page.tsx`
- Create: `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`

**Step 1: Write the failing test**

新增 `ReviewQueuePanel` 渲染测试，断言脚本问题视角会出现“推荐动作”筛选项。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`
Expected: FAIL because filter bar has no recommended action control yet

**Step 3: Write minimal implementation**

- 扩展 filter state
- 在 `issueType === SCRIPT_VALIDATION` 时显示推荐动作下拉
- 将 `recommendedAction` 带入 query params / export params

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/review/models/types.ts apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx apps/web/src/app/books/[id]/review/page.tsx apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx
git commit -m "feat: add review recommended action filter"
```

### Task 4: Round 8 文档与回归验证

**Files:**
- Create: `docs/task/2026-03-12-phase-1-round-8-review-recommended-action-filter.md`
- Create: `docs/handoff/2026-03-12-phase-1-round-8-review-recommended-action-filter.md`
- Test: `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
- Test: `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- Test: `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx`
- Test: `apps/web/src/lib/__tests__/manual-review-service.test.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`
- Test: `apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- Test: `apps/web/src/lib/__tests__/script-validation-review.test.ts`

**Step 1: Write the task and handoff docs**

记录本轮目标、风险、验证命令、遗留问题。

**Step 2: Run targeted regression**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx src/app/books/[id]/review/components/__tests__/ReviewQueuePanel.test.tsx src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
Expected: PASS

**Step 3: Run broader regression**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts`
Expected: PASS

**Step 4: Run typecheck and build**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/task/2026-03-12-phase-1-round-8-review-recommended-action-filter.md docs/handoff/2026-03-12-phase-1-round-8-review-recommended-action-filter.md
git commit -m "docs: record round 8 recommended action filter"
```
