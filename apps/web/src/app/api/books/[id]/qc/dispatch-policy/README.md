# `/api/books/[id]/qc/dispatch-policy`

## GET

查询当前书籍在 `tenant -> project -> book` 三层 scope 下的策略配置、审计快照和最终合并结果。

### Query

- `historyLimit`：每个 scope 返回的历史版本条数，默认 `10`，范围 `1-50`。

## PUT

更新策略配置（支持 tenant/project/book 三层 scope）。

### Body

```json
{
  "scopeType": "book",
  "scopeId": "optional-for-tenant-or-project",
  "policy": {
    "autoCreatePendingOnReject": true,
    "maxAutoRejectedCount": 2,
    "issueTypePolicies": {
      "FAST_GATE": {
        "maxAutoRejectedCount": 1
      }
    }
  },
  "isActive": true,
  "rolloutPercentage": 100,
  "updatedBy": "ops",
  "changeNote": "启用章节批量返工策略",
  "expectedVersion": 3
}
```
