# Phase 1 Closing Checklist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Phase 1 产出足够的真实样本、收敛性、分段策略和阶段回顾证据，使其具备正式结项条件。

**Architecture:** 先收集阶段收口证据，再决定是否需要补最后一轮实现。closeout 不再新增大功能，而是围绕 roadmap 的 Phase 1 验收标准构建可复核证据链和阶段级 review 文档。

**Tech Stack:** Markdown、pnpm、Next.js test suite、现有回归样本与运行日志

---

### Task 1: 固化真实样本回归清单

**Files:**
- Modify: `docs/plan/phase-1-regression-checklist.md`
- Create: `docs/review/2026-03-12-phase-1-closeout.md`
- Reference: `uploads/sample.txt`
- Reference: `apps/web/src/test-fixtures/regression/short-dialogue.txt`
- Reference: `apps/web/src/test-fixtures/regression/multi-role-scene.txt`
- Reference: `apps/web/src/test-fixtures/regression/long-narrative.txt`

**Step 1: 补真实样本清单与执行记录区块**

在 `docs/plan/phase-1-regression-checklist.md` 增加 closeout 专区，明确：
- 最少 1 本真实样本书 / 1 组真实失败片段
- 固定回归样本
- 每个样本要记录的问题类型、运行次数、结果摘要

**Step 2: 记录当前已知样本来源**

至少登记：
- `uploads/sample.txt`
- `apps/web/src/test-fixtures/regression/short-dialogue.txt`
- `apps/web/src/test-fixtures/regression/multi-role-scene.txt`
- `apps/web/src/test-fixtures/regression/long-narrative.txt`

**Step 3: 在 closeout review 模板中预留样本结论区**

为后续“真实样本是否通过”的书面结论留位置。

**Step 4: Commit**

```bash
git add docs/plan/phase-1-regression-checklist.md docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: scaffold phase 1 closeout evidence"
```

### Task 2: 补多次运行收敛性记录模板

**Files:**
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`
- Create: `docs/plan/2026-03-12-phase-1-convergence-runbook.md`
- Reference: `docs/plan/nightly-regression-runbook.md`

**Step 1: 新建收敛性 runbook**

在 `docs/plan/2026-03-12-phase-1-convergence-runbook.md` 明确：
- 同一文本至少重复运行 3 次
- 记录句子总数、失败段数、manual review 数、主要 subtype 分布
- 如果波动超阈值，需要回到分段策略或 prompt 契约排查

**Step 2: 在 closeout review 中加入收敛性表格**

记录每次运行的：
- run id / date
- input sample
- sentence count
- failed segment count
- pending review count
- verdict

**Step 3: Commit**

```bash
git add docs/plan/2026-03-12-phase-1-convergence-runbook.md docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: add phase 1 convergence runbook"
```

### Task 3: 对照 roadmap 收口分段策略结论

**Files:**
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`
- Reference: `docs/roadmap/2026-03-08-project-realignment-roadmap.md`
- Reference: `apps/web/src/lib/text-processor.ts`
- Reference: `apps/web/src/lib/text-segmentation-profile.ts`

**Step 1: 建一张“roadmap 要求 vs 当前实现”对照表**

必须覆盖：
- 引号密度
- 句子数量
- 对白密度
- 高风险段更小粒度拆分

**Step 2: 标注每项状态**

状态只允许：
- `已完成`
- `部分完成`
- `未完成`

**Step 3: 若存在 `部分完成/未完成`，写明补实现入口**

包括：
- 具体文件
- 影响面
- 是否阻塞 Phase 1 结项

**Step 4: Commit**

```bash
git add docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: map phase 1 segmentation status to roadmap"
```

### Task 4: 形成阶段级正式回顾与结项门槛

**Files:**
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`
- Reference: `docs/handoff/2026-03-08-phase-1-round-1-script-correctness.md`
- Reference: `docs/handoff/2026-03-10-phase-1-round-2-script-failure-routing.md`
- Reference: `docs/handoff/2026-03-10-phase-1-round-3-script-review-subtypes.md`
- Reference: `docs/handoff/2026-03-10-phase-1-round-4-script-review-detail-panel.md`
- Reference: `docs/handoff/2026-03-12-phase-1-round-5-script-review-guidance.md`
- Reference: `docs/handoff/2026-03-12-phase-1-round-6-script-review-action-recommendation.md`
- Reference: `docs/handoff/2026-03-12-phase-1-round-7-review-export-alignment.md`
- Reference: `docs/handoff/2026-03-12-phase-1-round-8-review-recommended-action-filter.md`
- Reference: `docs/handoff/2026-03-12-phase-1-round-9-review-filter-labels.md`

**Step 1: 汇总已完成项**

按以下主题归并：
- prompt / validator
- failure routing
- review workbench
- export / filtering

**Step 2: 回答 roadmap 第 4 节的 4 个阶段回顾问题**

必须逐条写出：
1. 是否直接推动项目目标
2. 哪些是真有效，哪些只是缓解症状
3. 新暴露的问题
4. 下一阶段最该做什么，以及原因

**Step 3: 明确 Phase 1 结项条件**

只允许两种结论：
- `可结项`
- `不可结项`

并给出证据。

**Step 4: Commit**

```bash
git add docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: draft phase 1 closeout review"
```

### Task 5: PR / merge 前检查项

**Files:**
- Modify: `docs/review/2026-03-12-phase-1-closeout.md`

**Step 1: 增加结项前 checklist**

至少包含：
- `pnpm --filter web test:regression`
- Phase 1 相关 targeted tests
- 真实样本回归记录已附上
- convergence 记录已附上
- closeout review 结论已写明

**Step 2: 标记阶段是否 ready for PR**

在 review 末尾增加：
- `PR readiness: yes/no`
- 缺口列表

**Step 3: Commit**

```bash
git add docs/review/2026-03-12-phase-1-closeout.md
git commit -m "docs: add phase 1 pr readiness checklist"
```
