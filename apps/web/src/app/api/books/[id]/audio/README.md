一旦我所属的文件夹有所变化，请更新我
架构: Next.js API 路由段 `/api/books/[id]/audio`。
架构: 只包含请求处理与响应序列化。

文件清单:
- README.md | 地位: 目录说明 | 功能: 记录目录职责与文件清单
- generate/route.ts | 地位: 音频生成入口 | 功能: 处理整书/章节/批量音频生成任务
- merge/route.ts | 地位: 音频合并入口 | 功能: 触发章节或整书合并导出
- router/metrics/route.ts | 地位: 路由观测接口 | 功能: 返回引擎路由命中、降级与失败指标
