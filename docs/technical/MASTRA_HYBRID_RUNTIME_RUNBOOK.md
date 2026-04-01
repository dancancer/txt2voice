# Mastra Hybrid Runtime Runbook

> 更新日期：2026-04-01

## 1. 目标

这份 runbook 只回答一件事：

- 如何在不破坏现有生产 runtime 的前提下，开启、验证、回滚 Mastra hybrid runtime

当前原则：

- `agent-runtime` 仍然是生产 orchestration 和持久化真相源
- `Mastra` 只接 LLM-heavy stage
- `shadow mode` 只做验证，不改主结果

## 2. 当前覆盖范围

已接入 executor policy 的 stage：

- `character_discovery`
- `segment_scripting`
- `segment_repair`
- `quality_judgement`

仍保持 deterministic service 的部分：

- 文本处理
- 音频路由与合成
- Prisma 持久化
- validation / coverage / split 等确定性逻辑

## 3. 环境变量

### 3.1 默认 native

```bash
unset AGENT_RUNTIME_EXECUTOR
unset AGENT_RUNTIME_MASTRA_STAGES
unset AGENT_RUNTIME_MASTRA_SHADOW_MODE
```

效果：

- 所有 stage 走 native
- 不写 `shadow-diff`

### 3.2 shadow mode

```bash
export AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting,segment_repair,quality_judgement
export AGENT_RUNTIME_MASTRA_SHADOW_MODE=true
unset AGENT_RUNTIME_EXECUTOR
```

效果：

- 主结果继续走 native
- 并行运行 Mastra
- 额外写 `RuntimeArtifact.artifactKind = shadow-diff`

### 3.3 切主执行器

```bash
export AGENT_RUNTIME_EXECUTOR=mastra
export AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting
export AGENT_RUNTIME_MASTRA_SHADOW_MODE=false
```

效果：

- 命中 allowlist 的 stage 走 Mastra
- 未命中的 stage 继续走 native

## 4. 推荐 rollout

1. 先用 `shadow mode` 验证一段时间。
2. 先只观察 `character_discovery` 的 diff。
3. 再扩大到 `segment_scripting`。
4. 最后再考虑 `segment_repair` 和 `quality_judgement`。
5. 任一阶段出现明显漂移，立刻回退到 `native`。

## 5. 验证清单

### 5.1 配置是否生效

检查 `workflowRun.runtimeConfig`：

- 是否包含 `executorPolicy`
- `stageExecutors` 是否符合当前环境变量
- `shadowModeEnabled` 是否符合预期

### 5.2 shadow diff 是否落库

检查 `RuntimeArtifact`：

- `artifactKind = shadow-diff`
- `artifactVersion = v1`
- `payload.stageId` 正确
- `payload.matched` 与 `payload.differingFields` 合理

### 5.3 主结果是否保持稳定

检查：

- `ProcessingTask.status`
- `WorkflowRun.status`
- `StageRun.status`
- `ManualReviewItem` 是否异常增加
- `Audio / Script` 主结果是否仍由 native 产出

## 6. 常用排障命令

### 6.1 文档开关是否写全

```bash
cd /Users/xupeng/mycode/txt2voice
rg -n "AGENT_RUNTIME_EXECUTOR|AGENT_RUNTIME_MASTRA_SHADOW_MODE|shadow mode|Mastra" ARCHITECTURE.md DEV_GUIDE.md docs/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md
```

### 6.2 核对 runtime 关键测试

```bash
cd /Users/xupeng/mycode/txt2voice/apps/web
npm test -- --runInBand \
  src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts \
  src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts \
  src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts \
  src/lib/agent-runtime/__tests__/repair-stage.test.ts \
  src/lib/agent-runtime/__tests__/quality-stage.test.ts \
  src/lib/agent-runtime/__tests__/mastra-trace-adapter.test.ts
```

### 6.3 类型检查

```bash
cd /Users/xupeng/mycode/txt2voice/apps/web
npm run typecheck
```

## 7. 常见故障

### 7.1 `next/jest` 找不到

现象：

- 工作树里跑 Jest 直接报 `Cannot find module 'next/jest'`

根因：

- 工作树缺少指向仓库根 `node_modules` 的共享软链

处理：

```bash
ln -s /Users/xupeng/mycode/txt2voice/node_modules /Users/xupeng/mycode/txt2voice/.worktrees/mastra-hybrid-runtime/node_modules
```

仅用于当前工作树调试；不要把这个软链提交进 git。

### 7.2 看到 `shadow-diff` 但主结果没变

这是正常现象。

- `shadow mode` 的目标就是“记录差异，不改主结果”

### 7.3 `shadow-diff` 一直不出现

优先检查：

1. `AGENT_RUNTIME_MASTRA_SHADOW_MODE` 是否为 `true`
2. stage 是否在 `AGENT_RUNTIME_MASTRA_STAGES` allowlist 中
3. 该执行链路是否真的走到了对应 stage

### 7.4 结果漂移明显

回滚方式：

```bash
unset AGENT_RUNTIME_EXECUTOR
unset AGENT_RUNTIME_MASTRA_SHADOW_MODE
```

然后重新运行同一批 workflow，对比新的 runtime artifact。

## 8. 相关文件

- `apps/web/src/lib/agent-runtime/runtime/executor-policy.ts`
- `apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-runtime.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/create-mastra-tools.ts`
- `apps/web/src/lib/agent-runtime/mastra/runtime/shadow-diff.ts`
- `apps/web/src/lib/agent-runtime/mastra/trace/normalize-mastra-event.ts`
