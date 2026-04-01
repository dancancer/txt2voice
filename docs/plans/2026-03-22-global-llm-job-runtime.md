# Global LLM Job Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把所有 LLM 调用统一迁移到 Bull job 运行时，提供全局共享并发池、等待队列与自动重试，并把脚本生成链路改造成“并行推理 + 有序落库”。

**Architecture:** 新增 LLM 专用队列和运行时封装，`LLMService` 只负责业务协议与 provider 配置，不再直接裸调 SDK。脚本生成链路拆分为无副作用的推理阶段与串行合并阶段，利用全局 LLM 队列提供跨任务共享并发能力，同时保留稳定的数据落库顺序。

**Tech Stack:** Next.js, TypeScript, Bull, Redis, OpenAI SDK, Jest.

---

### Task 1: 为 LLM 增加队列定义与 worker

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/llm-execute.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/constants.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/worker.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-job-runtime.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 新的 LLM queue payload 可以入队
- worker 使用 `LLM_MAX_CONCURRENCY`
- retryable 失败时不会立刻标记最终失败

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/llm-job-runtime.test.ts`

Expected: FAIL，因为 LLM queue 和 worker 还不存在。

**Step 3: Write minimal implementation**

- 在 constants 中加入 `LLM_QUEUE_NAME`、`LLM_JOB_OPTIONS`
- 在 types 中加入 `LLMExecutionQueueInput`、`LLMExecutionJobData`
- 在 runtime 中加入 `getLLMQueue()`
- 在 worker 中注册 LLM worker，使用 `process(LLM_MAX_CONCURRENCY, ...)`
- 暴露新的 enqueue/worker 能力

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/llm-job-runtime.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/constants.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/runtime.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/types.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/worker.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/llm-execute.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-job-runtime.test.ts
git commit -m "feat: add llm execution queue"
```

### Task 2: 实现统一 LLM Runtime，并接管 `LLMService`

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `callLLM()` 会通过 runtime 入队
- retryable provider 错误会被标记为可重试
- 非 retryable 错误不会被重复提交
- queue 模式下能等待 job 结果返回

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/llm-service.test.ts`

Expected: FAIL，因为 runtime 尚未接管 `LLMService`。

**Step 3: Write minimal implementation**

- 新建 `llm-runtime.ts`，封装 enqueue + `job.finished()`
- 在 `llm-service.ts` 中保留 provider 配置与 `executeProviderCall()`
- 把原来的 `callLLMPrivate()` 逻辑改为 worker 专用执行路径
- `callLLM()` 改成统一走 runtime

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/llm-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-runtime.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts
git commit -m "feat: route llm calls through job runtime"
```

### Task 3: 拆分脚本生成的“推理”和“落库”

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generator.test.ts`

**Step 1: Write the failing test**

扩展测试覆盖：

- segment 推理阶段可并行提交
- 返回结果按 segment 原顺序合并
- 失败段仍能生成正确的 `failedSegmentDetails`
- 成功段依然按顺序执行 `saveSegmentScriptToDatabase()`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts
npm test -- --runInBand src/lib/__tests__/script-generator.test.ts
```

Expected: FAIL，因为当前实现仍是 `processSegmentAndSave()` 串行一把梭。

**Step 3: Write minimal implementation**

- 从 `segment-processor.ts` 中提取“无副作用 segment 推理函数”
- `workflow.ts` 中改成先 `Promise.allSettled()` 收集推理结果
- 只在第二阶段串行合并角色候选和落库
- 保留现有失败细分与复核项同步逻辑

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts
npm test -- --runInBand src/lib/__tests__/script-generator.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generator.test.ts
git commit -m "refactor: parallelize llm inference for script generation"
```

### Task 4: 把 LLM 子 job 指标聚合回父任务

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/processing-task-utils.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts`

**Step 1: Write the failing test**

补充断言：

- 父任务 `taskData.metadata` 中有 LLM 子 job 的 submitted/completed/failed/retried 摘要
- 失败任务会记录 LLM 层的聚合错误信息

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`

Expected: FAIL，因为当前父任务没有 LLM 子 job 聚合统计。

**Step 3: Write minimal implementation**

- 在 runner 中收集 LLM runtime 返回的聚合指标
- 更新 `mergeTaskData()` 写回元数据
- 保持现有复核同步字段不回退

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/processing-task-utils.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generation-runner.test.ts
git commit -m "feat: surface llm job metrics in parent task"
```

### Task 5: 为未来异步能力固化统一约定

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-22-global-llm-job-runtime-design.md`
- Modify: `/Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

**Step 1: Write the failing test**

本任务不写代码测试，改为文档校验：确认运行手册中补充了“新异步能力必须走 job 模型”的约定。

**Step 2: Run verification to verify gap**

Run: `rg -n "job 模型|共享并发|重试" /Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

Expected: 无匹配或信息不完整。

**Step 3: Write minimal implementation**

- 在设计文档中补充“未来异步能力统一接入规则”
- 在 TTS runbook 中补充后续迁移约束，说明音频/TTS/LLM 都归一到 job 运行模型

**Step 4: Run verification to verify it passes**

Run: `rg -n "job 模型|共享并发|重试" /Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

Expected: 能找到新的统一约定说明。

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/docs/plans/2026-03-22-global-llm-job-runtime-design.md /Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md
git commit -m "docs: document unified async job model"
```

### Task 6: 回归验证

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/llm-job-runtime.test.ts
npm test -- --runInBand src/lib/__tests__/llm-service.test.ts
npm test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts
npm test -- --runInBand src/lib/__tests__/script-generator.test.ts
```

Expected: 全部 PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run lint on touched files**

Run: `npm run lint -- --ext .ts,.tsx src/lib/llm-service.ts src/lib/llm-runtime.ts src/lib/task-queue src/lib/script-generator`

Expected: PASS

**Step 4: Manual verification**

验证点：

- 多个独立 LLM 调用同时发起时，队列中出现 waiting/active 切换
- active 数不超过 `LLM_MAX_CONCURRENCY`
- retryable 错误可自动重试后成功
- 脚本生成任务的 segment 推理吞吐高于原串行实现

**Step 5: Final commit**

```bash
git status
git add -A
git commit -m "feat: move llm execution to global job runtime"
```
