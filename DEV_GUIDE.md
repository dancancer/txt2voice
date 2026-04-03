# 本地开发指南

## 推荐方式：本地跑 Web + Docker 跑依赖

```bash
# 1) 安装依赖
pnpm install

# 2) 配置环境变量（仓库根目录）
cp .env.local.example .env.local
# 优先填写 LLM_MODELS_JSON / LLM_DEFAULT_MODEL_ID
# 若本地 Qwen 服务不鉴权，也请给它填一个非空占位 apiKey

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

- 本地开发优先使用多模型注册表配置：`LLM_DEFAULT_MODEL_ID` + `LLM_MODELS_JSON`
- 旧的 `LLM_PROVIDER` 单模型变量仍兼容，适合临时回退
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
