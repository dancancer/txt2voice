# Multi LLM Model Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为台本生成链路加入统一的多 LLM 模型配置中心，支持把 `192.168.88.9:8028` 上的 Qwen 模型接入项目，并在不同模型之间稳定切换。

**Architecture:** 新增一个独立的 LLM 模型注册表模块，统一解析 `LLM_MODELS_JSON` / `LLM_DEFAULT_MODEL_ID` 和旧版 `LLM_PROVIDER` 单模型配置。台本生成链路通过 `ScriptGenerationOptions.llmModelId` 把所选模型从前端一路透传到 API、队列、重放、运行时和 `LLMService`，同时暴露只读模型列表 API 供台本工作台切换。执行过程中强制遵守 `@test-driven-development` 和 `@verification-before-completion`：每一步必须先看到失败，再做最小实现，验证通过后才能进入下一步。

**Tech Stack:** Next.js App Router, TypeScript, React 19, Bull, Jest, OpenAI SDK compatible runtime.

---

## 执行总原则

1. 任何生产代码改动前，先补对应失败测试。
2. 每个步骤完成后，必须运行计划中列出的验证命令。
3. 验证输出未达到预期，禁止进入下一步。
4. 每个 Task 完成后再做一次小范围回归，再提交。
5. 最终完成前，必须跑一轮聚合验证和一次远端模型 smoke check。

---

### Task 1: 建立 LLM 模型注册表与兼容解析层

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-model-registry.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-model-registry.test.ts`

**Step 1: Write the failing test**

写测试覆盖下面四个行为：

- `LLM_MODELS_JSON` 能解析成多个模型条目
- `LLM_DEFAULT_MODEL_ID` 能正确标记默认模型
- 未配置 `LLM_MODELS_JSON` 时，会从旧的 `LLM_PROVIDER / LLM_API_KEY / LLM_BASE_URL / LLM_MODEL` 合成单模型兼容条目
- 当 `LLM_MODELS_JSON` 中有重复 `id` 或默认模型不存在时，抛出明确错误

建议测试中使用类似下面的断言骨架：

```ts
const registry = getLLMModelRegistrySnapshot({
  LLM_MODELS_JSON: JSON.stringify([
    {
      id: "deepseek-cloud",
      label: "DeepSeek Cloud",
      provider: "custom",
      apiKey: "key-a",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
    },
    {
      id: "qwen-local",
      label: "Qwen Local",
      provider: "custom",
      apiKey: "local-key",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
    },
  ]),
  LLM_DEFAULT_MODEL_ID: "qwen-local",
} as NodeJS.ProcessEnv);

expect(registry.defaultModelId).toBe("qwen-local");
expect(registry.models.map((item) => item.id)).toEqual([
  "deepseek-cloud",
  "qwen-local",
]);
```

**预期成果：**

- 新测试文件能准确描述注册表行为
- 当前代码库下这些测试会失败，因为注册表模块尚不存在

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-model-registry.test.ts
```

Expected:

- FAIL
- 报错应指向 `llm-model-registry.ts` 缺失或导出函数不存在，而不是测试拼写错误

**Step 3: Write minimal implementation**

实现一个最小但完整的注册表模块，至少包含：

```ts
export interface LLMModelRegistryItem {
  id: string;
  label: string;
  provider: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface LLMModelRegistrySnapshot {
  defaultModelId: string;
  models: LLMModelRegistryItem[];
  source: "registry" | "legacy";
}
```

并实现：

- `getLLMModelRegistrySnapshot(env?)`
- `getLLMModelById(modelId, env?)`
- `getDefaultLLMModel(env?)`

实现要求：

- JSON 配置优先于旧配置
- 旧配置兜底时生成稳定的兼容 `id`，例如 `legacy-default`
- 不在这里探测远端可用性，这一层只做纯配置解析

**预期成果：**

- 注册表解析逻辑可独立复用
- 兼容旧配置，不会一刀切破坏现有部署

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-model-registry.test.ts
```

Expected:

- PASS
- 所有断言都命中配置解析逻辑，而不是通过 mock 绕过去

**Step 5: Gate before next task**

进入下一步前必须确认：

- 注册表测试单测全绿
- 代码中没有把 Qwen 本地地址硬编码进“解析逻辑默认值”里
- 仍然支持 legacy 单模型配置

**Step 6: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-model-registry.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-model-registry.test.ts
git commit -m "feat: add llm model registry"
```

---

### Task 2: 让 `LLMService` 与 Agent Runtime 支持按模型 ID 解析 provider

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

**Step 1: Write the failing test**

扩展现有测试，覆盖：

- `getConfiguredLLMProvider("qwen-local")` 返回指定模型对应的 provider 快照
- `getConfiguredLLMProvider()` 在未传 `modelId` 时返回默认模型
- `createObservedDefaultAdapter()` 能接收指定 provider，而不是永远偷用全局默认值
- `LLMService.callLLM()` 继续走 runtime，不退回直接 SDK 调用

建议新增类似断言：

```ts
expect(getConfiguredLLMProvider("qwen-local")).toEqual({
  name: "custom",
  apiKey: "local-key",
  baseURL: "http://192.168.88.9:8028/v1",
  model: "Qwen3.5-9B-GGUF-Q4_K_M",
});
```

**预期成果：**

- 测试先把“默认模型”和“指定模型”两个分支钉死
- 当前实现会失败，因为 `llm-service.ts` 还只认单套环境变量

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-service.test.ts
pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts
```

Expected:

- FAIL
- 失败原因应指向 provider 解析或 adapter 默认值逻辑不满足新断言

**Step 3: Write minimal implementation**

实现最小改动：

- 在 `llm-service.ts` 中接入 `llm-model-registry.ts`
- 把 `getConfiguredLLMProvider` 签名扩展为 `getConfiguredLLMProvider(modelId?: string, env = process.env)`
- 保留 `executeProviderLLMCall()` 行为不变，只替换 provider 来源
- 让 `createObservedDefaultAdapter()` 支持外部传入已解析的 provider
- 在 `run-script-production-workflow.ts` 中为默认 adapter 注入显式 provider，避免 workflow 内部丢失模型选择

**预期成果：**

- LLM provider 解析层从“全局单例”升级为“默认模型 + 显式模型 ID”
- Agent Runtime 不再偷偷覆盖任务级选择

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-service.test.ts
pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts
```

Expected:

- PASS
- `createMock` 仍然不会在 `callLLM()` 路径被调用

**Step 5: Gate before next task**

进入下一步前必须确认：

- `getConfiguredLLMProvider("qwen-local")` 可以稳定返回指定模型
- 未指定 `modelId` 时仍兼容旧行为
- 没有把“指定模型解析”逻辑散落到多个文件里重复实现

**Step 6: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/adapter.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts
git commit -m "feat: resolve llm providers by model id"
```

---

### Task 3: 把 `llmModelId` 从台本生成请求贯通到队列、重放和运行时

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/options.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/dedupe.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/enqueue.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/replay-payload.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/script/generate/route.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generate-route.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/task-replay-payload-script.test.ts`

**Step 1: Write the failing test**

补两组测试：

1. 路由测试覆盖：
   - POST `/script/generate` 能把 `options.llmModelId` 写入入队 payload
   - PATCH `/script/generate` 重新生成段落时也能带上 `llmModelId`
2. 重放载荷测试覆盖：
   - 任务重放能从 `taskData.metadata.queuePayload.options.llmModelId` 中提取模型选择
   - dedupe key 在不同 `llmModelId` 下不同，避免不同模型复用同一个脚本任务

建议断言：

```ts
expect(mockEnqueueScript).toHaveBeenCalledWith(
  expect.objectContaining({
    options: expect.objectContaining({
      llmModelId: "qwen-local",
    }),
  })
);
```

**预期成果：**

- 测试会先把“请求透传、任务重放、去重隔离”这三个容易漏掉的点固定住
- 当前实现会失败，因为 `ScriptGenerationOptions` 还没有 `llmModelId`

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/script-generate-route.test.ts
pnpm --filter web test -- --runInBand src/lib/__tests__/task-replay-payload-script.test.ts
```

Expected:

- FAIL
- 失败应落在缺少 `llmModelId` 透传或提取逻辑

**Step 3: Write minimal implementation**

按最短路径实现：

- 在 `ScriptGenerationOptions` 中新增 `llmModelId?: string`
- `resolveScriptGenerationOptions()` 保留可选字段，不强行注入无意义默认值
- `route.ts` 的 POST / PATCH 允许接收并透传 `options.llmModelId`
- `task-queue/dedupe.ts` 把 `llmModelId` 纳入脚本任务去重范围
- `task-queue/replay-payload.ts` 为脚本任务补 `queuePayload.options` 提取
- `script-generation-runner.ts` 把 `options.llmModelId` 继续交给 workflow
- `script-generator.ts` 的旧路径也要能按 `llmModelId` 解析 `LLMService`，避免新旧两套台本入口行为不一致

**预期成果：**

- 任务级模型选择成为脚本任务的一等参数
- 同一本书用不同模型生成时，不会因为 dedupe 误复用旧任务

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/script-generate-route.test.ts
pnpm --filter web test -- --runInBand src/lib/__tests__/task-replay-payload-script.test.ts
```

Expected:

- PASS
- `POST` 和 `PATCH` 路径都能断言到 `llmModelId`

**Step 5: Gate before next task**

进入下一步前必须确认：

- `llmModelId` 已经不是只在前端表单里存在的“假参数”
- 队列去重和任务重放都理解这个字段
- 旧入口 `new ScriptGenerator()` 不会静默丢失模型选择

**Step 6: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/types.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/options.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/dedupe.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/enqueue.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/replay-payload.ts /Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/script/generate/route.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generate-route.test.ts /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/task-replay-payload-script.test.ts
git commit -m "feat: propagate llm model id through script pipeline"
```

---

### Task 4: 提供只读的模型列表 API，作为前端配置中心入口

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/llm/models/route.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/llm/models/README.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-models-route.test.ts`

**Step 1: Write the failing test**

写测试覆盖：

- GET `/api/llm/models` 返回当前模型列表
- 响应中包含 `defaultModelId`
- 每个条目至少包含 `id`、`label`、`provider`、`model`、`baseURL`
- 不泄漏完整 `apiKey`

建议断言：

```ts
expect(payload.data.defaultModelId).toBe("qwen-local");
expect(payload.data.models[0]).toEqual(
  expect.objectContaining({
    id: expect.any(String),
    label: expect.any(String),
    provider: expect.any(String),
    model: expect.any(String),
  })
);
expect(JSON.stringify(payload)).not.toContain("local-key");
```

**预期成果：**

- 测试把前端需要的只读配置面钉死
- 当前代码会失败，因为 `/api/llm/models` 尚不存在

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-models-route.test.ts
```

Expected:

- FAIL
- 错误应为 route 缺失或返回结构不匹配

**Step 3: Write minimal implementation**

实现一个只读 route：

- 调用 `getLLMModelRegistrySnapshot()`
- 返回安全字段，不返回 `apiKey`
- 返回 `defaultModelId` + `models[]`
- 在 README 中说明此 route 只用于 UI 切换与调试，不做健康检查

**预期成果：**

- 前端不需要直接读环境变量
- “配置中心”有了统一入口，但仍保持只读和简单

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-models-route.test.ts
```

Expected:

- PASS
- 响应结构稳定，且敏感信息不外泄

**Step 5: Gate before next task**

进入下一步前必须确认：

- API 的职责只是“列出配置”，没有偷做网络探测
- 响应结构足够前端渲染选择器
- 敏感字段没有泄漏

**Step 6: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/app/api/llm/models/route.ts /Users/xupeng/mycode/txt2voice/apps/web/src/app/api/llm/models/README.md /Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-models-route.test.ts
git commit -m "feat: expose llm model registry api"
```

---

### Task 5: 在高级台本工作台加入模型切换，并把选择写入所有生成入口

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptGenerationActions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptScopeActions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/index.tsx`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/components/ui/select.tsx` only if testing或交互缺口必须补；否则不要动
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/__tests__/script-studio-model-switching.test.tsx`

**Step 1: Write the failing test**

写一个页面级 smoke test，至少覆盖：

- 页面挂载后会请求 `/api/llm/models`
- 书籍级“全书台本生成”请求体会带上当前选择的 `llmModelId`
- 章节/段落重生成会沿用同一个 `llmModelId`

建议把复杂子组件 mock 掉，只盯这三个行为，避免测试变成 UI 噪声。

**预期成果：**

- 测试先把“加载模型列表 + 生成请求透传”这两个用户最关心的行为卡住
- 当前代码会失败，因为前端还没有模型选择状态

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected:

- FAIL
- 失败应指向缺少 `/api/llm/models` 拉取或生成请求体中没有 `llmModelId`

**Step 3: Write minimal implementation**

最小实现策略：

- 在 `useScriptGenerationActions.ts` 中增加：
  - `llmModels`
  - `selectedLLMModelId`
  - `loadLLMModels()`
  - 统一的 `buildScriptGenerationOptions()`
- 页面初始化时拉取 `/api/llm/models`
- 在 `page-container/index.tsx` 的书籍级面板加 `Select`
- 所有会触发台本生成的入口都通过同一份 `options.llmModelId`
- 当模型列表加载失败时，明确 toast 提示，不静默回退成空值

**预期成果：**

- 用户能在高级台本工作台看到当前模型并切换
- 全书、增量、章节、段落、重生成入口行为一致

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter web test -- --runInBand src/app/__tests__/script-studio-model-switching.test.tsx
```

Expected:

- PASS
- 测试里能断言 fetch 请求体含 `llmModelId`

**Step 5: Gate before next task**

进入下一步前必须确认：

- 前端只维护一份当前模型状态
- 没有出现“全书走一个模型、重生成走另一个默认模型”的分叉
- 选择器加载失败时，用户能看到明确错误，而不是悄悄退回默认值

**Step 6: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptGenerationActions.ts /Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptScopeActions.ts /Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page-container/index.tsx /Users/xupeng/mycode/txt2voice/apps/web/src/app/__tests__/script-studio-model-switching.test.tsx
git commit -m "feat: add llm model switcher to script studio"
```

---

### Task 6: 更新环境模板、Compose 透传、文档与远端 smoke check

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/.env.local.example`
- Modify: `/Users/xupeng/mycode/txt2voice/.env.docker`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/.env.example`
- Modify: `/Users/xupeng/mycode/txt2voice/docker-compose.yml`
- Modify: `/Users/xupeng/mycode/txt2voice/docker-compose.prod.yml`
- Modify: `/Users/xupeng/mycode/txt2voice/README.md`
- Modify: `/Users/xupeng/mycode/txt2voice/DEV_GUIDE.md`

**Step 1: Write the verification checklist before editing docs**

先明确本任务的目标输出：

- 示例环境变量改成以 `LLM_MODELS_JSON` / `LLM_DEFAULT_MODEL_ID` 为主
- 旧变量标记为兼容模式，不删除
- 示例中包含 `qwen-local` 条目，地址为 `http://192.168.88.9:8028/v1`
- 文档里说明当前远端返回的实际模型名是 `Qwen3.5-9B-GGUF-Q4_K_M`

**预期成果：**

- 文档改动有明确验收标准，不是随手补一句

**Step 2: Run pre-edit verification to prove the gap exists**

Run:

```bash
rg -n "LLM_MODELS_JSON|LLM_DEFAULT_MODEL_ID|qwen-local|8028" /Users/xupeng/mycode/txt2voice/.env.local.example /Users/xupeng/mycode/txt2voice/.env.docker /Users/xupeng/mycode/txt2voice/apps/web/.env.example /Users/xupeng/mycode/txt2voice/README.md /Users/xupeng/mycode/txt2voice/DEV_GUIDE.md
```

Expected:

- 结果为空或信息明显不完整

**Step 3: Write minimal implementation**

按最小必要信息更新：

- 示例环境变量给出一份双模型 JSON：一个 DeepSeek，一个 `qwen-local`
- `docker-compose*.yml` 增加 `LLM_MODELS_JSON` / `LLM_DEFAULT_MODEL_ID` 透传
- README / DEV_GUIDE 说明：
  - 新配置优先
  - 旧配置仍兼容
  - `192.168.88.9:8028/v1/models` 当前实际返回 `Qwen3.5-9B-GGUF-Q4_K_M`
  - 若未来换成 4B，只需改配置，不必改代码

**预期成果：**

- 本地、Docker、生产三条启动路径都知道如何配置多模型
- 文档把“4B 预期 vs 9B 实际”这个关键事实说清楚

**Step 4: Run docs/config verification**

Run:

```bash
rg -n "LLM_MODELS_JSON|LLM_DEFAULT_MODEL_ID|qwen-local|Qwen3.5-9B-GGUF-Q4_K_M|8028" /Users/xupeng/mycode/txt2voice/.env.local.example /Users/xupeng/mycode/txt2voice/.env.docker /Users/xupeng/mycode/txt2voice/apps/web/.env.example /Users/xupeng/mycode/txt2voice/docker-compose.yml /Users/xupeng/mycode/txt2voice/docker-compose.prod.yml /Users/xupeng/mycode/txt2voice/README.md /Users/xupeng/mycode/txt2voice/DEV_GUIDE.md
```

Expected:

- 能命中新配置说明、Qwen 本地地址和实际模型名

**Step 5: Run final code verification**

Run:

```bash
pnpm --filter web test -- --runInBand src/lib/__tests__/llm-model-registry.test.ts src/lib/__tests__/llm-service.test.ts src/lib/agent-runtime/__tests__/llm-adapter.test.ts src/lib/__tests__/script-generate-route.test.ts src/lib/__tests__/task-replay-payload-script.test.ts src/lib/__tests__/llm-models-route.test.ts src/app/__tests__/script-studio-model-switching.test.tsx
pnpm --filter web typecheck
```

Expected:

- 全部 PASS
- TypeScript 无新增错误

**Step 6: Run remote smoke check**

Run:

```bash
curl -sS http://192.168.88.9:8028/v1/models
```

Expected:

- 返回 OpenAI compatible 风格 JSON
- `data[0].id` 或等价字段包含 `Qwen3.5-9B-GGUF-Q4_K_M`

**Step 7: Gate before declaring completion**

进入“完成”前必须确认：

- 单测、typecheck、远端 smoke check 三个证据都齐
- 文档明确写出了新旧配置关系
- 实际远端模型名与代码/示例配置一致

**Step 8: Commit**

```bash
git add /Users/xupeng/mycode/txt2voice/.env.local.example /Users/xupeng/mycode/txt2voice/.env.docker /Users/xupeng/mycode/txt2voice/apps/web/.env.example /Users/xupeng/mycode/txt2voice/docker-compose.yml /Users/xupeng/mycode/txt2voice/docker-compose.prod.yml /Users/xupeng/mycode/txt2voice/README.md /Users/xupeng/mycode/txt2voice/DEV_GUIDE.md
git commit -m "docs: add multi llm model configuration guide"
```

---

## 最终验收清单

全部任务完成后，必须逐条确认：

1. 后端可以从注册表中解析多个模型，并有默认模型。
2. `llmModelId` 能从前端透传到脚本生成运行时。
3. 相同书籍在不同模型下不会命中相同 dedupe key。
4. 任务重放不会丢失原先的模型选择。
5. 前端能加载模型列表并切换当前模型。
6. 文档和示例配置明确包含 `qwen-local -> http://192.168.88.9:8028/v1`。
7. 远端模型 smoke check 的实际模型名与配置一致。

如果以上任一条无法给出验证证据，则不算完成。
