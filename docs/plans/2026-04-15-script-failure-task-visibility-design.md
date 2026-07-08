# Script Failure Task Visibility Design

**目标**

把段落级台本重生失败直接暴露到质检模块，让用户无需猜测失败发生在哪里、也无需再跳去任务中心翻找。用户应当能够：

1. 在质检模块看到当前书籍最近的台本失败/重生任务，按更新时间倒序排列。
2. 从任务卡片里直接识别失败摘要与最近失败段落。
3. 在高级台本功能的段落 UI 中，直接跳到该段落对应的最近失败任务记录。

**背景**

当前系统已经具备两部分基础能力：

1. `SCRIPT_GENERATION` 失败会把摘要写入 `processing_tasks.errorMessage`，并把段落级失败细节写入 `taskData.metadata.failedSegmentDetails`。
2. 质检模块已经有“最近重生任务”卡片，并复用 `/api/tasks?bookId=...` 加载当前书籍的任务。

但用户体验仍有两个断点：

1. 质检模块目前只展示人工复核触发的重生任务，不展示普通段落重生失败任务。
2. Studio 段落 UI 无法把用户直接带到质检模块中的对应失败记录。

结果就是：失败信息虽然落库了，但用户看不到，也找不到。

## 设计原则

1. 保持模型分层
   - `ProcessingTask` 继续作为任务视图来源。
   - `ManualReviewItem` 继续作为人工复核来源。
   - 不把两类对象混成一张列表。

2. 复用已有接口
   - 不新增任务查询 API。
   - 继续复用 `/api/tasks`，只扩展前端转换与展示语义。

3. 直接跳到记录，不做模糊筛选
   - 用户要找的是“最近一次相关失败任务”，不是一组条件筛选结果。
   - 用锚点比新造筛选参数更直接。

4. 消除脏数据影响
   - 单段重生任务优先信任 `segmentIds`。
   - 只有在 `segmentIds` 缺失时，才退回 `failedSegmentDetails[].segmentId`。
   - 最后才使用 `failedSegmentIds`。

## 范围

### 本次要做

1. 扩展质检模块任务卡片，使其展示最近台本失败与重生任务。
2. 失败任务按 `updatedAt` 倒序排列。
3. 失败任务卡片展示失败摘要与最近失败段落信息。
4. 为每条任务卡片增加稳定锚点。
5. 在 Studio 段落 UI 中增加跳转到最近失败任务记录的入口。

### 本次不做

1. 不把失败任务混入人工复核队列。
2. 不新增数据库表或 Prisma 模型。
3. 不改任务落库格式。
4. 不做 review 页复杂筛选器扩展。

## 总体方案

整体拆成两条链路：

1. **质检模块任务视图扩展**
   - 放宽现有 `ReviewRegenerateTask` 转换逻辑。
   - 纳入“人工复核重生任务”与“台本失败任务”两类来源。
   - 统一在同一张卡片列表中展示。

2. **Studio 段落到失败任务的跳转链路**
   - 为当前书籍建立“段落 -> 最近失败任务”映射。
   - 章节段落表与当前段落详情头部都显示跳转入口。
   - 跳转目标为 `/books/<bookId>/review#task-<taskId>`。

---

## 一、质检模块中的失败/重生任务视图

### 现状

`ReviewRegenerateTaskList` 当前只渲染：

1. `metadata.source = manual_review`
2. `metadata.source = manual_review_batch`
3. `metadata.source = manual_review_bulk_pending`

因此普通 Studio 段落重生失败任务被过滤掉了，即便这些任务已经写入：

- `errorMessage`
- `taskData.metadata.failedSegmentDetails`

### 设计决策

把当前卡片语义从“人工复核重生任务”扩展为“最近台本失败与重生任务”。

### 纳入规则

保留原有三类人工复核来源，同时新增一类：

1. `taskType === SCRIPT_GENERATION`
2. `status === failed`
3. 且满足以下其一：
   - `metadata.failedSegmentDetails` 非空
   - `metadata.failedSegmentIds` 非空

### 展示排序

任务列表统一按 `updatedAt` 倒序排序。

原因：

1. 失败任务往往需要看最近状态，而不是最初创建顺序。
2. 任务重试或失败收口发生在 `updatedAt`，比 `createdAt` 更贴近用户心智。

### 卡片展示字段

现有卡片保留：

1. 任务类型
2. 状态
3. 来源标签
4. 目标数量
5. 进度
6. 顶层消息
7. `errorMessage`

新增失败摘要区：

1. 最近失败段落号：`orderIndex + 1`
2. 失败阶段：`stage`
3. 错误码：`errorCode`
4. 失败说明：`message`

这部分优先取 `failedSegmentDetails[0]`。

### 卡片来源标签

来源标签调整为更宽语义：

1. `manual_review` -> `单条重生`
2. `manual_review_batch` -> `批量重生`
3. `manual_review_bulk_pending` -> `全量待复核重生`
4. 新增 script failure 类别 -> `失败任务`

### 稳定锚点

每张任务卡片增加：

```html
id="task-<taskId>"
```

这样可以支持 Studio 直接跳转并定位。

---

## 二、Studio 段落到失败任务的跳转链路

### 现状

Studio 页面能重生当前段落，但失败后用户需要自己切到质检页，再人工定位对应任务。

这是一个明显的上下文断裂。

### 设计决策

为当前书籍构建“段落 -> 最近失败任务”映射，并在段落 UI 上直接暴露跳转入口。

### 映射规则

每个段落只保留最近一条失败任务，选择优先级如下：

1. `task.segmentIds`
   - 最可信，尤其适合单段重生。
2. `failedSegmentDetails[].segmentId`
   - 有细节时可信度次高。
3. `failedSegmentIds`
   - 仅作兜底。

这样可以避开某些历史任务中“单段重生但 failedSegmentIds 混入多段”的脏数据。

### 入口位置

新增两个入口：

1. **章节段落表**
   - 每行段落操作区显示“查看质检失败”链接。
2. **当前段落详情头部**
   - 如果当前选中段落存在失败任务，显示同样入口。

### 跳转行为

跳转目标：

```text
/books/<bookId>/review#task-<taskId>
```

质检页加载完成后，浏览器自动滚动到该任务卡片。

### 无失败记录时的行为

若当前段落不存在最近失败任务：

1. 不显示入口。
2. 不显示禁用按钮。

原因是禁用按钮会制造无意义噪音。

---

## 三、数据流变化

### 质检页

现有：

`/api/tasks -> useReviewWorkbenchData -> toRegenerateTask -> ReviewRegenerateTaskList`

变更后：

`/api/tasks -> useReviewWorkbenchData -> toReviewScriptTask -> updatedAt desc -> ReviewRegenerateTaskList`

其中任务模型扩展为：

1. 仍保留原字段
2. 新增段落映射信息
3. 新增失败摘要字段

### Studio 页

新增一条只读任务链路：

`/api/tasks?bookId=... -> load latest failed script tasks -> build segment->task map -> render jump link`

这条链路只读，不参与台本生成状态机。

---

## 四、测试策略

### 单元/转换测试

覆盖：

1. 普通人工复核重生任务仍然可见。
2. 带 `failedSegmentDetails` 的失败脚本任务可见。
3. 失败脚本任务按 `updatedAt` 倒序。
4. 段落映射优先信任 `segmentIds`。

### 组件测试

覆盖：

1. 任务卡片渲染失败摘要。
2. 任务卡片带 `id="task-<taskId>"`。
3. 段落表出现“查看质检失败”入口。
4. 当前段落详情头部出现同入口。

### 回归验证

覆盖：

1. 原有人工复核重生任务仍能正常显示。
2. Studio 原有“重生当前段落”不受影响。
3. 没有失败记录的段落不出现额外噪音按钮。

---

## 五、为什么不选别的方案

### 不把失败任务混进人工复核队列

原因：

1. `ProcessingTask` 与 `ManualReviewItem` 生命周期不同。
2. 一个是任务记录，一个是待人工处置对象。
3. 混排会迅速制造字段泥团与分支判断。

### 不新增“失败任务查询 API”

原因：

1. 现有 `/api/tasks` 足够。
2. 任务筛选逻辑本来就在前端转换层。
3. 新接口只会增加重复语义。

### 不做按 `segmentId` 的 review 筛选参数

原因：

1. 用户的目标是“跳到最近失败任务记录”。
2. 不是“打开一个新的筛选视图再手动找”。
3. 锚点是更短链路。

---

## 结论

本次设计的核心是把“失败已落库但不可见”的问题，收敛成一个清晰的任务可见性方案：

1. 质检模块展示最近失败/重生任务。
2. Studio 段落直接跳转到对应失败记录。
3. 继续保持任务模型与人工复核模型分层。

这样用户的路径会从：

`段落重生失败 -> 自己猜 -> 切任务中心 -> 继续猜`

变成：

`段落重生失败 -> 质检模块可见 -> 一键跳到对应任务 -> 人工修订`
