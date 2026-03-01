一旦我所属的文件夹有所变化，请更新我
架构: Next.js API 路由段 `/api/books/[id]/script`。
架构: 仅保留子路由，统一台词主接口已收敛到 `/api/books/[id]/scripts`。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- [sentenceId]/audio/route.ts | 地位: API 路由入口 | 功能: 处理单句音频生成请求
- generate/route.ts | 地位: API 路由入口 | 功能: 处理台本生成与状态查询请求
- generate/stream/route.ts | 地位: API 路由入口 | 功能: 处理台本生成流式状态请求
