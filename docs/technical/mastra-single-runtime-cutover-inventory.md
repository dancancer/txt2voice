# Mastra Single Runtime Cutover Inventory

> 更新日期：2026-04-08
>
> 目的：列出当前仓库中所有与 LLM runtime 相关的并列轨道、删除范围和保留目标，作为 Mastra-only 收敛的施工清单。

## 1. 最终保留目标

最终只保留以下三类能力：

- `definitions`：`agents/`、`skills/`、`workflows/`
- `Mastra compiler/runtime`：`apps/web/src/lib/agent-runtime/mastra/*`
- `业务 orchestration/persistence`：`apps/web/src/lib/agent-runtime/runtime/script-production/*` 与相关 store/trace/manual-review/persist 层

不会保留：

- native executor
- shadow diff / hybrid rollout 设施
- runtime executor 环境变量切换
- 旧 `llm-service.ts` 主运行入口
- 误导性的 legacy `script-generator` 命名残留

## 2. 当前并列轨道

### A. Native executor 主轨道

状态：

- 已删除入口与实现

现状：

- 这是当前默认主路径。
- 通过 `executor-policy.ts` 解析 `native / mastra / mastra-disabled`。

关键文件：

- `apps/web/src/lib/agent-runtime/runtime/executor-policy.ts`
- `apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- `apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- `apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- `apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`

处理策略：

- 全部删除 native 分支
- stage 文件收敛成 Mastra-only 实现或改名后的 Mastra 实现

### B. Shadow / Hybrid 轨道

状态：

- 运行时代码已删除
- 文档仍保留为历史档案

现状：

- 允许主结果走 native，同时并行跑 Mastra 做 diff。
- 依赖 `shadowMode`、`onShadowResult`、`shadow-diff` artifact 和 hybrid 文档。

关键文件：

- `apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- `apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- `docs/archive/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md`

处理策略：

- 全部删除
- 不保留“以后也许需要对比”的永久设施

### C. Mastra compiler/runtime 轨道

状态：

- 已成为当前唯一执行轨道

现状：

- 这是未来唯一保留的执行轨道。
- 目前已具备基础 compiler/runtime 骨架，但尚未完成单路径收敛。

关键文件：

- `apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts`
- `apps/web/src/lib/agent-runtime/mastra/compiler/compile-skill.ts`
- `apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts`
- `apps/web/src/lib/agent-runtime/mastra/trace/normalize-mastra-event.ts`

处理策略：

- 保留
- 补齐为唯一运行路径
- 接入 `Mastra Studio`

### D. Legacy provider / naming 残留

状态：

- 运行时代码已大幅收口
- `llm-service.ts` 已删除
- 历史文档仍有少量旧命名残留

现状：

- provider 解析与 SDK 调用已经迁移到 `apps/web/src/lib/llm/*`。
- `script-generator` 命名仍残留在错误来源、文档、计划、测试命令中。

关键文件：

- `apps/web/src/lib/llm/`
- `apps/web/src/lib/llm-runtime.ts`
- `apps/web/src/lib/task-queue/ops/llm-execute.ts`
- `apps/web/src/lib/script-generation-runner.ts`
- `apps/web/src/lib/README.md`
- `docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

处理策略：

- 运行时主调用层并入 Mastra 路径
- 保持 `llm/*` 作为唯一 LLM 基础能力目录
- 统一清理 `script-generator` 误导性命名

## 3. 当前测试残留

需要整改的测试类别：

- `executor-policy` 测试
- `shadow mode` 测试
- `mastra executor path when ...` 这类双轨分支测试
- 任何显式断言 `mastra-disabled` / `native` / `shadow` 的测试

关键文件：

- `apps/web/src/lib/agent-runtime/__tests__/executor-policy.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- `apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

处理策略：

- 删除所有双轨语义测试
- 改成 Mastra-only 行为测试

## 4. 当前文档残留

需要清理或归档的文档：

- `docs/archive/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md`
- `docs/archive/plans/2026-04-01-mastra-hybrid-runtime.md`
- `docs/archive/plans/2026-04-01-mastra-hybrid-runtime-design.md`
- `docs/archive/plans/2026-04-07-llm-workflow-improvement-plan.md`
- 其他仍描述 native / hybrid rollout 的文档

处理策略：

- 当前态文档只允许描述 Mastra-only
- 历史方案文档必须显式标记 archived / historical

## 5. Studio 接入缺口

当前仓库和官方推荐形态之间的差距：

- 缺少 `apps/web/src/mastra/index.ts`
- 缺少 `pnpm run dev:mastra`
- 缺少 Studio 导航入口
- 缺少主 Mastra `server.auth` / `server.rbac` 配置骨架
- 缺少专门的 Studio runbook

当前状态：

- 官方来源已整理到：
  - `docs/technical/MASTRA_STUDIO_RUNBOOK.md`
