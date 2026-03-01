# Nightly 回归运行说明

> 版本：v1
> 
> 日期：2026-03-01

## 目标

每天自动执行关键回归链路，提前发现章节切分或任务执行主链路的回退。

## 执行入口

- GitHub Actions: `.github/workflows/nightly-regression.yml`
- 触发方式：
  - 定时：每日 UTC 02:00
  - 手动：`workflow_dispatch`

## 执行命令

1. `pnpm --filter web typecheck`
2. `pnpm --filter web lint`
3. `pnpm --filter web test:regression`（包含样本文本回归 + script/scripts 契约回归）

## 回归样本

- `apps/web/src/test-fixtures/regression/short-dialogue.txt`
- `apps/web/src/test-fixtures/regression/multi-role-scene.txt`
- `apps/web/src/test-fixtures/regression/long-narrative.txt`

## 失败处理

1. 先查看 workflow 的失败步骤和首个失败日志
2. 若失败来自回归样本，优先确认是否为预期行为变更
3. 若为非预期回退，修复后重新触发 `workflow_dispatch` 验证
4. 修复 PR 必须附带失败原因与回归测试结论
