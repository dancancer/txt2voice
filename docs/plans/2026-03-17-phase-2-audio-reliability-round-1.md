# Phase 2 Audio Reliability Round 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `indextts / cosyvoice / voxcpm` 建立统一运行时策略、真实 synth 探针和三阶段补跑编排，让音频生成从“一轮批跑”收敛为“保守首轮 + failed-only 重跑 + 单句救援”。

**Architecture:** 在不改现有队列模型的前提下，把 provider 承载能力抽成独立 policy；runner 改为消费 retry plan；provider status 路由增加可选 synth probe；可靠性指标沉淀到 `processingTask.taskData.metadata.audioReliability`。同时把会继续膨胀的逻辑从大文件中拆到独立模块，避免继续堆复杂度。

**Tech Stack:** TypeScript、Next.js Route Handlers、Jest、Prisma

---

### Task 1: 建立 provider runtime policy 与 retry plan

**Files:**
- Create: `apps/web/src/lib/audio-runtime-policy.ts`
- Create: `apps/web/src/lib/audio-retry-plan.ts`
- Create: `apps/web/src/lib/__tests__/audio-runtime-policy.test.ts`
- Create: `apps/web/src/lib/__tests__/audio-retry-plan.test.ts`
- Modify: `apps/web/src/lib/audio-generator.ts`

**Step 1: Write the failing test**

新增断言：
- 不同 provider 能解析出不同的 `firstPassConcurrency / retryPassConcurrency / rescuePassConcurrency`
- retry plan 会把全量请求切成 `pass-1 / pass-2 / pass-3`
- failed-only 轮次不会重复带上已成功句子

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts`
Expected: FAIL because policy / retry plan 模块尚不存在

**Step 3: Write minimal implementation**

- 抽出 provider runtime policy
- 抽出 retry pass 规划 helper
- 让 `audio-generator` 能按 pass 指定的并发参数执行批次

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/audio-runtime-policy.ts apps/web/src/lib/audio-retry-plan.ts apps/web/src/lib/__tests__/audio-runtime-policy.test.ts apps/web/src/lib/__tests__/audio-retry-plan.test.ts apps/web/src/lib/audio-generator.ts
git commit -m "feat: add audio runtime policy"
```

### Task 2: 加入真实 synth 探针并接入 provider status

**Files:**
- Create: `apps/web/src/lib/tts-runtime-probe.ts`
- Create: `apps/web/src/lib/__tests__/tts-runtime-probe.test.ts`
- Create: `apps/web/src/lib/__tests__/tts-provider-status-route.test.ts`
- Modify: `apps/web/src/app/api/tts/providers/status/route.ts`
- Modify: `apps/web/src/lib/indextts-service.ts`
- Modify: `apps/web/src/lib/cosyvoice-service.ts`
- Modify: `apps/web/src/lib/voxcpm-service.ts`

**Step 1: Write the failing test**

新增断言：
- route 默认只跑轻量 health check
- 带 probe 参数时会执行真实 synth probe
- 任一 provider synth 失败时，返回结果能区分 `health=true` 与 `probeHealthy=false`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts`
Expected: FAIL because runtime probe 与 route 扩展尚未实现

**Step 3: Write minimal implementation**

- 为三个 provider 暴露最小 probe 所需参数
- 新增 probe helper
- 扩展 provider status route 支持显式 probe

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/tts-runtime-probe.ts apps/web/src/lib/__tests__/tts-runtime-probe.test.ts apps/web/src/lib/__tests__/tts-provider-status-route.test.ts apps/web/src/app/api/tts/providers/status/route.ts apps/web/src/lib/indextts-service.ts apps/web/src/lib/cosyvoice-service.ts apps/web/src/lib/voxcpm-service.ts
git commit -m "feat: add provider synth probe"
```

### Task 3: 把 audio runner 改成三阶段执行并沉淀可靠性指标

**Files:**
- Modify: `apps/web/src/lib/audio-generation-runner.ts`
- Modify: `apps/web/src/lib/audio-generator.ts`
- Modify: `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`
- Create: `apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts`

**Step 1: Write the failing test**

新增断言：
- book/chapter/batch 任务会先跑 `pass-1`，失败项再进入 `pass-2`
- `pass-3` 只吃前两轮仍失败的句子
- `processingTask.taskData.metadata.audioReliability` 会记录 `firstPassSuccessRate / retryRounds / providerFailures / averageDurationMs`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts`
Expected: FAIL because runner 仍是一轮批跑，没有 reliability metadata

**Step 3: Write minimal implementation**

- runner 读取 runtime policy 与 retry plan
- 按三阶段执行 book/chapter/batch
- 汇总 pass 结果到 reliability metadata

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/audio-generation-runner.ts apps/web/src/lib/audio-generator.ts apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts
git commit -m "feat: add staged audio retries"
```

### Task 4: 补 task/handoff 文档并做阶段验证

**Files:**
- Create: `docs/task/2026-03-17-phase-2-round-1-audio-runtime-policy.md`
- Create: `docs/handoff/2026-03-17-phase-2-round-1-audio-runtime-policy.md`

**Step 1: Write task and handoff docs**

记录本轮目标、范围、验证结果、遗留问题、下一轮建议。

**Step 2: Run broader verification**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/audio-engine-router.test.ts src/lib/__tests__/task-replay-payload-audio.test.ts src/lib/__tests__/auto-pipeline-runner.test.ts && pnpm --filter web typecheck`
Expected: PASS

**Step 3: Run final verification**

Run: `pnpm --filter web build`
Expected: PASS

**Step 4: Commit**

```bash
git add docs/task/2026-03-17-phase-2-round-1-audio-runtime-policy.md docs/handoff/2026-03-17-phase-2-round-1-audio-runtime-policy.md
git commit -m "docs: record phase 2 audio reliability round 1"
```
