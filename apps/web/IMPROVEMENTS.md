# apps/web 改进建议

> 聚焦可维护性、业务闭环与用户体验的主要改进点。每条包含问题、影响与建议。

1) 巨型页面组件超出 400 行限制  
- 位置：`apps/web/src/app/books/[id]/characters/page.tsx`（1445 行）、`.../segments/page.tsx`（786 行）、`.../audio/page.tsx`（671 行）、`.../page.tsx`（427 行）。  
- 影响：难以阅读与测试，状态与副作用耦合在单文件，违背“单文件 ≤ 400 行”的约束。任何改动都可能引发意外回归。  
- 建议：拆分为“容器 + 纯视图”组件：把数据获取/副作用下沉到 `hooks/`（如 `useBookDetail`、`useSegments`、`useCharacterRecognition`、`useAudioGeneration`），UI 拆到 `/components`。进一步分层：列表行、对话框、动作条分别独立文件；共用的分页/空态抽成可复用组件。

2) 域模型类型缺失，状态枚举不一致  
- 位置：`apps/web/src/store/useAppStore.ts:3-24` 的 `Book.status` 仅包含 `uploaded|uploading|processing|processed|script_generated|generating_audio|completed`，但页面使用了 `analyzing|analyzed|generating_script` 等（`.../books/[id]/page.tsx:73-145`、`lib/api.ts`）。大量 `any`（`books/[id]/page.tsx:28`、`segments/page.tsx`、`characters/page.tsx` 等）。  
- 影响：状态展示和按钮逻辑可能失真（例如 “角色分析中” 状态无法正确匹配），静态检查失效，容易引入运行时错误或错判按钮可用性。  
- 建议：在 `types/book.ts` 定义统一的 `Book` 和 `BookStatus` 枚举，并在 `lib/api`、Store、各页面复用；移除 `any` 改为显式接口（段落、角色、音频、任务进度），并让接口层负责数据形状的兜底/转换。

3) 音频生成页面使用假数据与占位逻辑，未接业务闭环  
- 位置：`apps/web/src/app/books/[id]/audio/page.tsx:100-186` 使用硬编码 voice profiles 与 setTimeout 模拟进度；保存语音配置与生成调用均是 TODO/console。  
- 影响：前端界面无法真正触发后端音频生成与语音绑定，用户看到的进度为虚假，无法下载/播放真实产物。  
- 建议：接入真实 API：获取声线列表、保存角色-声线绑定、下发生成任务、轮询任务进度/失败重试、刷新音频列表。将 mock/alert 替换为统一的 toast + 状态轮询；把生成按钮的可用性依赖真实任务状态而非本地假进度。

4) 上传流程的全局状态未正确收敛  
- 位置：`apps/web/src/components/BookUpload.tsx:60-107` 设置 `setUploading(true)` 后在成功路径未恢复为 `false`，也未调用 `addBook` 更新全局列表。  
- 影响：全局“上传中”状态可能一直为 true，其他依赖该标志的组件表现异常；列表需要手动刷新才能看到新书。  
- 建议：在成功/失败 finally 中统一 `setUploading(false)`；成功后调用 `addBook(processResponse.data.book)`（或回调让父级刷新）并清理计时器，避免挂起的 setTimeout 使用过期状态。

5) 状态展示逻辑重复且易漂移  
- 位置：状态-颜色/文案/图标的映射在 `lib/api.ts`、`books/[id]/page.tsx`、`components/BookCard.tsx` 等处各自维护。  
- 影响：新增状态或改名时必须多处同步，极易出现 UI 与实际状态不一致。  
- 建议：提炼 `statusConfig`（颜色/文案/icon）到 `lib/status.ts`，导出 `getStatusMeta(status)` 供所有组件复用，并与后端状态枚举共用类型。

6) 数据获取缺少稳定的数据层与取消/轮询策略  
- 位置：各页面直接在组件内使用 `fetch`/`booksApi.getBook`，缺少 abort/polling，重复请求同一资源（例如段落/角色页面既获取 book 又单独请求列表）。  
- 影响：退场时可能触发 setState on unmounted，长耗时任务（角色识别、脚本/音频生成）没有自动进度刷新，用户需要手动刷新列表。  
- 建议：用数据获取 hook + SWR/React Query：集中管理缓存、错误、轮询与取消；为长任务添加基于状态的轮询与回退（失败提示、重试按钮）。共用书籍基础数据，避免每个子页面重复请求。

7) 交互一致性与错误处理  
- 位置：`BookCard`、音频页等使用 `alert/confirm`，而其他页面用 toast；文件上传用原生 input 动态创建，无法复用、缺少无障碍属性。  
- 影响：体验割裂，错误提示不可统一收敛与埋点，难以自动化测试。  
- 建议：统一到组件化反馈（例如 `sonner`/对话框），封装上传组件（含大小/类型校验、进度、取消），并提供一致的错误恢复路径。

