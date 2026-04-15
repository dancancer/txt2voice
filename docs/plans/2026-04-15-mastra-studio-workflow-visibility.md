# Mastra Studio Workflow Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Mastra Studio 中的 agent 列表与仓库定义一致，并把 `script-production` workflow 从空壳编译成可见的 step graph。

**Architecture:** 保留现有 runtime 真相源不变，只修 Mastra authoring/Studio 暴露层。`apps/web/src/mastra/index.ts` 负责把遗漏的 `coordinator-agent` 注册进 Mastra；`compile-workflow.ts` 负责把 `workflow.toml` 的阶段序列编译成一个只用于 Studio 可视化的顺序 step workflow，不接管生产执行。

**Tech Stack:** TypeScript, Next.js, Jest, Zod, Mastra workflows

---

### Task 1: 让 workflow 编译结果不再是空壳

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

**Step 1: 写失败测试**

- 断言 `compileWorkflow()` 会为 `script-production` 的每个 stage 创建 step。
- 断言 workflow 会被 `commit()`，并带有可见的 step graph。

**Step 2: 运行测试确认失败**

Run: `pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

**Step 3: 写最小实现**

- 用 `createStep()` 为每个 stage 生成顺序 step。
- 用 `createWorkflow(...).then(...).commit()` 构造 Mastra workflow。
- 保留 `stageOrder` / `runtimeSubstages` 作为 authoring metadata。

**Step 4: 运行测试确认通过**

Run: `pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

### Task 2: 把 coordinator-agent 注册进 Mastra 入口

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/mastra/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/mastra-entry.test.ts`

**Step 1: 写失败测试**

- 断言 Mastra 入口会编译并导出 `coordinatorAgent`。
- 断言 runtime 注册的 agents 包含 `coordinator-agent`。

**Step 2: 运行测试确认失败**

Run: `pnpm test -- --runInBand src/lib/__tests__/mastra-entry.test.ts`

**Step 3: 写最小实现**

- 在 `apps/web/src/mastra/index.ts` 中编译 `coordinator`。
- 将其加入 `agents` 注册表与 `compiledAgents` 导出。

**Step 4: 运行测试确认通过**

Run: `pnpm test -- --runInBand src/lib/__tests__/mastra-entry.test.ts`

### Task 3: 做回归验证

**Files:**
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/mastra-entry.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

**Step 1: 跑聚合验证**

Run: `pnpm test -- --runInBand src/lib/__tests__/mastra-entry.test.ts src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

**Step 2: 跑类型检查**

Run: `pnpm typecheck`

**Step 3: 手工核验 Studio 暴露**

- 启动 `pnpm run dev:mastra`
- 确认 Studio 中可见 5 个 agents
- 确认 `script-production` workflow 有顺序 steps，而不是空壳
