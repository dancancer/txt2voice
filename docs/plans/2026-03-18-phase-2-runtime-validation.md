# Phase 2 Runtime Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地一个可重复执行的远端音频运行验证脚本，在真实 synth probe 通过后触发 `chapter/book` 级音频生成，提取 `audioReliability` 并自动写入 Phase 2 review 文档。

**Architecture:** 保持现有 Web/API 不变，只新增一个面向运维验收的脚本入口。脚本通过 HTTP 调 `/api/tts/providers/status?probe=true` 和 `/api/books/[id]/audio/generate`，轮询任务完成后提取 `taskDetails.metadata.audioReliability`，最终写出结构化 markdown review，并同步更新远端 runbook。

**Tech Stack:** Node.js CommonJS、Jest、Next.js API、Markdown 文档

---

### Task 1: 为远端验证脚本写失败测试

**Files:**
- Create: `apps/web/src/lib/__tests__/phase2-audio-validation-script.test.ts`
- Create: `scripts/phase2-audio-validation.js`

**Step 1: Write the failing test**

新增断言：
- 参数解析能正确处理 `--provider --type --book-id --chapter-id --repeat-count`
- probe 失败时脚本不会继续触发音频生成
- 成功时会提取 `audioReliability` 并输出 review markdown

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts`
Expected: FAIL because script does not exist yet

**Step 3: Write minimal implementation**

- 新增脚本导出 `parseArgs`
- 新增主流程 `runPhase2AudioValidation`
- 新增 review markdown builder

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/phase2-audio-validation.js apps/web/src/lib/__tests__/phase2-audio-validation-script.test.ts
git commit -m "feat: add phase 2 runtime validation script"
```

### Task 2: 更新 runbook 与 round 2 task/handoff/review 文档

**Files:**
- Modify: `docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`
- Create: `docs/task/2026-03-18-phase-2-round-2-runtime-validation.md`
- Create: `docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md`
- Create: `docs/review/2026-03-18-phase-2-runtime-validation.md`

**Step 1: Write the failing documentation gap**

明确本轮文档目标：
- runbook 里补上脚本化验收命令
- round 2 task/handoff 记录目标、验证、风险
- review 文档预留真实运行记录位置

**Step 2: Write minimal documentation**

- 更新远端 runbook
- 新建 task / handoff / review 文档骨架

**Step 3: Verify docs are internally consistent**

Run: `rg -n "phase2-audio-validation|probe=true|audioReliability" docs scripts`
Expected: 文档与脚本引用路径一致

**Step 4: Commit**

```bash
git add docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md docs/task/2026-03-18-phase-2-round-2-runtime-validation.md docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md docs/review/2026-03-18-phase-2-runtime-validation.md
git commit -m "docs: add phase 2 runtime validation runbook"
```

### Task 3: 执行真实远端验证并完成代码质检

**Files:**
- Update: `docs/review/2026-03-18-phase-2-runtime-validation.md`
- Update: `docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md`

**Step 1: Run targeted tests**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts`
Expected: PASS

**Step 3: Run typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 4: Execute real remote validation**

Run: `node scripts/phase2-audio-validation.js --base-url http://192.168.88.9:3001 --provider voxcpm --type chapter --book-id <book-id> --chapter-id <chapter-id> --batch-size 1 --repeat-count 1 --review-path docs/review/2026-03-18-phase-2-runtime-validation.md`
Expected: probe 通过后启动音频生成，最终写入 review 文档；若 probe 或任务失败，也必须把失败记录写回 review 文档并以非零退出

**Step 5: Run final build verification**

Run: `pnpm --filter web build`
Expected: PASS

**Step 6: Commit**

```bash
git add docs/review/2026-03-18-phase-2-runtime-validation.md docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md
git commit -m "docs: record phase 2 runtime validation round"
```
