# Task Round 2026-03-12 Phase 1 Closeout

## 基本信息

- 日期：2026-03-12
- 轮次：Phase 1 / Closeout
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-review-guidance
- 负责人：Codex

## 本轮目标

- 把 Phase 1 从“护栏已建立”推进到“具备正式验收与结项证据”。

## 本轮范围

- 固化 Phase 1 closing checklist。
- 补一份阶段级 closeout review 模板，作为正式验收出口。
- 明确真实样本回归、重复运行收敛性、分段策略收口、阶段回顾、PR 结算这 5 个 blocker 的执行顺序。

## 本轮不做的事

- 不切换到 Phase 2。
- 不扩展新的 review workbench 功能。
- 不调整 TTS / QC 的阶段目标。

## 背景与问题分析

- 当前 Phase 1 已经完成 prompt 契约收紧、validator 守门、失败段人工复核链路和 review workbench 强化。
- 但 roadmap 要求的阶段验收证据还不完整，尤其缺少真实样本回归、多次运行收敛性记录和阶段级正式回顾。

## 关键假设

- 现有 `uploads/sample.txt` 和已有回归样本可作为第一批 closeout 夹具。
- 阶段结项需要先补证据，再做 PR/merge 结算，而不是反过来。

## 执行计划

1. 写 Phase 1 closing checklist 计划文档。
2. 写阶段 closeout review 模板。
3. 依据 checklist 顺序开始收真实样本回归和收敛性证据。

## 验收标准

- `docs/plans/2026-03-12-phase-1-closing-checklist.md` 可直接指导后续收尾执行。
- `docs/review/2026-03-12-phase-1-closeout.md` 可直接承载阶段验收结论。
- blocker 顺序、输入物和输出物明确，不再口头漂移。

## 本轮代码质检计划

- 文档轮次，不新增代码质检命令。
- 若后续进入样本回归脚本或工具实现，再单独补测试与验证命令。

## 风险与回滚点

- 若真实样本不足，closeout 证据会偏乐观；需要在 checklist 中显式记录样本缺口。
- 若分段策略实际还未达到 roadmap 要求，可能需要在 closeout 前再补一轮实现，而不是仓促验收。

## 预期产物

- 文档：
  - `docs/plans/2026-03-12-phase-1-closing-checklist.md`
  - `docs/review/2026-03-12-phase-1-closeout.md`
- 数据 / 验收记录：Phase 1 收尾 blocker 列表与执行顺序
