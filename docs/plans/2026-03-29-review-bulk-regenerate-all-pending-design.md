# Review Bulk Regenerate All Pending Design

**目标**

为质检复核工作台增加“重生全部待复核”入口，允许用户不依赖当前页勾选，直接对当前书籍下全部 `pending` 复核项发起批量重生。

**问题背景**

当前工作台只有“批量重生选中项”，其作用范围被限制在当前页勾选结果。对于待复核项跨页、混合脚本与音频复核、或 simply 想“一键清空 backlog”的场景，现有交互需要多页重复操作，效率过低。

**范围**

- 新增全书级“重生全部待复核（N）”入口。
- 作用范围为当前书籍下全部 `status = pending` 的复核项。
- 服务端自动区分：
  - `SCRIPT_VALIDATION` 复核项 -> 汇总 `segmentId`，创建 1 个 `SCRIPT_GENERATION` 任务
  - 其他支持重生的音频复核项 -> 汇总 `sentenceId`，创建 1 个 `AUDIO_GENERATION` 任务
- 若两类项同时存在，本次操作允许一次创建 2 个任务。

**不做的事**

- 不改变现有“批量重生选中项”的交互。
- 不实现“跨页全选当前筛选结果”。
- 不为非 `pending` 项提供全量重生。

**交互设计**

- 入口放在复核筛选条操作区，与“刷新数据 / 导出处置日志”同层。
- 按钮文案：`重生全部待复核（N）`
- 当 `pendingCount = 0` 或存在中的批量动作时按钮禁用。
- 点击后弹出确认框，明确说明：
  - 会处理当前书籍下全部待复核项
  - 可能同时创建脚本重跑任务与音频重生任务
- 成功后 toast 说明：
  - 本次覆盖的复核项数量
  - 触发的任务数量

**后端设计**

- 新增 review service 能力，例如 `regenerateAllPendingReviewItems(bookId)`。
- 服务端自行查询全部 `pending` 项，避免前端传大批 `itemIds`。
- 对查询结果做两类分组：
  - `SCRIPT_VALIDATION`：抽取唯一 `segmentId`
  - 非脚本类：抽取唯一 `sentenceId`
- 若存在缺失 `segmentId` 或 `sentenceId` 的异常复核项，直接失败并返回 itemId 列表，不做静默跳过。
- 成功路径：
  - 创建脚本任务和/或音频任务
  - 把纳入本次任务的复核项统一改为 `reprocessing`
  - `resolutionType` 标记为全量重生来源
  - `resolutionNote` 写入 taskId

**API 设计**

- 新增 route：
  - `POST /api/books/[id]/review/items/regenerate-all-pending`
- 请求体可为空。
- 返回：
  - `processedCount`
  - `reviewItemCount`
  - `scriptTask`
  - `audioTask`

**前端接入**

- hook 增加 `regenerateAllPendingItems()` 动作。
- 页面把 `summary.pendingCount` 传给筛选条。
- 筛选条新增按钮和 loading/disabled 状态。
- 成功后统一刷新：
  - review list
  - SLO
  - recent regenerate tasks

**错误处理**

- 无待复核项：直接报可读错误，不创建任务。
- 当前存在执行中的脚本或音频任务：沿用现有 service 限制。
- 目标字段缺失：报出 itemId，方便回溯脏数据。

**测试策略**

- service：
  - 仅脚本项
  - 仅音频项
  - 脚本 + 音频混合
  - 缺失 target id 失败
  - 没有 pending 项失败
- route：
  - 成功返回双任务/单任务结构
- hook / UI：
  - 按钮显示数量
  - 按钮禁用条件
  - 点击后调用新接口
  - 成功后触发刷新
