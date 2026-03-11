# Script Validation Review Subtypes Implementation Plan

我正在使用 writing-plans skill 来创建实现计划。

## 任务 1：新增子类型映射纯函数

### Step 1
编写失败测试文件 `apps/web/src/lib/__tests__/script-validation-review.test.ts`，覆盖 `LOW_COVERAGE`、`QUOTED_NARRATION`、`TEXT_SOURCE_MISMATCH`、`DIALOGUE_TOO_LONG`、`LLM_JSON_PARSE_FAILED` 的映射结果。

### Step 2
运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/script-validation-review.test.ts`
预期：FAIL

### Step 3
实现 `apps/web/src/lib/script-validation-review.ts`，提供：
- `SCRIPT_VALIDATION_SUBTYPE_OPTIONS`
- `resolveScriptValidationSubtype`
- `getScriptValidationSubtypeLabel`

### Step 4
再次运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/script-validation-review.test.ts`
预期：PASS

## 任务 2：把子类型接入 manual review 服务

### Step 5
在 `apps/web/src/lib/__tests__/manual-review-service.test.ts` 新增失败测试，验证：
- `parseManualReviewQuery` 解析 `scriptSubtype`
- `listManualReviewItems` 返回 `issueSubtype`
- `manualReviewItem.count/findMany` 的 where 条件包含 `issueDetail.path=["scriptSubtype"]`

### Step 6
运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts`
预期：FAIL

### Step 7
修改 `apps/web/src/lib/manual-review-service.ts`：
- 扩展 query 类型加入 `scriptSubtype`
- `buildListWhere` 在 `issueType=SCRIPT_VALIDATION` 时加入 JSON path 过滤
- `formatManualReviewItem` 透出 `issueSubtype`
- 历史数据缺 `scriptSubtype` 时回退动态推导

### Step 8
修改 `apps/web/src/lib/script-generation-runner.ts`，在创建/更新 `manual_review_items.issueDetail` 时写入 `scriptSubtype`

### Step 9
再次运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/script-validation-review.test.ts`
预期：PASS

## 任务 3：接入 review 工作台 UI

### Step 10
修改 `apps/web/src/app/books/[id]/review/models/types.ts`，为 `ManualReviewItem` 与 `ReviewWorkbenchFilters` 增加 `issueSubtype` / `scriptSubtype` 字段。

### Step 11
修改 `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`：
- 新增 `scriptSubtype` 过滤状态
- 在 `issueType=SCRIPT_VALIDATION` 时带上 `scriptSubtype` 查询参数
- 使用共享子类型选项构造下拉数据

### Step 12
修改 `apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`：
- 在 `issueType=SCRIPT_VALIDATION` 时显示“脚本问题子类型”筛选器
- 使用共享 label 输出中文名称

### Step 13
修改 `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`：
- 为 `SCRIPT_VALIDATION` 项展示子类型 badge
- 在卡片中展示 issueDetail 里的主问题摘要

## 任务 4：回归验证

### Step 14
运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/script-validation-review.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-generation-runner.test.ts`
预期：PASS

### Step 15
运行：
`pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/script-generator.test.ts src/lib/__tests__/script-workflow.test.ts src/lib/__tests__/script-generation-runner.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/script-validation-review.test.ts`
预期：PASS

### Step 16
运行：
`pnpm --filter web typecheck && pnpm --filter web build`
预期：PASS
