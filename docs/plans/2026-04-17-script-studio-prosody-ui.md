# Script Studio Prosody UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Script Studio 中把语气与朗读参数做成统一的控制台式展示，并支持直接编辑保存。

**Architecture:** 复用现有后端字段与 `updateScriptSentences()`，只补前端本地类型、展示组件与编辑弹窗。视图层通过统一“参数规格条”收口，避免把 `prosody` 展示做成多套视觉语言。保存动作继续走现有句子更新接口，不新增 API。

**Tech Stack:** Next.js App Router, React 19, Jest + jsdom, existing UI primitives, existing script sentence API contract.

---

### Task 1: 落本地类型与共享展示语义

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/prosody-display.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/__tests__/prosody-display.test.tsx`

**Step 1: Write the failing test**

新增 `prosody-display.test.tsx`，断言：
- 有参数时按固定顺序展示 `强度 / 停顿 / 语速 / 音高 / 能量 / 尾停`
- 缺失字段不显示占位
- 数值显示格式稳定

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/books/[id]/studio/script/components/__tests__/prosody-display.test.tsx
```

Expected: FAIL，因为共享展示组件还不存在。

**Step 3: Write minimal implementation**

在两个类型文件中补上：
- `prosody?: { pace?: number; pitch?: number; energy?: number; pauseMsAfter?: number }`
- 保持 `strength / pauseAfter` 可选

新增共享展示组件：
- 输入 `tone / strength / pauseAfter / prosody`
- 输出统一规格条

**Step 4: Run test to verify it passes**

Run same command.

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts \
  apps/web/src/app/books/[id]/studio/script/components/types.ts \
  apps/web/src/app/books/[id]/studio/script/components/prosody-display.tsx \
  apps/web/src/app/books/[id]/studio/script/components/__tests__/prosody-display.test.tsx
git commit -m "feat: add shared script prosody display component"
```

### Task 2: 先写失败测试，锁住编辑弹窗的高级参数表单

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/EditSentenceModal.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/__tests__/edit-sentence-modal.test.tsx`

**Step 1: Write the failing test**

新增 `edit-sentence-modal.test.tsx`，断言：
- 弹窗会显示“朗读参数”分组
- 能加载并展示已有 `strength / pauseAfter / prosody`
- 点击保存后会把归一化后的字段传给 `onSave`

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/books/[id]/studio/script/components/__tests__/edit-sentence-modal.test.tsx
```

Expected: FAIL，因为当前弹窗没有这些表单字段。

**Step 3: Write minimal implementation**

在 `EditSentenceModal.tsx`：
- 增加高级参数区块
- 用单列表单布局，不做双列
- 轻量归一化空字符串和数字输入

**Step 4: Run test to verify it passes**

Run same command.

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/studio/script/components/EditSentenceModal.tsx \
  apps/web/src/app/books/[id]/studio/script/components/__tests__/edit-sentence-modal.test.tsx
git commit -m "feat: add editable prosody controls to script sentence modal"
```

### Task 3: 锁住保存动作与本地状态同步

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptSentenceActions.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/__tests__/use-script-sentence-actions.test.tsx`

**Step 1: Write the failing test**

新增 hook 测试，断言：
- `handleSentenceEdit()` 会把 `strength / pauseAfter / prosody` 带入 `updateScriptSentences()`
- 本地 `setScriptSentences()` 后的新句子也同步包含这些字段

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/__tests__/use-script-sentence-actions.test.tsx
```

Expected: FAIL，因为当前 payload 与本地状态都未覆盖这些字段。

**Step 3: Write minimal implementation**

在 `useScriptSentenceActions.ts`：
- 扩展 `updates` 类型
- 把高级参数带入 `payload`
- 本地状态同步写回这些字段

**Step 4: Run test to verify it passes**

Run same command.

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptSentenceActions.ts \
  apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/__tests__/use-script-sentence-actions.test.tsx
git commit -m "feat: persist script prosody edits in studio state"
```

### Task 4: 把共享规格条接入卡片、表格和预览

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/ScriptSentenceCard.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/ScriptSentencesTable.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/ScriptPreviewModal.tsx`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/__tests__/script-prosody-views.test.tsx`

**Step 1: Write the failing test**

新增 `script-prosody-views.test.tsx`，断言：
- 卡片展示两层信息结构
- 表格“语气”列出现紧凑参数摘要
- 预览弹窗展示同一套规格条

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/books/[id]/studio/script/components/__tests__/script-prosody-views.test.tsx
```

Expected: FAIL，因为当前三个组件还没统一使用规格条。

**Step 3: Write minimal implementation**

在三个组件中接入共享展示组件：
- 卡片：顶部两层层级
- 表格：语气列内双行展示
- 预览：正文下方低对比规格条

**Step 4: Run test to verify it passes**

Run same command.

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/studio/script/components/ScriptSentenceCard.tsx \
  apps/web/src/app/books/[id]/studio/script/components/ScriptSentencesTable.tsx \
  apps/web/src/app/books/[id]/studio/script/components/ScriptPreviewModal.tsx \
  apps/web/src/app/books/[id]/studio/script/components/__tests__/script-prosody-views.test.tsx
git commit -m "feat: surface script prosody across studio views"
```

### Task 5: 定向验证与轻量回归

**Files:**
- No code changes required

**Step 1: Run focused UI tests**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/books/[id]/studio/script/components/__tests__/prosody-display.test.tsx apps/web/src/app/books/[id]/studio/script/components/__tests__/edit-sentence-modal.test.tsx apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/__tests__/use-script-sentence-actions.test.tsx apps/web/src/app/books/[id]/studio/script/components/__tests__/script-prosody-views.test.tsx
```

Expected: PASS

**Step 2: Run one integration safety test**

Run:

```bash
pnpm test -- --runInBand apps/web/src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected: PASS，确认页面容器没有被新的编辑字段破坏。

**Step 3: Inspect diff**

Run:

```bash
git diff -- apps/web/src/app/books/[id]/studio/script/components apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptSentenceActions.ts apps/web/src/lib/types.ts
```

Expected: 只有类型补齐、共享规格条、表单接线和展示优化，没有 API 形状漂移。

**Step 4: Commit**

```bash
git add docs/plans/2026-04-17-script-studio-prosody-ui-design.md \
  docs/plans/2026-04-17-script-studio-prosody-ui.md
git commit -m "docs: plan script studio prosody ui"
```
