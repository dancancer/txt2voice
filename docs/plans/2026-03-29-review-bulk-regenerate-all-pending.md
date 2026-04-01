# Review Bulk Regenerate All Pending Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为质检复核工作台新增“重生全部待复核”能力，允许当前书籍下所有 `pending` 复核项一键触发批量重生。

**Architecture:** 后端新增一个全书级 review service 与专用 route，由服务端自己查询全部 `pending` 复核项并按脚本/音频两类拆分成最多两个任务。前端在筛选条新增入口，直接调用新接口并刷新复核列表、SLO 和最近重生任务区域。

**Tech Stack:** Next.js App Router, React, Tailwind, Prisma, existing review service and task queue, Jest.

---

### Task 1: 定义全量待复核重生服务契约

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/manual-review-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/manual-review-service.test.ts`

**Step 1: Write the failing test**

补 service 测试覆盖：
- 只有 `SCRIPT_VALIDATION` 待复核项时，创建一个脚本任务
- 只有音频待复核项时，创建一个音频任务
- 两类混合时，允许同时创建两个任务
- 没有 pending 项时失败
- 缺少 `segmentId` / `sentenceId` 时失败

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/lib/__tests__/manual-review-service.test.ts' --runInBand`

Expected: FAIL，因为还没有全量待复核重生服务。

**Step 3: Write minimal implementation**

- 在 `manual-review-service.ts` 新增全量重生服务
- 复用现有 `ensureNoActiveScriptTask` / `ensureNoActiveAudioTask`
- 复用现有 task enqueue 逻辑
- 新增统一返回结构：`reviewItemCount / processedCount / scriptTask / audioTask`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/lib/__tests__/manual-review-service.test.ts' --runInBand`

Expected: PASS

### Task 2: 暴露全量待复核重生 API

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/review/items/regenerate-all-pending/route.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/manual-review-service.test.ts`

**Step 1: Write the failing test**

至少覆盖 route 层成功调用 service 并返回 JSON 成功结构。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/lib/__tests__/manual-review-service.test.ts' --runInBand`

Expected: FAIL，因为 route 尚不存在。

**Step 3: Write minimal implementation**

- 新增 route 文件
- 调用全量重生服务
- 返回标准成功响应

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/lib/__tests__/manual-review-service.test.ts' --runInBand`

Expected: PASS

### Task 3: 接入工作台动作 hook

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchActions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/models/types.ts`

**Step 1: Write the failing test**

补前端测试覆盖：
- hook 暴露 `regenerateAllPendingItems`
- 调用成功后刷新 review / slo / task
- loading 状态可追踪

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx' --runInBand`

Expected: FAIL，因为当前没有全量待复核重生动作。

**Step 3: Write minimal implementation**

- 在 actions hook 中新增全量重生动作与 loading 状态
- 在 data hook 中向页面暴露该动作和状态
- 如有必要补响应类型

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx' --runInBand`

Expected: PASS

### Task 4: 在筛选条增加“重生全部待复核”入口

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/page.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx`

**Step 1: Write the failing test**

覆盖：
- 按钮显示 `pending` 数量
- `pending=0` 时禁用
- loading 时显示处理中状态

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx' --runInBand`

Expected: FAIL，因为当前筛选条没有这个入口。

**Step 3: Write minimal implementation**

- 在 `ReviewFilterBar` 新增按钮和 props
- 在页面层把 `summary.pendingCount`、动作和 loading 传进去
- 保持现有“批量重生选中项”不变

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec jest --runTestsByPath 'src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx' --runInBand`

Expected: PASS

### Task 5: 回归验证

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
pnpm --filter web exec jest --runTestsByPath 'src/lib/__tests__/manual-review-service.test.ts' 'src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx' 'src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx' --runInBand
```

Expected: PASS

**Step 2: Run typecheck**

Run: `pnpm --filter web typecheck`

Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-03-29-review-bulk-regenerate-all-pending-design.md docs/plans/2026-03-29-review-bulk-regenerate-all-pending.md apps/web/src/app/books/[id]/review apps/web/src/app/api/books/[id]/review/items/regenerate-all-pending/route.ts apps/web/src/lib/manual-review-service.ts apps/web/src/lib/__tests__/manual-review-service.test.ts
git commit -m "feat: bulk regenerate all pending review items"
```
