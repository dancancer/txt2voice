# Mastra Hybrid Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不破坏现有生产 runtime、持久化和回放能力的前提下，引入 Mastra 统一 LLM agent 层，并拆解 `text-processor.ts` 与 `audio-generator.ts` 两个过大文件。

**Architecture:** 保留现有 `agent-runtime` 作为生产 orchestration 和事实来源，在其上增加 `Mastra compiler + executor adapter + trace normalizer`。`agents/skills/workflows` 继续作为唯一 authoring interface；确定性文本和音频服务拆成模块树，并由 facade 文件保持对外兼容。

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Bull, Redis, Jest, Zod, Mastra, AI SDK.

---

### Task 1: 建立 executor policy 与切换开关

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/executor-policy.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/executor-policy.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 默认 executor 为 `native`
- 当环境变量声明 `AGENT_RUNTIME_EXECUTOR=mastra` 且 stage 命中 allowlist 时，返回 `mastra`
- `shadow mode` 只影响并行验证，不影响主结果来源

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/executor-policy.test.ts`

Expected: FAIL，因为 `executor-policy.ts` 还不存在。

**Step 3: Write minimal implementation**

- 实现 `resolveStageExecutor()`
- 实现 `isMastraShadowModeEnabled()`
- 在 `run-script-production-workflow.ts` 中预留 executor 选择点，但不改变现有行为

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/executor-policy.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/executor-policy.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/executor-policy.test.ts
git commit -m "feat: add runtime executor policy"
```

### Task 2: 引入 Mastra 依赖与最小 bootstrap

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/package.json`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- runtime bootstrap 能在依赖存在时构建 Mastra 实例
- 未配置 LLM provider 时抛结构化错误，而不是直接崩溃
- bootstrap 不会直接写入 Mastra storage

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`

Expected: FAIL，因为 Mastra bootstrap 还不存在。

**Step 3: Write minimal implementation**

- 在 `apps/web/package.json` 中新增最小依赖：
  - `@mastra/core`
  - `@ai-sdk/openai`
- 实现 `createMastraRuntime()`，只负责构建 runtime，不负责任务落库

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/package.json /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/index.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts
git commit -m "feat: add mastra runtime bootstrap"
```

### Task 3: 编译现有 authoring 定义到 Mastra agent / workflow

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-skill.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/load-prompt-bundle.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- `agents/script-generation/agent.toml` 能被编译成 Mastra agent
- `skills/script-generation/skill.toml` 的 `promptBundle` 能加载成 system/user 指令
- `workflows/script-production/workflow.toml` 能转换成 stage-ordered workflow definition

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

Expected: FAIL，因为 compiler 还不存在。

**Step 3: Write minimal implementation**

- 基于现有 registry loader 读取根目录 authoring 文件
- 将 `skill.toml + prompts/*.md` 编译成 Mastra instructions
- 先只支持当前四个内置 skills，不做开放式插件化

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-skill.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/load-prompt-bundle.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts
git commit -m "feat: compile runtime authoring into mastra definitions"
```

### Task 4: 建立 Mastra tool bridge 与 trace 归一层

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/trace/normalize-mastra-event.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/trace/index.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-trace-adapter.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- Mastra tool 调用会被映射成现有 `ToolCallRecord`
- Mastra 事件会被归一成现有 `ExecutionEvent` taxonomy
- 不允许未在 `toolAllowlist` 中声明的工具暴露给 Mastra agent

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-trace-adapter.test.ts`

Expected: FAIL，因为 bridge 和 trace adapter 还不存在。

**Step 3: Write minimal implementation**

- 用现有 runtime tool contracts 构造 Mastra tools
- 实现 event normalization，只保留上层真正消费的事件
- 让 tool call 和 trace 最终都写回现有 runtime store

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/mastra-trace-adapter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/trace/normalize-mastra-event.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/trace/index.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-trace-adapter.test.ts
git commit -m "feat: add mastra tool and trace bridge"
```

### Task 5: 先把 `character_discovery` stage 切到可切换 executor

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 当 stage executor 为 `mastra` 时，`character_discovery` 走 Mastra path
- stage summary、artifact、tool calls 仍与 native path 保持一致
- shadow mode 下会并行跑 Mastra，但主结果仍以 native 为准

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

Expected: FAIL，因为 stage 还没有 executor switch。

**Step 3: Write minimal implementation**

- 为 `character_discovery` 引入 switchable executor
- 先实现一个最小 Mastra stage runner
- 保持 artifact 与 persist stage 的契约不变

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts
git commit -m "feat: add mastra executor for character discovery"
```

### Task 6: 将 `segment_scripting / repair / quality` 三个 stage 接入 Mastra executor

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- 三个 stage 都能在 `native / mastra / shadow` 三种模式下工作
- 失败输出仍然保持现有 `failedArtifact` / `retryDirective` / `manual_review_required` 语义
- `RuntimeArtifact` 和 `TraceEvent` 结构保持兼容

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts`

Expected: FAIL，因为这三个 stage 还只支持 native path。

**Step 3: Write minimal implementation**

- 逐个 stage 引入 switchable runner
- 先保证输出 contract 完全一致，再考虑内部优化
- 用 shared adapter 复用 prompt、tool、trace、artifact 归一逻辑

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git commit -m "feat: add mastra executors for llm-heavy stages"
```

### Task 7: 为 shadow mode 建立差异记录与回放视图

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- shadow mode 会保存 native 与 Mastra 的差异摘要
- 差异以 `RuntimeArtifact` 落库，不改变主业务结果
- replay 可以读到差异 artifact

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

Expected: FAIL，因为 shadow diff 还不存在。

**Step 3: Write minimal implementation**

- 定义最小 diff payload，只比较高价值字段：
  - skillId
  - output summary
  - validation result
  - manual review judgement
- 将 diff 作为 sidecar artifact 落库

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts
git commit -m "feat: persist mastra shadow diff artifacts"
```

### Task 8: 拆解 `text-processor.ts`，保留兼容 facade

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/core/encoding.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/core/cleaning.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/segmentation/content-type.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/segmentation/segmenter.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/segmentation/segment-classification.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/chapters/chapter-detection.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/chapters/chapter-segmentation.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/persistence/content-sanitizer.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing/persistence/record-builders.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processor.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/gbk-segmentation.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/text-processor-script-correctness.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audiobook-regression.test.ts`

**Step 1: Write the failing test**

先补或调整测试，明确断言：

- `processFileContent()` 行为不变
- `segmentText()` 行为不变
- `createChapterSegmentRecords()` 的章节、段落、metadata 结构不变

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/__tests__/gbk-segmentation.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/audiobook-regression.test.ts`

Expected: 至少一个测试因为新模块尚不存在而 FAIL。

**Step 3: Write minimal implementation**

- 先抽 `encoding / cleaning / segmentation / chapter / persistence`
- `text-processor.ts` 保留原导出名称，只做薄封装
- 不改调用方 import 路径

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/__tests__/gbk-segmentation.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/audiobook-regression.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processing /Users/xupeng/mycode/txt2voice/apps/web/src/lib/text-processor.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/gbk-segmentation.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/text-processor-script-correctness.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audiobook-regression.test.ts
git commit -m "refactor: split text processing modules behind facade"
```

### Task 9: 拆解 `audio-generator.ts`，保留兼容 facade

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/types.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/execution/single-audio-executor.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/execution/batch-audio-runtime.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/routing/voice-route-resolver.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/routing/engine-health.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/synthesis/tts-request-builder.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/synthesis/tts-parameter-normalizer.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/persistence/audio-file-store.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation/persistence/synthesis-attempt-store.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generator-reliability.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`

**Step 1: Write the failing test**

先补或调整测试，明确断言：

- `AudioGenerator` 对外行为和返回结构保持不变
- 单句执行、批量可靠性、失败审计和路由回退行为不变
- `getAudioGenerator()` 仍返回兼容实例

**Step 2: Run test to verify it fails**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts`

Expected: 至少一个测试因为新模块尚不存在而 FAIL。

**Step 3: Write minimal implementation**

- 先抽 execution / routing / synthesis / persistence 四个模块群
- `audio-generator.ts` 仅保留 `AudioGenerator` facade 和兼容导出
- 不改队列、route API 和任务 payload 结构

**Step 4: Run test to verify it passes**

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generation /Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generator-reliability.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts
git commit -m "refactor: split audio generation modules behind facade"
```

### Task 10: 补 rollout 文档与运维开关说明

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/ARCHITECTURE.md`
- Modify: `/Users/xupeng/mycode/txt2voice/DEV_GUIDE.md`
- Create: `/Users/xupeng/mycode/txt2voice/docs/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md`

**Step 1: Write the failing test**

这一步不写自动化测试，改为先列出文档验收清单：

- 开发者知道如何开启/关闭 Mastra executor
- 开发者知道如何使用 shadow mode
- 开发者知道文本与音频 facade 的模块边界

**Step 2: Verify docs are missing**

Run: `cd /Users/xupeng/mycode/txt2voice && rg -n "AGENT_RUNTIME_EXECUTOR|shadow mode|Mastra" ARCHITECTURE.md DEV_GUIDE.md docs/technical || true`

Expected: 现有文档无法完整回答以上问题。

**Step 3: Write minimal implementation**

- 更新架构文档
- 更新开发文档
- 新增 rollout/runbook，记录 flag、验证命令、回退步骤

**Step 4: Verify docs are present**

Run: `cd /Users/xupeng/mycode/txt2voice && rg -n "AGENT_RUNTIME_EXECUTOR|AGENT_RUNTIME_MASTRA_SHADOW_MODE|shadow mode|Mastra" ARCHITECTURE.md DEV_GUIDE.md docs/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md`

Expected: 能搜到完整说明。

**Step 5: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/ARCHITECTURE.md /Users/xupeng/mycode/txt2voice/DEV_GUIDE.md /Users/xupeng/mycode/txt2voice/docs/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md
git commit -m "docs: add mastra hybrid runtime rollout guide"
```
