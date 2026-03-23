# Review Script Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为质检复核页的台本失败项提供全屏修订工作台，清晰展示段落原文、当前生成原始结果，并支持直接人工编辑整段结构化台本结果后保存。

**Architecture:** 后端在脚本失败详情里补全完整段落原文、原始 LLM 响应和结构化结果草稿；前端在复核列表中为脚本失败项打开全屏工作台，采用“左侧原文与问题定位 / 中间结构化编辑器 / 右侧原始结果与差异预览”的三栏布局。保存时走 review 专用接口，复用现有台本校验和 `ScriptSentence` 持久化链路，把人工修订结果直接落库并解决当前复核项。

**Tech Stack:** Next.js App Router, React, Tailwind, existing shadcn-style UI components, Prisma, Jest.

---

### Task 1: 扩展脚本失败详情数据模型

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-validation-detail.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

**Step 1: Write the failing test**

补测试断言脚本失败详情里包含：
- `segmentContent`
- `rawResponse`
- `structuredResult`
- `structuredResultJson`

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`

Expected: FAIL，因为失败详情里还没有完整上下文和原始结果。

**Step 3: Write minimal implementation**

- 在 `SegmentFailureDetail` 中新增字段
- 在 `processSegment()` 的校验失败与解析失败路径中记录原始响应和结构化结果
- 在 runner 同步为 `manualReviewItem.issueDetail`
- 在 detail view 中暴露新增字段

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`

Expected: PASS

### Task 2: 新增 review 专用脚本修订保存接口

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/review/items/[itemId]/script-save/route.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/manual-review-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/manual-review-service.test.ts`

**Step 1: Write the failing test**

覆盖：
- 只允许 `SCRIPT_VALIDATION` 项保存修订
- 可接受整段结构化结果 `dialogues + characters`
- 保存后会落库 segment 对应 `ScriptSentence`
- 当前 review item 变为 `resolved`

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/manual-review-service.test.ts`

Expected: FAIL，因为还没有 review 专用保存接口。

**Step 3: Write minimal implementation**

- 提供 `saveManualReviewScriptEdit()` 服务
- 复用 segment processor 的结构化结果构建逻辑
- 保存到 `ScriptSentence`
- 更新 `manualReviewItem`

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/manual-review-service.test.ts`

Expected: PASS

### Task 3: 定义复核工作台 UI 模型与交互状态

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/models/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchActions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

**Step 1: Write the failing test**

覆盖：
- 脚本失败项会显示“打开修订工作台”入口
- 点击后进入工作台状态
- 保存请求期间按钮 loading

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

Expected: FAIL，因为还没有工作台入口与状态。

**Step 3: Write minimal implementation**

- 扩展 review item 类型
- 增加打开/关闭/保存工作台动作
- 把必要数据准备给工作台组件

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

Expected: PASS

### Task 4: 实现全屏三栏修订工作台

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewScriptEditWorkspace.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx`

**Step 1: Write the failing test**

覆盖：
- 左栏展示完整段落原文与问题高亮
- 中栏展示结构化编辑器（dialogues / characters）
- 右栏展示原始结果和差异预览
- 保存按钮与校验错误可见

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx`

Expected: FAIL，因为工作台组件尚不存在。

**Step 3: Write minimal implementation**

- 使用全屏 `Dialog`
- 采用三栏布局
- 对 `dialogues` 使用可增删改的表单式编辑器
- 对 `characters` 使用折叠卡片编辑器
- 用只读 JSON 视图展示原始结果

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx`

Expected: PASS

### Task 5: 接入保存流并优化复核详情可读性

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/page.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

**Step 1: Write the failing test**

覆盖：
- “问题原文预览”升级为更清晰的上下文块
- 列表项可打开全屏工作台
- 保存成功后条目状态刷新

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

Expected: FAIL，因为当前列表只支持 details 文本块。

**Step 3: Write minimal implementation**

- 列表卡片简化为摘要 + 入口
- 工作台承接详细查看与编辑
- 保存成功后刷新 review list

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx`

Expected: PASS

### Task 6: 回归验证

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts
npm test -- --runInBand src/lib/__tests__/manual-review-service.test.ts
npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewQueueList.test.tsx
npm test -- --runInBand src/app/books/[id]/review/components/__tests__/ReviewScriptEditWorkspace.test.tsx
```

Expected: 全部 PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run lint on touched files**

Run: `npx eslint src/app/books/[id]/review src/lib/manual-review-service.ts src/lib/script-generation-runner.ts src/lib/script-generator/pipeline/segment-processor.ts src/lib/script-validation-detail.ts`

Expected: PASS
