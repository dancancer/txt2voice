# `/api/books/[id]/qc/dispatch-policy/rollback`

## POST

将指定 scope 的策略回滚到历史版本。

### Body

```json
{
  "scopeType": "book",
  "scopeId": "optional-for-tenant-or-project",
  "targetVersion": 2,
  "updatedBy": "ops",
  "changeNote": "回滚到稳定版本",
  "expectedVersion": 5
}
```
