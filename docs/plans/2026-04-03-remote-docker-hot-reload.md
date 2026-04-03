# Remote Docker Hot Reload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让远端 `txt2voice-web` 使用开发态 Docker 容器获得代码热加载能力，并且仅在依赖层变化时自动重建镜像。

**Architecture:** `web` 服务改为整仓 bind mount，`next.config.js` 根据 `NODE_ENV` 自动切换开发/生产行为，并运行 `next dev --webpack`。远端部署脚本保留 deploy clone 模型，但会在 `git pull` 后判断是否需要重建镜像，普通代码更新只重启容器。

**Tech Stack:** Docker Compose, Next.js 16, pnpm workspace, Bash, Node.js test runner

---

### Task 1: 收敛开发容器的源码挂载

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docker-compose.yml`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/Dockerfile.dev`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/next.config.js`

**Step 1: 修改 compose 挂载策略**

把 `web` 服务从多个文件级挂载改为整仓挂载 `.:/app`，并保留容器内 `node_modules`、`.next`、`src/generated/prisma` 匿名卷。

**Step 2: 调整启动命令**

开发态直接运行：

```bash
pnpm prisma generate
pnpm next dev --webpack --hostname 0.0.0.0 -p 3001
```

**Step 3: 精简 Dockerfile.dev**

让镜像层只安装依赖和携带开发配置文件，不再把整份源码复制进镜像。

**Step 4: 验证 compose 配置可展开**

Run: `docker compose config`
Expected: `web` 服务显示整仓挂载和新的启动命令，没有 YAML 解析错误。

### Task 2: 让远端部署脚本按需重建

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/scripts/deploy-remote-web.sh`
- Test: `/Users/xupeng/mycode/txt2voice/scripts/__tests__/deploy-remote-web.test.js`

**Step 1: 记录部署前后的 commit**

在远端脚本里记录 `previous_rev` 和 `current_rev`，为差异判断提供输入。

**Step 2: 定义需要重建镜像的文件集合**

只对以下文件变化触发 `docker compose build web`：

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/package.json
apps/web/Dockerfile.dev
```

**Step 3: 调整服务拉起顺序**

先执行：

```bash
docker compose -p txt2voice up -d postgres redis
```

如果命中依赖层变化，再执行：

```bash
docker compose -p txt2voice build web
```

最后再执行：

```bash
docker compose -p txt2voice up -d --no-deps web
```

**Step 4: 更新 dry-run 测试**

断言 dry-run 输出里包含：

- `previous_rev=...`
- `needs_build=0`
- `docker compose -p txt2voice up -d postgres redis`
- `docker compose -p txt2voice build web`

**Step 5: 运行测试**

Run: `node --test scripts/__tests__/deploy-remote-web.test.js`
Expected: PASS

### Task 3: 文档化新的远端热加载约束

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-04-03-remote-docker-hot-reload-design.md`
- Create: `/Users/xupeng/mycode/txt2voice/docs/plans/2026-04-03-remote-docker-hot-reload.md`

**Step 1: 写清目标与边界**

明确这是远端开发态部署，不是正式生产发布路径。

**Step 2: 写清重建规则**

说明普通代码改动无需重建镜像，依赖层变更才需要 build。

**Step 3: 写清验证命令**

Run:

```bash
bash scripts/deploy-remote-web.sh --dry-run
docker compose config
node --test scripts/__tests__/deploy-remote-web.test.js
```

Expected: 三条命令全部成功，dry-run 能展示新的远端热加载路径。
