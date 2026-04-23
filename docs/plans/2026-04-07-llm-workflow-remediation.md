# LLM Workflow Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前 LLM 工作流中“定义层、运行时、预算治理、模型策略”脱节的问题，让 `workflow / agent / skill` 重新成为可执行契约，而不是文档摆设。

**Architecture:** 本次整改分四条主线推进：先对齐 workflow 声明与 runtime DAG，再把 skill/agent 元数据真正接入运行时校验与 prompt 装载；随后补上 character-discovery 与 quality 阶段的上下文预算治理；最后落地 model policy 到 provider / model / requestOptions 解析层，并用测试和观测把行为钉死。整体策略坚持最小闭环，先修契约和护栏，再扩展能力。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Bull-based LLM runtime, OpenAI-compatible providers.

---

## 执行总原则

1. 先修“定义是否可信”，再修“模型是否更强”。
2. 每个任务必须产出一个明确工件：代码、测试、文档或运行时校验。
3. 每个任务完成后必须立即验证，验证不过不能进入下一步。
4. 优先消除隐式逻辑，避免继续增加“配置看起来能改、实际上改不动”的坏味道。
5. 所有新增行为必须有测试覆盖，优先覆盖契约断裂点和回归高风险点。

---

### Task 1: 对齐 workflow 声明与实际执行 DAG

**目标产出：**
- `workflow.toml` 与 runtime 使用同一套阶段列表
- `validation` 阶段要么进入声明文件，要么从 runtime 中消失
- 增加一个测试，防止后续再次分叉

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

**Step 1: 写失败测试，固定 workflow 声明与 runtime 阶段顺序**

**产出：**
- 在 `workflow-runtime.test.ts` 新增断言，比较声明式 workflow 阶段数组和 runtime 实际注册阶段数组

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Expected: FAIL，错误应明确指出 `validation` 阶段存在差异

**Step 2: 统一阶段定义来源**

**产出：**
- 选定单一真相源：
  - 优先方案：把 `validation` 明确加入 [`workflow.toml`](/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml)
  - 同时让 runtime 从定义加载结果构建阶段列表，而不是再手写一份数组

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Expected: PASS

**Step 3: 验证现有主流程没有被阶段顺序改坏**

**产出：**
- workflow 层回归通过，确保 `prepare -> character_discovery -> segment_scripting -> validation -> segment_repair -> quality_judgement -> persist -> manual_review_handoff -> complete` 仍然可执行

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

---

### Task 2: 让 skill / agent / workflow 定义重新成为执行契约

**目标产出：**
- stage 不再直接假设 prompt 文件路径和隐式契约
- 至少在主链路中消费并校验 `promptBundle`、`contextRequirements`、`toolAllowlist`
- `character-discovery` 与其他阶段具备一致的 fail-fast 合约校验

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/load-definition.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定 promptBundle 必须被加载**

**产出：**
- `definition-loader.test.ts` 新增断言：
  - `promptBundle` 中声明的路径必须存在
  - stage 读取 prompt 时必须来自 skill 定义，而不是固定硬编码文件名

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Expected: FAIL，现有实现还没有把 `promptBundle` 变成执行契约

**Step 2: 提取统一的 skill runtime loader**

**产出：**
- 一个共享能力，例如 `loadSkillRuntimeBundle(...)`
- 返回：
  - `definition`
  - `instructions`
  - `prompts.systemPrompt`
  - `prompts.userPrompt`
- stage 代码不再自己拼 `prompts/system.md`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Expected: PASS

**Step 3: 给 character-discovery 补上 contract 校验**

**产出：**
- `run-character-discovery-stage.ts` 和 scripting / quality 一样，明确校验：
  - `compatibleAgents`
  - `contextRequirements`
  - `toolAllowlist`
- 如果 skill 声明与 runtime 不匹配，应直接 fail-fast

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS，且新增一个“不匹配即失败”的用例

**Step 4: 统一各阶段的 skill contract 检查方式**

**产出：**
- 把重复的 `assertSkillCompatibleWithAgent` / `assertSkillContract` 收拢成共享 helper
- 减少四个 stage 各写一套规则的分叉风险

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

---

### Task 3: 补齐 character-discovery 与 quality 的 prompt budget 治理

**目标产出：**
- character-discovery 超预算时有显式降级策略
- quality 阶段不再把完整失败 artifact 无脑塞进 prompt
- prompt 预算控制从“算出来”变成“真正执行”

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/quality-judge-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`

**Step 1: 写失败测试，固定 character-discovery 的超预算行为**

**产出：**
- 一个测试覆盖：当 sample text 超过 budget 时，stage 不得继续原样发送
- 明确期待行为：
  - 要么裁剪到安全长度
  - 要么改成更小样本
  - 要么返回明确的降级错误，而不是沉默超发

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: FAIL

**Step 2: 实现 character-discovery 的预算执行策略**

**产出：**
- 推荐最小实现：
  - 在 `run-character-discovery-pass.ts` 侧先限制样本字符数
  - 在 `run-character-discovery-stage.ts` 侧仍保留最终 budget gate
- 保证超预算不会继续裸发给模型

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS

**Step 3: 写失败测试，固定 quality prompt 的失败 artifact 裁剪规则**

**产出：**
- 一个测试覆盖：
  - `failedArtifact.rawResponse` 很大时，prompt 中只保留摘要、截断片段或结构化要点
  - prompt 仍包含足够的判定证据，但不会无限膨胀

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL

**Step 4: 实现 quality prompt 的裁剪与摘要层**

**产出：**
- 新增一个最小摘要函数，例如：
  - 保留 `kind`
  - 保留 `provider` / `model`
  - `rawResponse` 截断到固定长度
  - `structuredResult` 只保留必要字段
- `quality-judge-agent.ts` 渲染 prompt 时使用摘要后的 artifact，而不是原始大对象

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 5: 验证上下文预算工具本身没有回归**

**产出：**
- `build-context.ts` 的预算行为仍然稳定

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Expected: PASS

---

### Task 4: 落地 model policy 到运行时 provider / model 解析层

**目标产出：**
- skill 的 `modelPolicy` 不再是死字段
- 各 stage 至少能根据 policy 选择不同 provider / model / requestOptions
- 去掉默认所有阶段共用单一旧模型的隐式行为

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/model-policy.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定 policy 到请求参数的映射**

**产出：**
- `balanced`、`cheap-repair`、`quality` 等 policy 的测试夹具
- 覆盖：
  - 选择了预期 provider / model
  - 选择了预期 `temperature` / `maxTokens`
  - stage 会把 skill 的 `modelPolicy` 传递给 adapter

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Expected: FAIL

**Step 2: 引入统一的 model policy resolver**

**产出：**
- 新建 `model-policy.ts`
- 至少导出：
  - `resolveLLMExecutionPolicy(modelPolicy, env?)`
  - 返回 `provider` 和 `requestOptions`
- 初版可以先支持：
  - `balanced`
  - `cheap-repair`
  - `quality`
  - fallback `default`

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Expected: PASS

**Step 3: 把各 stage 的 skill policy 接进 adapter 调用**

**产出：**
- 四个主 stage 在创建 agent 或发请求时，显式传入 resolved provider / requestOptions
- `createObservedDefaultAdapter()` 不再只能偷吃全局默认 provider

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 4: 修正 `llm-service.ts` 的默认策略入口**

**产出：**
- 不再把单一旧模型当成唯一默认现实
- 如果已存在多模型注册表逻辑，就通过 registry 解析默认模型
- 如果暂时还没有 registry，则至少把默认模型升级为明确可配置且可被 policy 覆盖

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/llm-service.test.ts`
- Expected: PASS

---

### Task 5: 为定义驱动 runtime 增加回归观测与文档

**目标产出：**
- 新行为有文档说明
- 运行时 trace / summary 能暴露关键配置来源
- 后续 review 不需要重新手工考古

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/workflows/script-production/WORKFLOW.md`
- Modify: `/Users/xupeng/mycode/txt2voice/agents/coordinator/AGENT.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/SKILL.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/character-extraction/SKILL.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/SKILL.md`

**Step 1: 暴露 runtime metadata 中的 policy / budget 摘要**

**产出：**
- 每次 workflow run 至少可追踪：
  - 使用的 skillId
  - 使用的 modelPolicy
  - 是否发生 budget trimming
  - quality prompt 是否裁剪 failedArtifact

**验证方法：**
- Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/script-generation-runner.test.ts`
- Expected: PASS 或补一个 metadata 断言后 PASS

**Step 2: 更新 workflow / skill / agent 文档，消除虚假描述**

**产出：**
- `WORKFLOW.md` 明确包含 `validation`
- skill 文档写清楚：
  - 哪些字段已被 runtime 消费
  - 哪些字段只是作者注释，不可当执行策略
- 如果本轮已全部接通，则文档改为“全部为执行契约”

**验证方法：**
- Run: `rg -n "validation|modelPolicy|budget|promptBundle" /Users/xupeng/mycode/txt2voice/workflows/script-production/WORKFLOW.md /Users/xupeng/mycode/txt2voice/skills/script-generation/SKILL.md /Users/xupeng/mycode/txt2voice/skills/character-extraction/SKILL.md /Users/xupeng/mycode/txt2voice/skills/quality-judgement/SKILL.md`
- Expected: 能找到与本轮实现一致的说明

---

## 完成标准

满足以下条件，才算这一轮整改完成：

1. workflow 声明与 runtime DAG 完全一致。
2. 四个主 stage 都通过统一的 skill runtime bundle 装载 prompt 和契约。
3. `character-discovery` 与 `quality` 阶段都有真实生效的 prompt budget 防护。
4. `modelPolicy` 已经能影响 provider / model / requestOptions，而不是死字段。
5. 至少以下测试全绿：
   - `src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
   - `src/lib/agent-runtime/__tests__/definition-loader.test.ts`
   - `src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
   - `src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
   - `src/lib/agent-runtime/__tests__/quality-stage.test.ts`
   - `src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
   - `src/lib/__tests__/llm-service.test.ts`

## 建议执行顺序

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5

原因：
- 先把声明和 runtime 对齐，否则后面的“配置生效”无从谈起。
- 再把 contract 变成真约束，否则 budget / model policy 接进去也只是继续漂。
- budget 防护先于模型升级，可以先止血成本和稳定性问题。
- 最后才是 model policy 落地和观测补齐。

Plan complete and saved to `/Users/xupeng/mycode/txt2voice/docs/plans/2026-04-07-llm-workflow-remediation.md`.
