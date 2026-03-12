# Review Export Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `SCRIPT_VALIDATION` 的 review 展示与 CSV 导出复用同一套详情语义，并完成剩余中文化收口。

**Architecture:** 将脚本失败详情归一化逻辑下沉到 `lib` 共享 helper，UI 卡片与 CSV 导出共同消费。实现坚持 TDD：先写失败测试，再做最小实现，最后跑受影响回归、typecheck 和 build。

**Tech Stack:** TypeScript、Next.js、Jest

---

### Task 1: 抽共享脚本失败详情 helper

**Files:**
- Create: `apps/web/src/lib/script-validation-detail.ts`
- Modify: `apps/web/src/app/books/[id]/review/models/script-validation-detail.ts`
- Test: `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`

**Step 1: Write the failing test**

在 `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts` 增加断言，确保 helper 仍返回：

```ts
expect(detail).toMatchObject({
  subtypeLabel: "覆盖率不足",
  recommendedAction: "regenerate",
  recommendedActionLabel: "重生",
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
Expected: FAIL if shared helper has not been extracted or re-exported correctly

**Step 3: Write minimal implementation**

把当前归一化逻辑移动到共享文件，并让 app 侧 model 文件只负责转发：

```ts
export {
  buildScriptValidationDetailView,
  type ScriptValidationDetailView,
} from "@/lib/script-validation-detail";
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/script-validation-detail.ts apps/web/src/app/books/[id]/review/models/script-validation-detail.ts apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts
git commit -m "refactor: share script validation detail view"
```

### Task 2: 完成 review 卡片中文化收口

**Files:**
- Modify: `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
- Test: `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

**Step 1: Write the failing test**

在 `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx` 增加断言：

```ts
expect(html).toContain("问题代码");
expect(html).toContain("问题原文预览");
expect(html).toContain("段落原文预览");
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
Expected: FAIL because current headings are still English

**Step 3: Write minimal implementation**

把详情区标题改成中文：

```tsx
<p>问题代码</p>
<p>问题原文预览</p>
<p>段落原文预览</p>
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx
git commit -m "feat: localize script validation review detail"
```

### Task 3: 让 CSV 导出复用脚本失败详情

**Files:**
- Modify: `apps/web/src/lib/manual-review-service.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-service.test.ts`
- Reference: `apps/web/src/lib/script-validation-detail.ts`

**Step 1: Write the failing test**

在 `apps/web/src/lib/__tests__/manual-review-service.test.ts` 扩展 CSV 断言：

```ts
expect(csv).toContain("issueSubtypeLabel,recommendedAction,scriptSummary,scriptIssueMessages");
expect(csv).toContain("覆盖率不足");
expect(csv).toContain("重生");
expect(csv).toContain("原文覆盖率过低 | 尾部存在未覆盖内容");
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts`
Expected: FAIL because CSV does not include the new columns yet

**Step 3: Write minimal implementation**

在 `toManualReviewCsv()` 中只对 `SCRIPT_VALIDATION` 项复用共享 helper：

```ts
const scriptDetail =
  item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
    ? buildScriptValidationDetailView({
        issueSubtype: item.issueSubtype,
        issueDetail: item.issueDetail,
      })
    : null;
```

然后追加导出列：

```ts
 toExportCell(scriptDetail?.subtypeLabel || ""),
 toExportCell(scriptDetail?.recommendedActionLabel || ""),
 toExportCell(scriptDetail?.summary || ""),
 toExportCell(scriptDetail?.issueMessages.join(" | ")),
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/manual-review-service.ts apps/web/src/lib/__tests__/manual-review-service.test.ts apps/web/src/lib/script-validation-detail.ts
git commit -m "feat: align manual review csv with script detail"
```

### Task 4: 回归验证与文档收口

**Files:**
- Create: `docs/task/2026-03-12-phase-1-round-7-review-export-alignment.md`
- Create: `docs/handoff/2026-03-12-phase-1-round-7-review-export-alignment.md`
- Test: `apps/web/src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts`
- Test: `apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- Test: `apps/web/src/lib/__tests__/manual-review-service.test.ts`
- Test: `apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- Test: `apps/web/src/lib/__tests__/script-validation-review.test.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-script-subtype.test.ts`

**Step 1: Write the task and handoff docs**

记录本轮目标、范围、验收标准、验证命令、遗留问题。

**Step 2: Run targeted regression**

Run: `pnpm --filter web test -- --runInBand --runTestsByPath src/app/books/[id]/review/models/__tests__/script-validation-detail.test.ts src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
Expected: PASS

**Step 3: Run broader regression**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-script-subtype.test.ts`
Expected: PASS

**Step 4: Run typecheck and build**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/task/2026-03-12-phase-1-round-7-review-export-alignment.md docs/handoff/2026-03-12-phase-1-round-7-review-export-alignment.md
git commit -m "docs: record round 7 review export alignment"
```
