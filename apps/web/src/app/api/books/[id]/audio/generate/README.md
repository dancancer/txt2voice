一旦我所属的文件夹有所变化，请更新我
架构: Next.js API 路由段 `/api/books/[id]/audio/generate`。
架构: 只包含请求处理与响应序列化。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- route.ts | 地位: API 路由入口 | 功能: 处理 `/api/books/[id]/audio/generate` 请求

请求补充:
- `routerPolicyVersion` | 作用: 指定本次音频生成使用的路由策略版本
- `routerDebug` / `enableRouterDebug` | 作用: 控制是否回传详细路由调试信息
