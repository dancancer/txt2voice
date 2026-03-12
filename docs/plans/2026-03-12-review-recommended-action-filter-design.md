# Review Recommended Action Filter Design

## 背景

Phase 1 已经把 `SCRIPT_VALIDATION` 的推荐动作接到了卡片和 CSV 导出，但推荐动作仍然只是“看得到”，还不能“拿来筛”。

这会带来一个直接问题：当复核人员想只看“系统建议重生”的脚本失败时，只能靠肉眼扫卡片，不能像按 `scriptSubtype` 那样快速聚合。

## 目标

- 为 review workbench 增加“按推荐动作筛选”能力。
- 保持列表分页、筛选、导出三者语义一致。
- 不修改数据库 schema，不改 resolve API，不新增状态机分支。

## 方案比较

### 方案 A：前端当前页内存筛选

优点：实现快。

缺点：分页总数、导出结果和页面看到的不一致，属于坏味道，不可取。

### 方案 B：服务端派生推荐动作并参与查询

优点：页面、导出、分页同源；不需要改数据库。

缺点：推荐动作本身不是持久化字段，需要把 action -> subtype 的关系显式沉淀成可查询映射。

### 方案 C：把推荐动作持久化到 `issueDetail`

优点：查询最直接。

缺点：要修改写入链路、兼容历史数据、处理回填，超出当前 Phase 1 的最小范围。

## 选择

采用方案 B。

理由：推荐动作本质上是脚本失败展示规则的一部分，当前最好的归宿仍然是共享 helper。只要把 `recommendedAction -> subtype[]` 的逆映射显式做出来，就能在不改 schema 的前提下支撑服务端筛选。

## 设计

### 1. 共享 helper 输出动作选项与逆向映射

在 `apps/web/src/lib/script-validation-detail.ts` 里新增：

- 推荐动作选项常量
- 推荐动作标签 helper
- `recommendedAction -> ScriptValidationSubtype[]` 的逆向映射 helper

这样服务端查询和前端过滤条都从同一份规则表读数据。

### 2. 服务端查询支持 `recommendedAction`

扩展 `manual-review-service.ts`：

- `parseManualReviewQuery()` / `parseManualReviewExportQuery()` 接收 `recommendedAction`
- `buildListWhere()` 在 `issueType === SCRIPT_VALIDATION` 时，把 `recommendedAction` 翻译成 subtype OR 查询
- `formatManualReviewItem()` 透出 `recommendedAction` 与 `recommendedActionLabel`

注意：如果某个推荐动作当前没有对应 subtype（例如现在可能没有稳定的 `approve` / `reject`），筛选结果应安全返回空，不抛异常。

### 3. 前端过滤条增加“推荐动作”筛选

在 review workbench：

- 仅当 `issueType === SCRIPT_VALIDATION` 时显示“推荐动作”下拉
- 切换 `issueType` 时，与 `scriptSubtype` 一样，在非脚本问题下自动重置为 `all`
- `buildReviewParams()` 把 `recommendedAction` 带到列表查询与 CSV 导出

### 4. 测试策略

坚持 TDD：

- 先写 query parse / service filter 失败测试
- 先写 ReviewFilterBar 渲染失败测试
- 再做最小实现，最后跑受影响回归、typecheck、build

## 不做的事

- 不做批量“按推荐动作执行”
- 不改 review item resolve 行为
- 不接 metrics / dashboard 统计
- 不改数据库字段

## 风险

- 当前推荐动作大多映射到 `regenerate`，因此推荐动作筛选在早期可能高度偏斜；这是数据现实，不是实现问题。
- 服务端筛选依赖 `issueDetail.scriptSubtype`，对历史未回填数据的支持与现有 `scriptSubtype` 服务端筛选保持同一水平。

## 验证

- `recommendedAction` query 解析通过
- 服务端推荐动作筛选测试通过
- ReviewFilterBar 推荐动作筛选渲染测试通过
- 既有 scriptSubtype/manual review 回归通过
- `pnpm --filter web typecheck` 通过
- `pnpm --filter web build` 通过
