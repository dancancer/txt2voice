# 远端 Docker 热加载部署设计

## 目标

把远端 `txt2voice-web` 从“代码打进镜像、每次改代码都要重建”的发布形态，改成“开发态容器 + 热加载”的调试形态。

## 现状问题

当前远端发布脚本 [`scripts/deploy-remote-web.sh`](/Users/xupeng/mycode/txt2voice/scripts/deploy-remote-web.sh) 使用 deploy clone 配合默认 `docker compose up -d --no-deps web`。

问题不在脚本本身，而在运行模型：

- 远端此前沿用生产式镜像思路，代码主要通过镜像层进入容器。
- 一旦代码变更，容器内运行时看不到最新源码，自然只能重建镜像。
- [`docker-compose.yml`](/Users/xupeng/mycode/txt2voice/docker-compose.yml) 虽然已经偏向开发模式，但 `web` 仍依赖一串零散 bind mount，配置维护成本高，而且新文件/新配置容易漏挂。

## 已确认方案

用户确认采用“远端改成开发态容器”：

1. `web` 服务继续使用 [`apps/web/Dockerfile.dev`](/Users/xupeng/mycode/txt2voice/apps/web/Dockerfile.dev)。
2. `docker-compose.yml` 改为整仓挂载 `.:/app`，而不是手工维护多个文件级挂载。
3. 保留容器内的 `node_modules`、`.next`、`src/generated/prisma` 匿名卷，避免宿主目录覆盖依赖和构建产物。
4. [`apps/web/next.config.js`](/Users/xupeng/mycode/txt2voice/apps/web/next.config.js) 按 `NODE_ENV` 自动切换开发/生产配置，开发态显式使用 `next dev --webpack`。
5. 远端部署脚本默认只刷新代码并重启 `web`，仅在依赖层文件变更时触发 `docker compose build web`。

## 设计取舍

### 选择整仓挂载

优点：

- 新增源码、配置、脚本文件时不需要追加 volume 规则。
- 远端 `git pull` 后，容器直接看到新代码，热加载路径更直。
- 消除了“这个文件改了为什么容器里没变”的特殊情况。

代价：

- 开发容器会看到整个仓库，而不是最小挂载集合。
- 远端运行的是 `development` 模式，不适合作为正式生产部署形态。

### 选择按需重建而不是永不重建

“改代码不重建”和“永远不重建”不是一回事。

当以下文件变化时，镜像层确实需要刷新：

- 根目录 `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `apps/web/package.json`
- `apps/web/Dockerfile.dev`

因此部署脚本会把这类变化识别为“依赖层变化”，自动执行一次 `docker compose build web`；普通业务代码变化则只重启容器。

## 影响文件

- Modify: [`docker-compose.yml`](/Users/xupeng/mycode/txt2voice/docker-compose.yml)
- Modify: [`apps/web/Dockerfile.dev`](/Users/xupeng/mycode/txt2voice/apps/web/Dockerfile.dev)
- Modify: [`scripts/deploy-remote-web.sh`](/Users/xupeng/mycode/txt2voice/scripts/deploy-remote-web.sh)
- Modify: [`scripts/__tests__/deploy-remote-web.test.js`](/Users/xupeng/mycode/txt2voice/scripts/__tests__/deploy-remote-web.test.js)

## 验证标准

1. `bash scripts/deploy-remote-web.sh --dry-run` 能展示新的远端执行路径。
2. `node --test scripts/__tests__/deploy-remote-web.test.js` 通过。
3. `docker compose config` 能正确展开 `web` 服务配置。
4. 普通代码变更不要求 `docker compose build web`。
5. 依赖层文件变更时，脚本具备自动重建 `web` 镜像的路径。
