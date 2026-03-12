# Phase 1 Closeout Review

## 基本信息

- 阶段：阶段 1：原文 -> 台本 正确性重建
- roadmap：`docs/roadmap/2026-03-08-project-realignment-roadmap.md`
- 分支：`codex/phase-1-review-guidance`
- 状态：`draft`

## 1. 阶段目标回顾

- 原始目标：把“原文保真”重新变成第一性原则，解决漏内容、重复抽取、对白/旁白边界错误。
- 当前结论：`Phase 1 护栏已建立，但真实样本与收敛性证据仍在补齐中。`

## 2. 已完成项汇总

### 2.1 Prompt / Validator

- 已收紧段落级 prompt 契约：完整覆盖、禁止改写、禁止重复抽取、强制返回 `sourceText`。
- 已引入段落级 Script Validator：覆盖率、重复抽取、对白/旁白冲突、边界漂移、超长句、LLM 解析失败都会在落库前被拦截。
- 已将落库文本优先回退到 `sourceText`，避免 LLM 改写文本直接污染 `script_sentences`。

### 2.2 Failure Routing / Manual Review

- 已将失败段结构化沉淀为 `failedSegmentDetails`，并同步进入 `manual_review_items(issueType=SCRIPT_VALIDATION)`。
- 已支持 `manual_review_pending` 状态下的台本重跑与失败去重入队，避免重复 pending 项失控堆积。
- 已形成 `scriptSubtype -> issueDetail -> recommendedAction` 的人工复核主链路，失败段不再是黑盒。

### 2.3 Review Workbench / Export / Filtering

- review workbench 已支持 `SCRIPT_VALIDATION` 子类型筛选、详情展开、完整问题列表、建议动作、推荐动作。
- CSV 导出已与 review 卡片对齐，能导出 `issueSubtypeLabel`、`recommendedAction`、`scriptSummary`、`scriptIssueMessages`。
- 过滤条已支持按 `recommendedAction` 筛选，且当前值显示已中文化，减少内部枚举值直接暴露。

## 3. 真实样本回归

| 样本 | 来源 | 问题类型 | 运行次数 | 结果 | 备注 |
|---|---|---|---:|---|---|
| `uploads/sample.txt` | 本地统一测试书 | `真实样本回归（limitToSegments=10）` | 3 | `已执行` | `3 次运行均收敛到 24 lines / 7 failed segments / 7 pending SCRIPT_VALIDATION；说明当前失败模式稳定但尚未收口` |

## 4. 多次运行收敛性记录

| Run ID | 样本 | 句子数 | 失败段数 | 待复核数 | Verdict | 备注 |
|---|---|---:|---:|---:|---|---|
| `run-1` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=28d07d9d-38a4-465c-82e6-063d42430152，book.status=manual_review_pending` |
| `run-2` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=0d8b31fc-e2de-4d91-81e0-f97209bdab4e，结果与 run-1 一致；验证了 limitToSegments 修复后可稳定止于 10 段` |
| `run-3` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=61aa922c-b3bb-45ae-a065-67bfef3169b9，最终也收敛到与 run-1/run-2 相同结果；首个复核项主 subtype=BOUNDARY_DRIFT` |

## 5. 分段策略对照 roadmap

| roadmap 要求 | 当前实现 | 状态 | 证据 | 是否阻塞结项 |
|---|---|---|---|---|
| 按引号密度切段 | `resolveTextSegmentationRiskProfile()` 已按 `quoteRatio` 收紧 `preferredMaxSegmentLength / preferredMinSegmentLength` | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:139-167`，`apps/web/src/lib/text-processor.ts:664-707` | `否` |
| 按句子数量切段 | `sentenceCount >= 12/18` 会继续收紧分段长度 | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:157-179`，`apps/web/src/lib/text-processor.ts:664-707` | `否` |
| 按对白密度切段 | `dialogueLineCount >= 4` 或高 `quoteRatio` 会触发 `dialogue_dense` 风险画像 | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:133-156` | `否` |
| 高风险段更小粒度拆分 | 已通过风险画像缩短长度上限，但还没有证明真实样本下足以显著减少 script validation failure | `部分完成` | `apps/web/src/lib/text-processor.ts:664-707` + `uploads/sample.txt` 真实样本 2 次运行均出现 `7/10` failed segments | `是` |

## 6. 阶段回顾问题

### 6.1 我们这阶段做的事，是否直接推动了项目目标？

- 是。Prompt 契约、Validator 守门、失败段复核路由和 review workbench 强化，直接提升了“原文保真”“错误可见”“人工复核效率”这三条主线。

### 6.2 哪些是真正有效的？哪些只是缓解症状？

- 真正有效：`sourceText` 契约、段落级 Script Validator、失败段结构化入队、SCRIPT_VALIDATION 子类型与推荐动作归一化。
- 缓解症状：仅靠 review workbench 继续提高信息密度；它能帮助人更快处理失败，但不能替代上游切段和生成稳定性本身。

### 6.3 当前阶段暴露了哪些新问题？

- `limitToSegments` 之前在 runner 层没有单独生效，closeout 真实样本回归中已暴露并修复。
- 真实样本 `uploads/sample.txt` 在 `limitToSegments=10` 条件下，两次完整运行都稳定出现 `24 lines / 7 failed segments / 7 pending SCRIPT_VALIDATION`，说明 validator 护栏有效，但上游分段与生成策略仍不足以让真实样本稳定通过。
- 当前推荐动作虽然可用，但几乎全部落在 `regenerate`，尚未形成更细粒度动作判断价值。

### 6.4 剩余规划里，下一阶段最该做哪个块？为什么？

- 若严格按 roadmap 结项纪律，Phase 1 还应先补完“真实样本收敛 + 高风险切段收口”这最后一刀，再进入 Phase 2。
- 原因是当前主要失败仍集中在真实样本台本保真链路，而不是音频稳定性；若此时切到 Phase 2，会把错误地基往后带。

## 7. 结项判断

- 结论：`不可结项`
- 依据：`尽管护栏、失败路由和 review workbench 已基本成型，且 3 次真实样本运行已经证明失败模式可稳定复现，但真实样本在 limitToSegments=10 条件下仍稳定出现 7/10 failed segments，说明高风险切段与真实生成稳定性还未达到 roadmap 的结项标准。`

## 8. PR Readiness

- `pnpm --filter web test:regression`：`2026-03-12 已执行，通过（11 tests / 3 suites）`
- Phase 1 targeted tests：`2026-03-12 已执行，通过（61 tests / 9 suites）`
- 真实样本回归记录：`2026-03-13 已完成 3 次 limitToSegments=10 的真实样本回归，结果一致`
- convergence 记录：`已完成 3 次，结果一致（24 lines / 7 failed segments / 7 pending review）`
- closeout review 是否完整：`部分完整`
- PR readiness：`no`
- 缺口列表：
  - 分段策略对真实样本的通过率仍不足，需继续收口
  - 结项前需要把真实失败片段 A/B 纳入 closeout 样本表
  - 需要把当前 3 次一致失败模式沉淀为正式结论或新增修复任务
