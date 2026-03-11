# Script Validation Review Subtypes Design

## 背景

当前人工复核工作台只能按顶层 `issueType` 过滤。上一轮已经把台本失败统一沉淀为 `issueType=SCRIPT_VALIDATION`，但真正有用的细粒度问题（覆盖率不足、对白/旁白冲突、边界漂移、缺少 sourceText 等）仍埋在 `issueDetail` 中，导致：

- 复核人员无法快速区分“应该先看哪类问题”。
- 同类问题无法稳定聚合，后续指标统计也缺口明显。
- 若直接把数据库顶层 `issueType` 拆细，会影响现有 summary、筛选、统计与队列逻辑，改动面过大。

## 目标

在不改动数据库顶层 `issueType` 语义的前提下，让 review 工作台支持 `SCRIPT_VALIDATION` 的细粒度展示与筛选。

## 方案

### 1. 保留顶层 issueType

继续使用 `issueType=SCRIPT_VALIDATION` 作为数据库和队列层主分类，保持现有人工复核、统计和状态机语义稳定。

### 2. 引入脚本问题子类型

新增一套纯函数映射规则，从 `issueDetail.errorCode` 与 `issueDetail.issueCodes` 推导出单一主子类型 `scriptSubtype`。主子类型用于：

- 服务端返回结构化字段给前端。
- review 工作台额外展示一个脚本问题子类型 badge。
- `review/items` API 在 `issueType=SCRIPT_VALIDATION` 时支持按 `scriptSubtype` 过滤。
- 后续 SLO / metrics 可直接复用该字段，无需再次解析散乱 issue codes。

### 3. 子类型只做“主因归类”

同一条失败可能包含多个 issue code，但 workbench 先只展示一个主子类型，避免 UI 上出现一长串标签。其余 issue codes 仍保存在 `issueDetail.issueCodes` 中，供详情展示或后续扩展使用。

## 子类型映射

- `LOW_COVERAGE` / `NON_WHITESPACE_GAP` -> `COVERAGE`
- `QUOTED_NARRATION` -> `DIALOGUE_NARRATION_CONFLICT`
- `TEXT_SOURCE_MISMATCH` -> `BOUNDARY_DRIFT`
- `SOURCE_NOT_FOUND` -> `ORDER_OR_DUPLICATION`
- `MISSING_SOURCE_TEXT` -> `SOURCE_TRACE_MISSING`
- `EMPTY_DIALOGUES` / `EMPTY_TEXT` -> `EMPTY_EXTRACTION`
- `errorCode=DIALOGUE_TOO_LONG` -> `DIALOGUE_TOO_LONG`
- `errorCode=LLM_JSON_PARSE_FAILED` -> `LLM_PARSE_FAILURE`
- 无法识别 -> `OTHER`

## 数据流

1. `script-generation-runner` 创建/更新 `manual_review_items` 时，在 `issueDetail` 中写入 `scriptSubtype`。
2. `manual-review-service` 读取复核项时把 `scriptSubtype` 透出到响应体。
3. `review/items` 路由接受 `scriptSubtype` 查询参数。
4. review hook 构造查询参数，并在 `issueType=SCRIPT_VALIDATION` 时显示子类型筛选器。
5. queue list / filter bar 显示中文子类型标签。

## 错误处理

- 对非 `SCRIPT_VALIDATION` 项目，`scriptSubtype` 恒为 `null`。
- 如果历史数据没有 `scriptSubtype`，服务端在响应时回退到从 `issueDetail` 动态推导，保证老数据可用。
- 过滤时仅在 `issueType=SCRIPT_VALIDATION` 且显式传入 `scriptSubtype` 时启用 JSON path 过滤。

## 测试策略

- 先为纯映射函数写单测，覆盖主要 code -> subtype 映射。
- 再为 `manual-review-service` 写单测，验证：
  - query 能解析 `scriptSubtype`
  - `listManualReviewItems` 能返回 `issueSubtype`
  - 过滤条件会落到 `issueDetail.path=["scriptSubtype"]`
- 最后做受影响链路的现有测试回归。
