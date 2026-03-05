一旦我所属的文件夹有所变化，请更新我
架构: Next.js API 路由段 `/api/books/[id]/qc/dispatch-events`。
架构: 提供告警事件查询与生命周期处理入口。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- route.ts | 地位: API 路由入口 | 功能: 查询告警事件列表
- [eventId]/resolve/route.ts | 地位: 子路由入口 | 功能: 执行 ack/resolve 生命周期变更
