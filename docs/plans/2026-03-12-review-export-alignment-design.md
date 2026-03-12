# Review Export Alignment Design

## 背景

Phase 1 的 review workbench 已经能在 `SCRIPT_VALIDATION` 卡片里展示：

- 子类型
- 完整问题列表
- 建议动作
- 推荐处置动作

但导出的 CSV 仍然只有 `issueSubtype` 原始值、句子文本和处置结果，导致人工复核在页面上看到的信息，导出后并不能完整带走。与此同时，卡片详情里还残留 `issue codes / issue previews / segment preview` 这类英文标题，workbench 的语义层还不够统一。

## 目标

把 review workbench 与 CSV 导出对齐成同一套脚本失败展示语义：

1. 页面上看到的脚本失败摘要、推荐动作、问题列表，导出后也能保留。
2. 页面内部剩余英文标题统一中文化，降低人工复核的认知切换成本。
3. 不修改 resolve API，不增加新状态，不把 Phase 1 的 focus 从“人工复核高效”带偏到统计系统。

## 方案比较

### 方案 A：在 `manual-review-service.ts` 里直接重复拼装导出字段

优点：改动少，能很快把 CSV 补齐。

缺点：UI 一套规则、导出另一套规则；后面一旦脚本子类型、推荐动作或摘要逻辑调整，极易出现漂移。

### 方案 B：把脚本失败展示逻辑抽成共享 helper，由 UI 和导出共同复用

优点：单一事实源，UI/导出天然一致；后续如果要接 metrics，也能复用同一层。

缺点：需要把现有 app 内的 helper 往共享层搬一次。

### 方案 C：直接在 API route 里拼 CSV 展示字段

优点：service 文件表面上更干净。

缺点：把领域逻辑塞进 route，最坏品味；测试也会变脆。

## 选择

采用方案 B。

理由很直接：现在“脚本失败怎么展示”已经不只是页面问题，而是 review 领域规则。既然 UI 和导出都要消费它，就应该下沉到 `lib` 共享层，而不是继续把规则绑死在 app 目录或 route 层。

## 设计

### 1. 共享脚本失败详情 helper

新增一个共享 helper，把现有 `buildScriptValidationDetailView()` 从 app 侧挪到 `apps/web/src/lib/` 下。

输出继续保留：

- `subtypeLabel`
- `summary`
- `issueMessages`
- `issuePreviews`
- `segmentPreview`
- `actionHints`
- `recommendedAction`
- `recommendedActionLabel`

这样 review 卡片和 CSV 导出都会基于同一份归一化结果。

### 2. Review 页中文化收口

将卡片详情区中剩余英文标题统一成中文：

- `issue codes` -> `问题代码`
- `issue previews` -> `问题原文预览`
- `segment preview` -> `段落原文预览`

本轮只做文案统一，不调整布局结构。

### 3. CSV 导出补齐脚本失败字段

在 `toManualReviewCsv()` 中追加以下列：

- `issueSubtypeLabel`
- `recommendedAction`
- `scriptSummary`
- `scriptIssueMessages`

规则：

- 仅 `SCRIPT_VALIDATION` 项填写这些字段。
- `scriptIssueMessages` 用 ` | ` 连接，避免把 CSV 搞成多行单元格地狱。
- 其他 issueType 统一留空，避免给非脚本问题强造字段含义。

### 4. 测试策略

坚持 TDD：

- 先让 CSV 测试断言新增列与值失败。
- 先让 ReviewQueueList 测试断言中文标题失败。
- 再做最小实现，跑受影响回归、typecheck、build。

## 不做的事

- 不改 review API response 结构。
- 不把 `recommendedAction` 接入 metrics。
- 不做批量推荐动作联动。
- 不改变现有按钮行为。

## 风险

- 如果共享 helper 仍然依赖 app 侧类型，会形成反向依赖；因此必须让共享层只依赖 `lib` 或纯类型。
- CSV 字段一旦增加，现有外部脚本若按固定列顺序解析，可能需要跟着更新；但这是合理的显式变化。

## 验证

- helper 测试通过
- ReviewQueueList 渲染测试通过
- manual-review-service CSV 测试通过
- manual review / script subtype 相关回归通过
- `pnpm --filter web typecheck` 通过
- `pnpm --filter web build` 通过
