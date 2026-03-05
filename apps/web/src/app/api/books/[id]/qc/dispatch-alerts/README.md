一旦我所属的文件夹有所变化，请更新我
架构: Next.js API 路由段 `/api/books/[id]/qc/dispatch-alerts`。
架构: 只包含请求处理与响应序列化。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- route.ts | 地位: API 路由入口 | 功能: 处理 `/api/books/[id]/qc/dispatch-alerts` 请求
- scan/route.ts | 地位: 子路由入口 | 功能: 手动触发告警扫描并落库事件
