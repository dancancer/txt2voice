# Mastra-Only Runtime And Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 彻底移除当前项目里的 native executor、shadow/hybrid 轨道、旧 `llm-service.ts` / legacy `script-generator` 残留，把 LLM 工作流收敛成 Mastra 单一路径，并接入 `Mastra Studio` 作为唯一开发与调试入口。

**Architecture:** 这次整改不走过渡期路线。执行顺序必须是：先删除其他所有轨道，再补齐 Mastra 路径，再把 Studio 接进来。中间允许分支在短时间内处于不可编译状态，但每一阶段结束时都必须恢复到“只有 Mastra 一条事实链路”的一致状态。根据 Mastra 官方资料，Studio 的本地开发入口是 `mastra dev`，本地服务通常跑在 `http://localhost:4111`；同时 2026 年 3 月的官方说明表明，Studio 可以共享主 Mastra server 的 auth 配置，因此本计划会把 Studio 接入和 server/auth 结构一起设计。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Prisma, Bull queue, `@mastra/core`, official Mastra CLI/Studio flow, OpenAI-compatible model providers.

---

## 执行总原则

1. 不保留任何长期双轨。没有 `native`、没有 `shadow`、没有 `mastra-disabled`。
2. 删除优先于兼容。不能为了“保险”保留旧入口。
3. Mastra 路径补全后，所有 workflow/agent/skill/runtime/trace/persistence 都只认这一条链。
4. Studio 是最终运行面的一部分，不是额外 demo。
5. 所有文档、脚本、测试、导航入口都必须反映“Mastra-only”事实。

### Task 1: 先删除其他所有执行轨道与切换开关

**Files:**
- Delete: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/executor-policy.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-single-segment-types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Delete or Rewrite: 所有 stage 文件中的 `executor` / `shadowMode` / `onShadowResult` 参数
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/executor-policy.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`

**Step 1: 写失败测试，固定仓库不再支持 executor 切换**

覆盖点：
- 不再存在 `native` / `mastra-disabled` / `shadow` 语义
- 顶层 workflow 不再读取 `AGENT_RUNTIME_EXECUTOR`
- stage 输入参数中不再出现 `executor`、`shadowMode`、`onShadowResult`

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/executor-policy.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
Expected: FAIL

**Step 2: 删除开关与并列路径参数**

要求：
- 直接删除 `executor-policy.ts`
- workflow 调度只保留一套 stage 调用接口
- 所有 script-production 中转类型同步删字段

**Step 3: 删除相关测试与断言里的旧语义**

要求：
- 删除所有断言 `executor === "mastra"`、`mastra-disabled`、`shadow mode` 的测试分支
- 让测试只验证 Mastra 单路径

**Step 4: 运行最小回归，允许此时因 Mastra 实现未补齐而失败**

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
Expected: 失败原因只应是“Mastra 路径未实现”，而不是残余 executor 切换逻辑。

**Step 5: 提交**

```bash
git add apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts apps/web/src/lib/agent-runtime/runtime/script-production/run-single-segment-types.ts apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts apps/web/src/lib/agent-runtime/__tests__/executor-policy.test.ts
git rm apps/web/src/lib/agent-runtime/runtime/executor-policy.ts
git commit -m "refactor: remove runtime executor switching and non-mastra tracks"
```

### Task 2: 删除 native stage 实现、shadow diff 设施和 hybrid 执行壳层

**Files:**
- Modify or Rewrite: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify or Rewrite: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify or Rewrite: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify or Rewrite: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Delete: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定不再有 native/shadow 分支**

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts`
Expected: FAIL

**Step 2: 把 stage 文件收敛成单一 Mastra 版本**

要求：
- 不再出现 `run*StageNative`
- 不再出现 `buildShadowInput`
- 不再出现 `nativePromise` / `shadowPromise`
- stage 文件如果保留原名，内部必须直接执行 Mastra runtime

**Step 3: 删除 shadow diff artifact 与 trace**

要求：
- runtime store 不再保存 shadow diff
- trace taxonomy 不再记录 shadow 比较
- 任何 `createShadowDiffPayload` 调用全部移除

**Step 4: 回归扫描**

Run: `rg -n "run.*Native|shadowMode|onShadowResult|nativePromise|shadowPromise|shadow-diff|createShadowDiffPayload" apps/web/src/lib/agent-runtime`
Expected: 无命中

**Step 5: 提交**

```bash
git add apps/web/src/lib/agent-runtime/runtime/stages apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts apps/web/src/lib/agent-runtime/runtime/write-trace.ts apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts
git rm apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts
git commit -m "refactor: delete native and shadow stage implementations"
```

### Task 3: 补齐 Mastra 单路径执行能力，恢复四个核心 stage

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-skill.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- Create or Rewrite: 真正的 Mastra stage 执行文件（如果当前缺失）
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Test: 四个 stage 测试

**Step 1: 写失败测试，固定 Mastra stage 不允许再回落其他层**

覆盖点：
- `character_discovery`
- `segment_scripting`
- `segment_repair`
- `quality_judgement`

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts src/lib/agent-runtime/__tests__/mastra-compiler.test.ts src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts`
Expected: FAIL

**Step 2: 让 Mastra runtime 真正具备这些能力**

要求：
- 能从 definitions 编译 workflow/agent/skill
- 能执行工具
- 能拿到 provider/model
- 能产出与当前业务契约一致的 artifact、manual review handoff、trace、persistence 输入

**Step 3: 恢复主流程回归**

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
Expected: PASS

**Step 4: 提交**

```bash
git add apps/web/src/lib/agent-runtime/mastra/runtime apps/web/src/lib/agent-runtime/mastra/compiler apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts
git commit -m "feat: restore llm workflow on a mastra-only runtime"
```

### Task 4: 删除旧 `llm-service.ts` 轨道与 legacy `script-generator` 残留

**Files:**
- Modify or Delete: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/ops/llm-execute.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/README.md`
- Modify: 所有仍使用 `"script-generator"` 作为 provider/source/error label 的文件
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

**Step 1: 写失败测试，固定仓库运行时不再依赖旧 `llm-service.ts` 作为主入口**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/llm-service.test.ts src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
Expected: FAIL

**Step 2: 把 provider/model 解析并入 Mastra 主路径**

要求：
- provider 解析只保留一套真相源
- queue worker 和 runtime 不再走另一套业务语义
- `llm-service.ts` 若保留，只能是最薄的 deprecated shim；能删就删

**Step 3: 清理 `script-generator` 命名残留**

Run: `rg -n "script-generator|llm-service" apps/web/src/lib docs`
Expected: 代码层只剩允许的 archive 或 shim 引用

**Step 4: 提交**

```bash
git add apps/web/src/lib/llm-service.ts apps/web/src/lib/llm-runtime.ts apps/web/src/lib/task-queue/ops/llm-execute.ts apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts apps/web/src/lib/script-generation-runner.ts apps/web/src/lib/README.md apps/web/src/lib/__tests__/llm-service.test.ts apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts
git commit -m "refactor: remove legacy llm service and script generator tracks"
```

### Task 5: 接入 Mastra Studio 作为唯一开发与调试入口

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/mastra/index.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/package.json`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/components/Navigation.tsx`
- Create or Modify: `/Users/xupeng/mycode/txt2voice/apps/web/.env.example`
- Create: `/Users/xupeng/mycode/txt2voice/docs/technical/MASTRA_STUDIO_RUNBOOK.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`

**Step 1: 建立正式 Mastra 入口目录**

要求：
- 按官方本地开发结构创建 `src/mastra/index.ts`
- 从这里导出当前项目的 agents、workflows、tools
- 不再让 Studio 依赖零散 `lib/agent-runtime/mastra/*` 文件去猜装配关系

**Step 2: 添加官方本地 Studio 启动脚本**

根据 Mastra 官方资料，本地 Studio 通过 `mastra dev` 启动，默认服务通常在 `http://localhost:4111`。

要求：
- 在 `package.json` 增加类似 `dev:mastra` 的脚本
- 若项目缺少官方 CLI 依赖，补齐与当前 `@mastra/core` 匹配的官方包
- 在 runbook 里明确端口、环境变量和启动顺序

**Step 3: 给应用内加 Studio 入口**

要求：
- 在主导航或 LLM/调试相关入口中增加一个显式链接，指向配置化的 Studio URL
- 默认指向本地 `http://localhost:4111`

**Step 4: 设计 Studio auth 挂点**

根据 2026-03 官方说明，Studio 可以共享主 Mastra server 的 auth 配置。

要求：
- 在 `create-mastra-runtime.ts` 预留 `server.auth` / `server.rbac` 配置位
- 开发环境可先空实现，但配置结构必须落位
- runbook 写明本地无 auth 与部署时加 auth 的分界线

**Step 5: 验证**

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts`
Expected: PASS

Run: `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm run dev:mastra`
Expected: Studio 可启动，默认可在 `http://localhost:4111` 访问

**Step 6: 提交**

```bash
git add apps/web/src/mastra/index.ts apps/web/package.json apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts apps/web/src/components/Navigation.tsx apps/web/.env.example docs/technical/MASTRA_STUDIO_RUNBOOK.md apps/web/src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts
git commit -m "feat: integrate mastra studio as the sole runtime workspace"
```

### Task 6: 清理 hybrid/native 文档与测试残留，完成全量验证

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docs/archive/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md`
- Modify: `/Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`
- Modify: `/Users/xupeng/mycode/txt2voice/docs/archive/plans/2026-04-01-mastra-hybrid-runtime.md`
- Modify: `/Users/xupeng/mycode/txt2voice/docs/archive/plans/2026-04-01-mastra-hybrid-runtime-design.md`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/README.md`
- Modify: 所有 stage tests 中的旧 `executor: "mastra"` / shadow 断言

**Step 1: 扫描遗留表述**

Run: `rg -n "native|hybrid|shadow mode|mastra-disabled|AGENT_RUNTIME_EXECUTOR" apps/web/src docs`
Expected: 找出所有残留点

**Step 2: 文档收口**

要求：
- 当前文档只描述 Mastra-only
- 历史 hybrid 方案文档保留但必须显式标记为 archived
- README 不再把 native/runtime switch 写成现状

**Step 3: 全量回归**

Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/mastra-runtime-bootstrap.test.ts src/lib/agent-runtime/__tests__/mastra-compiler.test.ts src/lib/agent-runtime/__tests__/workflow-runtime.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts src/app/__tests__/script-studio-model-switching.test.tsx`
Expected: PASS

Run: `pnpm --filter web typecheck`
Expected: PASS

Run: `pnpm --filter web build`
Expected: PASS

**Step 4: 提交**

```bash
git add apps/web/src docs
git commit -m "chore: finalize mastra-only runtime and studio cutover"
```
