# 本地开发指南

## 推荐方式：本地跑 Web + Docker 跑依赖

```bash
# 1) 安装依赖
pnpm install

# 2) 配置环境变量（仓库根目录）
cp .env.local.example .env.local
# LLM 环境变量现在只作为兜底；主配置入口是页面里的 /settings/llm

# 3) 启动依赖服务（PostgreSQL + Redis）
pnpm docker:services

# 4) 启动 Web
pnpm --filter web dev
```

访问地址：

- Web: [http://localhost:3000](http://localhost:3000)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

队列隔离建议：

- 如果同时运行多个实例（如本地 + Docker），请为每个实例设置不同的 `TASK_QUEUE_NAMESPACE`。
- 推荐值：
  - 本地 Web（3000）：`TASK_QUEUE_NAMESPACE=txt2voice:3000`
  - Docker Web（3001）：`TASK_QUEUE_NAMESPACE=txt2voice:3001`

停止依赖服务：

```bash
pnpm docker:services:down
```

## Docker 一体化开发（可选）

```bash
cp .env.docker .env
pnpm docker:build
pnpm docker:up
```

访问： [http://localhost:3001](http://localhost:3001)

LLM 配置建议：

- 主配置入口是页面 `/settings/llm`，会把模型配置持久化到数据库
- 环境变量里的 `LLM_DEFAULT_MODEL_ID` / `LLM_MODELS_JSON` 只用于数据库为空时的兜底
- 旧的 `LLM_PROVIDER` 单模型变量仍兼容，适合迁移或临时回退
- 当前 `192.168.88.9:8028` 返回的实际模型名是 `Qwen3.5-9B-GGUF-Q4_K_M`
- 如果后续切到 4B，只改配置中的 `model` 字段即可

常用操作：

```bash
pnpm docker:logs
pnpm docker:down
pnpm docker:web:health
pnpm docker:web:restart
```

## 数据库相关

```bash
cd apps/web
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma studio
```

## Mastra Hybrid Runtime 开关

默认情况下，script production 仍然完全走 native runtime。

### 保持默认 native

```bash
unset AGENT_RUNTIME_EXECUTOR
unset AGENT_RUNTIME_MASTRA_STAGES
unset AGENT_RUNTIME_MASTRA_SHADOW_MODE
```

### 只开 shadow mode 做对比验证

```bash
export AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting,segment_repair,quality_judgement
export AGENT_RUNTIME_MASTRA_SHADOW_MODE=true
unset AGENT_RUNTIME_EXECUTOR
```

用途：

- 主结果继续以 native 为准
- 额外写入 `shadow-diff` artifact
- 适合先观察漂移，不适合直接切生产主路径

### 把命中的 stage 切到 Mastra

```bash
export AGENT_RUNTIME_EXECUTOR=mastra
export AGENT_RUNTIME_MASTRA_STAGES=character_discovery,segment_scripting,segment_repair,quality_judgement
export AGENT_RUNTIME_MASTRA_SHADOW_MODE=false
```

用途：

- 命中 allowlist 的 stage 直接走 Mastra
- 其他 stage 仍走 native

### 推荐 rollout 顺序

1. 先跑 `native + shadow mode`
2. 检查 `shadow-diff` artifact 是否稳定
3. 先切 `character_discovery`
4. 再逐步切 `segment_scripting / repair / quality`

### 查看 shadow diff

最直接的方法是从运行时 artifact 查：

```bash
cd apps/web
pnpm prisma studio
```

重点看：

- `RuntimeArtifact.artifactKind = shadow-diff`
- payload 内的 `stageId`
- payload 内的 `differingFields`
- payload 内的 `native` / `shadow`

## 常用命令速查

```bash
# monorepo
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm qc
pnpm qc:quick

# docker
pnpm docker:up
pnpm docker:down
pnpm docker:build
pnpm docker:logs
pnpm docker:services
pnpm docker:services:down
```

## 故障排查

### Web 健康检查失败

```bash
pnpm docker:web:health
pnpm docker:logs:web
```

### 数据库连接失败

```bash
docker ps | grep txt2voice-postgres
```

### Redis 连接失败

```bash
docker ps | grep txt2voice-redis
```

### Prisma 生成异常

```bash
pnpm docker:web:fix:prisma
```

### Mastra / shadow mode 排障

1. 先确认环境变量是否真的生效。
2. 确认 `workflowRun.runtimeConfig.executorPolicy` 已写入数据库。
3. 确认 `RuntimeArtifact` 中是否出现 `shadow-diff`。
4. 如果只有测试环境报错，优先检查工作树是否缺失共享 `node_modules` 软链，而不是先怀疑业务逻辑。

详细排障步骤见：

- [MASTRA_HYBRID_RUNTIME_RUNBOOK.md](/Users/xupeng/mycode/txt2voice/.worktrees/mastra-hybrid-runtime/docs/technical/MASTRA_HYBRID_RUNTIME_RUNBOOK.md)
