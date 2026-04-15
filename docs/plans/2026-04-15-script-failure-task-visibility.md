# Script Failure Task Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让质检模块直接展示当前书籍最近的台本失败与重生任务，并让 Studio 段落一键跳到对应的最近失败任务记录。

**Architecture:** 继续复用 `/api/tasks?bookId=...` 作为任务数据源，在 review 数据转换层放宽筛选，纳入失败脚本任务并按 `updatedAt` 倒序排序；同时在 Studio 页面增加只读任务映射，把段落和最近失败任务卡片锚点连接起来。任务模型与人工复核模型保持分层，不做混排队列。

**Tech Stack:** Next.js App Router, React hooks, existing task API, existing review workbench, Jest unit/component tests.

---

### Task 1: 扩展 review 任务模型，纳入失败脚本任务

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/models/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData-helpers.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

在 `ReviewRegenerateTaskList.test.tsx` 增加数据转换场景，断言：
- `SCRIPT_GENERATION + failed + failedSegmentDetails` 的任务会被纳入
- 新任务来源标签为失败任务
- 任务保留 `updatedAt`、段落号、阶段、错误码、失败说明

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: FAIL，因为当前转换层只接受 `manual_review*` 来源。

**Step 3: Write minimal implementation**

在 `types.ts` 扩展 `ReviewRegenerateTask`：
- 增加失败摘要字段
- 增加可选段落映射字段

在 `useReviewWorkbenchData-helpers.ts`：
- 放宽 `toRegenerateTask` 的纳入条件
- 优先从 `segmentIds` / `failedSegmentDetails[].segmentId` / `failedSegmentIds` 提取段落关联
- 为失败任务生成 `source = "script_failure"`

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/review/models/types.ts \
  apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData-helpers.ts \
  apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
git commit -m "feat: include failed script tasks in review task model"
```

### Task 2: 更新质检任务卡片，展示失败摘要并提供锚点

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewRegenerateTaskList.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

让组件测试断言：
- 卡片标题改成更宽语义
- 任务按失败/重生来源展示正确标签
- 失败任务展示“段落 N / stage / errorCode / message”
- 外层容器带 `id="task-<taskId>"`

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: FAIL，因为当前组件没有失败摘要区，也没有锚点。

**Step 3: Write minimal implementation**

在 `ReviewRegenerateTaskList.tsx`：
- 调整标题与说明文案
- 增加 `script_failure` 来源标签
- 在卡片中渲染失败摘要区
- 为每张卡片添加稳定锚点 ID

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/review/components/ReviewRegenerateTaskList.tsx \
  apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
git commit -m "feat: show failed script summaries in review task cards"
```

### Task 3: 让 review 数据钩子按 updatedAt 倒序加载任务

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx`

**Step 1: Write the failing test**

扩展现有测试输入，断言：
- 同一本书的任务会按 `updatedAt` 倒序显示
- 原有 `manual_review*` 任务仍保留
- `refreshAll` 和自动刷新路径不会丢失失败任务

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: FAIL，因为当前任务列表没有明确按 `updatedAt` 排序收口。

**Step 3: Write minimal implementation**

在 `useReviewWorkbenchData.ts` 中：
- 在 `loadRegenerateTasks` 里对转换后的任务按 `updatedAt` 倒序排序
- 保持现有自动刷新逻辑不变

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts \
  apps/web/src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
git commit -m "feat: sort review script tasks by update time"
```

### Task 4: 为 Studio 页面建立段落 -> 最近失败任务映射

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/useScriptStudioData.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/__tests__/script-studio-model-switching.test.tsx`

**Step 1: Write the failing test**

在 `script-studio-model-switching.test.tsx` 增加场景，断言：
- 当某段落存在最近失败任务时，页面会出现“查看质检失败”入口
- 链接目标为 `/books/<bookId>/review#task-<taskId>`

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected: FAIL，因为 Studio 目前没有失败任务映射数据。

**Step 3: Write minimal implementation**

在 `useScriptStudioData.ts` 中：
- 复用 `/api/tasks?bookId=...`
- 提取失败脚本任务
- 建立 `segmentId -> latestFailedTask` 映射

在 `types.ts` 中增加 Studio 使用的失败任务摘要类型。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/studio/script/page-container/hooks/useScriptStudioData.ts \
  apps/web/src/app/books/[id]/studio/script/components/types.ts \
  apps/web/src/app/__tests__/script-studio-model-switching.test.tsx
git commit -m "feat: map segments to latest failed review tasks"
```

### Task 5: 在章节段落表和当前段落头部增加跳转入口

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/ChapterSegmentsTable.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/index.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/__tests__/script-studio-model-switching.test.tsx`

**Step 1: Write the failing test**

让测试断言：
- 章节段落表中，失败段落行出现“查看质检失败”
- 当前段落详情头部也出现同入口
- 无失败记录的段落不显示入口

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected: FAIL，因为当前 UI 没有这些入口。

**Step 3: Write minimal implementation**

在 `ChapterSegmentsTable.tsx`：
- 为行级操作区增加可选跳转链接

在 `page-container/index.tsx`：
- 把当前段落失败任务链接接到详情头部
- 把段落映射结果传给章节段落表

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/studio/script/components/ChapterSegmentsTable.tsx \
  apps/web/src/app/books/[id]/studio/script/page-container/index.tsx \
  apps/web/src/app/__tests__/script-studio-model-switching.test.tsx
git commit -m "feat: add review failure links to segment ui"
```

### Task 6: 回归验证与文档同步

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-04-15-script-failure-task-visibility-design.md`
- Verify only

**Step 1: Run focused tests**

Run:

```bash
pnpm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewRegenerateTaskList.test.tsx
pnpm test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
pnpm typecheck
```

Expected: 全部 PASS

**Step 2: Manual verification**

在浏览器验证：
- 书籍 review 页看到最近失败/重生任务
- 失败任务按最近更新时间倒序
- 点击 Studio 段落中的“查看质检失败”后跳到对应 `#task-...`

**Step 3: Commit**

```bash
git add docs/plans/2026-04-15-script-failure-task-visibility-design.md
git commit -m "docs: finalize script failure task visibility plan"
```
