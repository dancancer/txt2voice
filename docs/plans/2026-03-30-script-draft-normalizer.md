# Script Draft Normalizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 runtime 中引入统一的台本草稿规范化层，减少 `BOUNDARY_DRIFT` 类失败对单个提示词形态的敏感度。

**Architecture:** 在 `script-generation-agent` 与 validation 之间增加一个可复用的 `draft normalizer`，基于 `sourceText/text/speaker` 的关系做通用归一化，而不是继续堆样本特判。validation 继续保持严格，只消费规范化后的草稿。

**Tech Stack:** TypeScript, Jest, Next.js runtime, existing script validator heuristics

---

### Task 1: 写失败测试，覆盖通用归一化模式

**Files:**
- Modify: `apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Create: `apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`

**Step 1: 写 failing tests**
- 纯引号短句被误标记为 `旁白`
- 纯引号整句 `sourceText` 保持引号时也要归一化
- `sourceText` 为整句引号文本、`text` 为对白正文时，旁白应降级到非旁白路径

**Step 2: 跑测试确认失败**
- `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts -t "normalizes pure quoted leaf when sourceText already keeps quotes but speaker is narration"`

### Task 2: 实现统一 draft normalizer

**Files:**
- Create: `apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Modify: `apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`

**Step 1: 写最小实现**
- 提供 `normalizeSegmentScriptDraft`，基于 `resolveScriptLineText` 比较 narration / dialogue 两种期望文本
- 将“旁白文本实际等于对白正文”的草稿统一降级为 `未知`
- 保留现有纯引号 leaf 的 `sourceText` 对齐逻辑，但抽到共享层

**Step 2: 接入 runtime**
- `script-generation-agent` 输出 draft 后先规范化
- validation 前再规范化一次，保证历史/异常输出也能被兜住

### Task 3: 验证回归

**Files:**
- None

**Step 1: 跑相关测试**
- `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`

**Step 2: 复跑真实样本**
- 复跑 `c06cd006-cc1d-4254-9011-b402d8e0875f`
- 确认其从 `pending/reprocessing` 进入 `resolved`
