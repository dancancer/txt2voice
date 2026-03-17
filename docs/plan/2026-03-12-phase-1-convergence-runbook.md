# Phase 1 收敛性运行说明

> 版本：v1
>
> 日期：2026-03-12

## 目标

证明同一文本在多次运行下，Phase 1 的台本生成结果已经显著收敛，而不是依赖单次好运气。

## 输入样本

优先顺序：

1. `uploads/sample.txt`
2. `apps/web/src/test-fixtures/regression/short-dialogue.txt`
3. `apps/web/src/test-fixtures/regression/multi-role-scene.txt`
4. `apps/web/src/test-fixtures/regression/long-narrative.txt`
5. 最近一轮真实 `SCRIPT_VALIDATION` 失败片段（至少 1 组）

## 运行要求

- 同一文本至少重复运行 3 次。
- 每次运行都必须记录：
  - run id / 日期
  - 输入样本
  - 句子总数
  - failed segment 数
  - pending manual review 数
  - 主要 `scriptSubtype` 分布
  - 是否出现漏段 / 重复对白 / 对白旁白混抽
- 运行环境、模型配置、代码 commit 必须保持一致；否则该组记录无效。

## 推荐执行顺序

1. 先执行 `pnpm --filter web test:regression`
2. 选定一个样本做 3 次重复运行
3. 再换下一个样本重复
4. 每轮结果都写回 `docs/review/2026-03-12-phase-1-closeout.md`

## 记录模板

| Run ID | 日期 | 样本 | 句子数 | failed segments | pending review | 主要 subtype | Verdict | 备注 |
|---|---|---|---:|---:|---:|---|---|---|
| `待填写` | `待填写` | `待填写` | 0 | 0 | 0 | `待填写` | `待填写` | `待填写` |

## 波动判定

以下任一情况出现，都视为“未收敛”，需要先回到 Phase 1 修复：

- 同一样本 3 次运行的句子数差异明显且无法解释。
- `failedSegmentDetails` 数量在重复运行中大幅波动。
- 漏段 / 重复对白 / 边界漂移在重复运行中时有时无。
- `scriptSubtype` 主因分布完全不稳定。

## 输出物

- `docs/review/2026-03-12-phase-1-closeout.md` 中的收敛性记录表
- 如有必要，补充原始运行日志路径或任务 ID
