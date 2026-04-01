# Review Regenerate Task Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让质检复核页直接显示当前书籍的人工复核重生任务进度与结果，避免用户只能跳去任务中心判断。

**Architecture:** 复用现有 `GET /api/tasks`，在复核页数据钩子里按 `bookId` 拉取最近任务，再基于 `metadata.source=manual_review/manual_review_batch` 过滤出人工复核触发的重生任务。页面新增一个轻量任务卡片，并把现有“同步复核与看板”动作扩展为同时刷新任务数据。

**Tech Stack:** Next.js App Router, React hooks, existing task API, Jest component/unit tests.

---

### Task 1: 定义复核页任务展示模型

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/models/types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

写一个组件测试，断言复核页任务卡片能展示：
- 任务类型标签
- 任务状态
- 进度条百分比
- `manual_review` / `manual_review_batch` 来源标签

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: FAIL，因为任务展示组件和类型还不存在。

**Step 3: Write minimal implementation**

在 `types.ts` 增加复核页使用的任务类型定义，保持字段仅包含 UI 必需数据。

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: PASS

### Task 2: 落地复核页最近重生任务卡片

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewRegenerateTaskList.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/page.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/view-models/tasks.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

让测试断言：
- 无任务时展示空态
- 有处理中任务时展示进度条
- 已完成/失败任务时展示结果消息

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: FAIL，组件尚未存在。

**Step 3: Write minimal implementation**

实现一个只负责渲染最近任务的组件，并在复核页接入。

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: PASS

### Task 3: 在复核页数据钩子中加载并刷新最近重生任务

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

扩展测试输入，覆盖：
- 只显示当前书籍且来源为 `manual_review` / `manual_review_batch` 的任务
- “同步复核与看板”后任务卡片数据能更新

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: FAIL，因为数据钩子还没提供任务数据。

**Step 3: Write minimal implementation**

在数据钩子中新增任务拉取和过滤逻辑，并把 `refreshAll` 扩展为同步刷新任务。

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

Expected: PASS

### Task 4: 回归验证并部署

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
npm test -- --runInBand src/lib/__tests__/manual-review-service.test.ts
npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts
```

Expected: 全部 PASS

**Step 2: Deploy to target host**

按仓库既有发布方式把当前改动部署到 `192.168.88.9:3001` 对应实例。

**Step 3: Verify live behavior**

针对书籍 `1e9adaa3-7e2c-405e-9443-87a20429e46f` 验证：
- 批量重生后复核项进入 `reprocessing`
- 复核页出现最近重生任务卡片
- 任务状态能体现 `processing/completed/failed`

