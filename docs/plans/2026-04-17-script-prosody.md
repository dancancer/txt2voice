# Script Prosody Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让台本生成链路直接产出并持久化 `tone + prosody + strength + pauseAfter`，补齐当前缺失的语气信息。

**Architecture:** 以 `SegmentScriptDraftLine` 为唯一前向契约切口，把新字段做成可选项并同步扩展 generation/repair parser、prompt 与 draft-to-dialogue 映射层。归一化逻辑不新增分支体系，只做字段透传，持久化仍复用现有 `buildSentenceData()` 默认值策略。

**Tech Stack:** TypeScript, Jest, agent runtime, existing prompt bundles, existing script persistence helpers.

---

### Task 1: 扩展 draft 契约并锁住兼容性

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/artifact-types.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts`

**Step 1: Write the failing test**

在 `artifact-memory-contract.test.ts` 增加断言，验证 `SegmentScriptDraftLine` 可以合法承载：
- `tone`
- `prosody`
- `strength`
- `pauseAfter`

同时保留原先最小字段断言，确保兼容旧 payload。

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts
```

Expected: FAIL，因为当前类型契约没有这些字段。

**Step 3: Write minimal implementation**

在 `artifact-types.ts` 的 `SegmentScriptDraftLine` 增加以上可选字段，并让 `prosody` 的结构与 `DialogueLine.prosody` 保持一致。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/context/artifact-types.ts \
  apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts
git commit -m "feat: extend segment script draft with prosody fields"
```

### Task 2: 先写失败测试，锁住 generation parser 和透传行为

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/narration-persistence.test.ts`

**Step 1: Write the failing test**

新增三个测试：

1. `segment-scripting-stage.test.ts`
   - mock LLM 返回带 `tone/prosody/strength/pauseAfter`
   - 断言 stage 产出的 `segmentScriptDraft.lines[0]` 保留这些字段

2. `script-draft-normalizer.test.ts`
   - 输入带语气字段的 line
   - 断言 normalizer 不会把这些字段丢掉

3. `narration-persistence.test.ts`
   - 用带语气字段的 draft 调 `mapSegmentScriptDraftToDialogueLines()`
   - 断言映射后的 `DialogueLine` 仍有这些字段

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts apps/web/src/lib/__tests__/narration-persistence.test.ts
```

Expected: FAIL，因为 parser 和映射层尚未透传这些字段。

**Step 3: Write minimal implementation**

先不改 prompt，只修改测试以表达目标行为。

**Step 4: Run test to verify it fails correctly**

Run same command.

Expected: 失败点集中在 draft parser / draft-to-dialogue 映射缺字段，而不是测试书写错误。

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts \
  apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts \
  apps/web/src/lib/__tests__/narration-persistence.test.ts
git commit -m "test: lock script prosody propagation behavior"
```

### Task 3: 让 script-generation 与 repair-agent 接受新字段

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`

**Step 1: Write the failing test**

在 `repair-stage.test.ts` 增加一条带 `tone/prosody/strength/pauseAfter` 的修复 payload，断言修复后的 draft 保留这些字段。

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts
```

Expected: FAIL，因为两个 agent 的 `toDraftLine()` 当前都只返回最小字段。

**Step 3: Write minimal implementation**

在两个 agent 文件中：
- 增加对 `tone` 的字符串解析
- 增加对 `strength`、`pauseAfter` 的数值解析
- 增加对 `prosody` 对象的白名单解析，只接受 `pace/pitch/energy/pauseMsAfter`
- 非法值按 `undefined` 处理，不让整段因附加字段失败

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts \
  apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts \
  apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts \
  apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts
git commit -m "feat: parse prosody metadata in runtime draft agents"
```

### Task 4: 更新 prompt，要求 LLM 输出语气与朗读参数

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/system.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`

**Step 1: Write the failing test**

扩展 `segment-scripting-stage.test.ts`，断言渲染后的 prompt 中明确出现：
- `tone`
- `prosody`
- `strength`
- `pauseAfter`

并限制 `prosody` 的子字段白名单。

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts
```

Expected: FAIL，因为当前 prompt 只声明最小字段。

**Step 3: Write minimal implementation**

在两个 prompt 文件中：
- 更新每行字段要求
- 给出语气与 prosody 的简洁生成规则
- 明确“可省略，但不可输出额外未知字段”

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add skills/script-generation/prompts/system.md \
  skills/script-generation/prompts/user.md \
  apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts
git commit -m "feat: require prosody metadata in script generation prompts"
```

### Task 5: 打通归一化与持久化映射

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/storage/persistence-helpers.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer-helpers.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/narration-persistence.test.ts`

**Step 1: Write the failing test**

如果 `script-draft-normalizer.test.ts` 和 `narration-persistence.test.ts` 还不能覆盖拆分场景，再补一条：
- 混合叙事/对白拆分后，新增行仍保留原行的语气字段

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts apps/web/src/lib/__tests__/narration-persistence.test.ts
```

Expected: FAIL，因为 `mapSegmentScriptDraftToDialogueLines()` 当前不会透传这些字段。

**Step 3: Write minimal implementation**

在 `persistence-helpers.ts` 中：
- 扩展 `SegmentScriptDraftLikeLine`
- `mapSegmentScriptDraftToDialogueLines()` 透传 `tone/prosody/strength/pauseAfter`

在 normalizer helpers 中：
- 确保所有基于对象扩展的行变换继续保留新增字段
- 必要时只在少数手工构造新行的地方补显式透传

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts apps/web/src/lib/__tests__/narration-persistence.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agent-runtime/runtime/script-production/storage/persistence-helpers.ts \
  apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer-helpers.ts \
  apps/web/src/lib/agent-runtime/runtime/script-production/helpers/script-draft-normalizer.ts \
  apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts \
  apps/web/src/lib/__tests__/narration-persistence.test.ts
git commit -m "feat: persist script prosody metadata through normalization"
```

### Task 6: 运行定向验证并做回归检查

**Files:**
- No code changes required

**Step 1: Run targeted tests**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/agent-runtime/__tests__/artifact-memory-contract.test.ts apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/script-draft-normalizer.test.ts apps/web/src/lib/__tests__/narration-persistence.test.ts
```

Expected: PASS

**Step 2: Run one broader safety test**

Run:

```bash
pnpm test -- --runInBand apps/web/src/lib/__tests__/script-generation-runner.test.ts
```

Expected: PASS，确认 runner 没被新字段破坏。

**Step 3: Inspect changed files**

Run:

```bash
git diff -- apps/web/src/lib/agent-runtime/context/artifact-types.ts \
  apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts \
  apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts \
  apps/web/src/lib/agent-runtime/runtime/script-production/storage/persistence-helpers.ts \
  skills/script-generation/prompts/system.md \
  skills/script-generation/prompts/user.md
```

Expected: 只有契约扩展、prompt 约束、字段透传，没有额外架构漂移。

**Step 4: Commit**

```bash
git add docs/plans/2026-04-17-script-prosody-design.md \
  docs/plans/2026-04-17-script-prosody.md
git commit -m "docs: plan script prosody propagation"
```
