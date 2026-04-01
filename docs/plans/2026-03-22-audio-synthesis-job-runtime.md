# Audio Synthesis Job Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把音频生成改造成父任务编排 + 句子级 TTS 子 job 模型，提供统一并发池、等待队列、自动重试和聚合指标，同时保留现有后置质检和可靠性统计。

**Architecture:** 保留 `AUDIO_GENERATION` 作为父任务 queue，新增 `audio-synthesis` 子队列。`AudioGenerator.generateSingleAudio()` 改为统一走子 job runtime，worker 内通过 `executeAudioSynthesis()` 真正执行单句合成。父任务在每轮 retry pass 内批量提交子 job、等待完成并汇总，然后继续执行已有的 `qc_retry/manual_review/autoMerge` 逻辑。

**Tech Stack:** Next.js, TypeScript, Bull, Redis, existing TTS services, Jest.

---

### Task 1: 为句子级 TTS 子 job 增加队列与 worker

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/constants.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/worker.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/enqueue.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/audio-synthesis-execute.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-synthesis-job-runtime.test.ts`

**Step 1: Write the failing test**

覆盖：

- 新的 `audio-synthesis` queue 会注册到 worker
- worker concurrency 读取 `AUDIO_SYNTHESIS_MAX_CONCURRENCY`
- 子 job 通过独立执行器运行

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/audio-synthesis-job-runtime.test.ts`

Expected: FAIL，因为子队列和执行器尚未存在。

**Step 3: Write minimal implementation**

- 新增 queue 常量、类型、runtime getter
- 新增 enqueue
- 在 worker 中注册 `audio-synthesis` 子 worker
- 新建执行器文件占位

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/audio-synthesis-job-runtime.test.ts`

Expected: PASS

### Task 2: 增加音频子 job runtime 与错误序列化

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-synthesis-runtime.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-job-error.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/audio-synthesis-execute.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-synthesis-runtime.test.ts`

**Step 1: Write the failing test**

覆盖：

- runtime 会等待 job 完成并返回单句结果
- job 失败时可恢复 retryable 错误语义
- runtime 补齐 wait/retriesUsed/elapsed 等指标

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/audio-synthesis-runtime.test.ts`

Expected: FAIL，因为 runtime 与 error serializer 还不存在。

**Step 3: Write minimal implementation**

- 新增 runtime 文件
- 新增 error serializer/deserializer
- 在执行器里用序列化错误传递 retryable 信息

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/audio-synthesis-runtime.test.ts`

Expected: PASS

### Task 3: 把 `AudioGenerator` 拆成“对外 runtime / 对内 worker 执行”

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generator-reliability.test.ts`

**Step 1: Write the failing test**

覆盖：

- `generateSingleAudio()` 走 runtime，不直接执行 provider
- `executeAudioSynthesis()` 负责原来的单句执行逻辑
- 可重试错误抛给 job，不可重试错误返回 `success:false`

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts`

Expected: FAIL，因为当前单句 API 和执行逻辑尚未拆层。

**Step 3: Write minimal implementation**

- 抽取旧 `generateSingleAudio()` 主体到 `executeAudioSynthesis()`
- `generateSingleAudio()` 改走 `audio-synthesis-runtime`
- 保留既有路由选择、文件落盘、`AudioFile` / `SynthesisAttempt` 持久化

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts`

Expected: PASS

### Task 4: 把批量 pass 执行改成批量提交子 job

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generator-reliability.test.ts`

**Step 1: Write the failing test**

扩展可靠性测试，覆盖：

- `pass-1/pass-2/pass-3` 仍按失败项推进
- 最终结果顺序与输入顺序一致
- 子 job 指标不会破坏现有 `audioReliability`

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts`

Expected: FAIL，因为当前 `runBatchPass()` 还是函数内直接并发调用。

**Step 3: Write minimal implementation**

- `runBatchPass()` 改成提交子 job 并等待结果
- 保留三阶段 retry plan
- 删除函数内本地并发对 provider 的直接控制，交给子队列 shared concurrency

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts`

Expected: PASS

### Task 5: 让父任务聚合子 job 指标并保留后置质检

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation-runner.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`

**Step 1: Write the failing test**

覆盖：

- 父任务 `taskData.metadata` 中新增 `audioChildJobMetrics`
- `manual_review` / `manual_review_batch` / `qc_retry` 的后置质检逻辑不回退
- 子 job 执行失败时，父任务仍能正确判断全部失败/部分失败

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-reliability.test.ts
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts
```

Expected: FAIL，因为当前父任务不感知子 job 指标。

**Step 3: Write minimal implementation**

- 父任务收集 submitted/completed/failed/retried/wait/latency 聚合信息
- 保留现有 `audioReliability`、`routerDecisionSummary` 和 followup QC

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-reliability.test.ts
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts
```

Expected: PASS

### Task 6: 文档与运行约束同步

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-22-audio-synthesis-job-runtime-design.md`
- Modify: `/Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

**Step 1: Verify documentation gap**

Run: `rg -n "audio-synthesis|句子级子 job|AUDIO_SYNTHESIS_MAX_CONCURRENCY" /Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

Expected: 暂无对应说明。

**Step 2: Write minimal implementation**

- 补充音频子 job 运行方式
- 写明父任务 queue 与子队列 queue 的关系
- 记录新的并发配置项

**Step 3: Verify documentation**

Run: `rg -n "audio-synthesis|句子级子 job|AUDIO_SYNTHESIS_MAX_CONCURRENCY" /Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

Expected: 能查到新增文档。

### Task 7: 回归验证

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/audio-synthesis-job-runtime.test.ts
npm test -- --runInBand src/lib/__tests__/audio-synthesis-runtime.test.ts
npm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-reliability.test.ts
npm test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts
```

Expected: 全部 PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run lint on touched files**

Run: `npx eslint src/lib/audio-generator.ts src/lib/audio-generation-runner.ts src/lib/audio-synthesis-runtime.ts src/lib/audio-job-error.ts src/lib/task-queue src/lib/__tests__/audio-synthesis-job-runtime.test.ts src/lib/__tests__/audio-synthesis-runtime.test.ts`

Expected: PASS
