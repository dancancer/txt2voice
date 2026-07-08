# Mastra Studio Runbook

> 更新日期：2026-04-08
>
> 当前目标：为 `txt2voice` 提供单一路径的 Mastra 开发、调试与 Studio 接入说明。

## 1. 官方依据

以下两条是本 runbook 当前采用的官方事实来源：

1. Mastra 官方文档《Getting Started with Mastra and Vite/React》
   链接：[https://mastra.ai/guides/getting-started/vite-react](https://mastra.ai/guides/getting-started/vite-react)
   关键点：
   - 使用 `mastra init` 会创建 `src/mastra` 目录。
   - 本地开发通过 `mastra dev` 启动 Mastra 开发服务。
   - 文档示例默认把 Mastra API 指向 `http://localhost:4111`。

2. Mastra 官方博客《Announcing Studio Auth: Secure, Team-Friendly Access for Deployed Mastra Studios》
   链接：[https://mastra.ai/blog/announcing-studio-auth](https://mastra.ai/blog/announcing-studio-auth)
   关键点：
   - 当主 Mastra 实例配置了 auth provider 后，会同时保护 API 与 Studio。
   - Studio 会自动识别主实例配置的 auth provider，并显示对应登录界面。
   - RBAC 可以挂在主 Mastra 实例的 `server.rbac` 上，Studio 会按角色限制能力。

## 2. 当前采用的结论

基于上述官方来源，`txt2voice` 的 Mastra Studio 接入遵循以下约束：

- 项目正式 Mastra 入口应收敛到 `apps/web/src/mastra/index.ts`。
- 本地开发的 Mastra Server / Studio 默认地址按官方惯例使用 `http://localhost:4111`。
- Studio 不是独立拼装的第二套应用，而是主 Mastra 实例能力的一部分。
- 后续如果要加认证，不单独给 Studio 造一套 auth，而是统一配置在主 Mastra 实例的 `server.auth` / `server.rbac` 上。

## 3. `txt2voice` 目标形态

最终目录与职责预期：

- `apps/web/src/mastra/index.ts`
  项目唯一 Mastra 入口，导出 agents、workflows、tools、server 配置。

- `apps/web/src/lib/agent-runtime/mastra/compiler/*`
  仅保留 definitions -> Mastra 可执行对象的编译职责。

- `apps/web/src/lib/agent-runtime/mastra/runtime/*`
  仅保留 Mastra runtime、Mastra tool 桥接、Mastra trace 正常化等运行职责。

- `apps/web/src/lib/agent-runtime/runtime/*`
  继续保留 workflow 级 orchestration、持久化、manual review、validation 等业务编排，但不得再包含 native executor 或 shadow/hybrid 分支。

## 4. 本地开发命令与已验证状态

根据官方文档，最终本地开发目标命令应是：

```bash
cd /Users/xupeng/mycode/txt2voice/apps/web
pnpm run dev:mastra
```

已于 2026-04-08 在本仓库完成本地验证，命令当前行为为：

- 启动 Mastra 开发服务
- 暴露 Studio
- 默认优先尝试 `http://localhost:4111`
- 如果该端口已被占用，Mastra dev 会自动漂移到下一个空闲端口
- 本次实际验证结果为 `http://localhost:4112`

说明：

- `apps/web/src/mastra/index.ts` 与 `pnpm run dev:mastra` 已经接线完成。
- 如果后续需要同时跑 Next.js UI，应再补一个并行开发说明，但 Mastra Studio 本身的启动入口必须独立清晰。

## 5. Auth 与 RBAC 接入规则

基于官方 Studio Auth 说明，后续接入必须遵守：

- 主实例统一配置：
  - `server.auth`
  - `server.rbac`

- 不允许：
  - 在前端单独为 Studio 造一套鉴权页面
  - 通过 Nginx/basic auth 伪装成 Studio 正式 auth 方案
  - API 和 Studio 使用不同身份真相源

开发阶段最低要求：

- 可以先不启用 auth
- 但 `createMastraRuntime` 或主 Mastra 入口必须预留 `server` 配置结构

生产阶段目标：

- Studio 和 API 共用同一认证源
- 如需要角色控制，优先走官方 RBAC 挂点

## 6. 当前状态

截至 2026-04-08，当前仓库状态为：

- 已建立正式 `apps/web/src/mastra/index.ts`
- 已接入 `dev:mastra` 启动脚本
- 运行链路已收敛为 Mastra-only runtime
- Mastra 入口已保留 `server.auth` / `server.rbac` 结构位，当前开发态使用 `null`
- Studio 启动已通过本地验证

## 7. 后续执行顺序

本 runbook 对应的执行顺序固定如下：

1. 删除 native / shadow / hybrid 轨道
2. 恢复并补齐 Mastra-only runtime
3. 建立正式 `src/mastra/index.ts`
4. 接入 `dev:mastra`
5. 接入 Studio 导航入口
6. 预留 auth / rbac 配置位
