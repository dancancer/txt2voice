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
| `uploads/sample.txt` | 本地统一测试书 | `真实样本回归（limitToSegments=10）` | 11 | `已执行` | `旧基线 3 次运行稳定为 24 lines / 7 failed segments / 7 pending SCRIPT_VALIDATION；2026-03-16 期间经历 quote refinement、review 清理和 canonical split 收口后，最新代码已在同一条件下连续 3 次收敛到 86 lines / 0 failed / 0 pending` |

## 4. 多次运行收敛性记录

| Run ID | 样本 | 句子数 | 失败段数 | 待复核数 | Verdict | 备注 |
|---|---|---:|---:|---:|---|---|
| `run-1` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=28d07d9d-38a4-465c-82e6-063d42430152，book.status=manual_review_pending` |
| `run-2` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=0d8b31fc-e2de-4d91-81e0-f97209bdab4e，结果与 run-1 一致；验证了 limitToSegments 修复后可稳定止于 10 段` |
| `run-3` | `uploads/sample.txt(limitToSegments=10)` | 24 | 7 | 7 | `partial_failure` | `book=61aa922c-b3bb-45ae-a065-67bfef3169b9，最终也收敛到与 run-1/run-2 相同结果；首个复核项主 subtype=BOUNDARY_DRIFT` |
| `run-4` | `uploads/sample.txt(limitToSegments=10)` | 70 | 1 | 1 | `partial_failure` | `book=87f2142e-c7d0-4788-a3d3-386696c1580d，最新代码下只剩 1 个 SCRIPT_VALIDATION 失败段，主 subtype 仍为 BOUNDARY_DRIFT` |
| `run-5` | `uploads/sample.txt(limitToSegments=10)` | 75 | 1 | 1 | `partial_failure` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，第二次复跑仍只剩 1 个失败段；主 subtype 仍为 BOUNDARY_DRIFT，但句子总数从 70 波动到 75` |
| `run-6` | `uploads/sample.txt(limitToSegments=10)` | 79 | 0 | 1 | `completed*` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=785da8c6-fb88-4137-b992-721b1ba87c16；quote refinement 后首次完整复跑已无 failed segments，但旧 SCRIPT_VALIDATION review item 仍残留为 pending，暴露成功路径未清理 review 的 runner 缺口` |
| `run-7` | `uploads/sample.txt(limitToSegments=10)` | 84 | 0 | 0 | `completed` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=7b18cf90-cbab-4a77-8fbe-680b214a309b；修复 runner review 清理后再次整本复跑，pending review 归零，但 totalLines 从 79 继续漂到 84；orderIndex 1 从 3 漂到 8` |
| `run-8` | `uploads/sample.txt(limitToSegments=10)` | 76 | 0 | 0 | `completed` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=51676eb3-8ebe-496e-ae25-c43f72552c20；新增“旁白挟带带归属语对白” validator tightening 后再次整本复跑，failed/pending 继续维持 0/0，但 totalLines 进一步漂到 76；orderIndex 1/5/7/9 分别落到 4/7/7/8` |
| `run-9` | `uploads/sample.txt(limitToSegments=10)` | 86 | 0 | 0 | `completed` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=ff4c5a50-0fc2-45cf-9d18-e92d50b40ec9；引入 post-LLM canonical split 后首轮整本复跑，line_count 分布稳定到 8/8/9/11 等新基线` |
| `run-10` | `uploads/sample.txt(limitToSegments=10)` | 86 | 0 | 0 | `completed` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=a8cb0452-b431-4000-8e32-2279401ca5e1；与 run-9 完全一致，failed/pending 继续维持 0/0` |
| `run-11` | `uploads/sample.txt(limitToSegments=10)` | 86 | 0 | 0 | `completed` | `book=30c38043-d8e5-4388-9db4-c57b58161c98，task=7eac24fd-d5ad-4061-9a5d-5c14d5ffbc4c；与 run-9/run-10 完全一致，形成当前代码同条件 3 次收敛证据` |

## 5. 分段策略对照 roadmap

| roadmap 要求 | 当前实现 | 状态 | 证据 | 是否阻塞结项 |
|---|---|---|---|---|
| 按引号密度切段 | `resolveTextSegmentationRiskProfile()` 已按 `quoteRatio` 收紧 `preferredMaxSegmentLength / preferredMinSegmentLength` | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:139-167`，`apps/web/src/lib/text-processor.ts:664-707` | `否` |
| 按句子数量切段 | `sentenceCount >= 12/18` 会继续收紧分段长度 | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:157-179`，`apps/web/src/lib/text-processor.ts:664-707` | `否` |
| 按对白密度切段 | `dialogueLineCount >= 4` 或高 `quoteRatio` 会触发 `dialogue_dense` 风险画像 | `已完成` | `apps/web/src/lib/text-segmentation-profile.ts:133-156` | `否` |
| 高风险段更小粒度拆分 | 除了风险画像缩短长度上限，还在生成后增加了 quoted narration refinement 和 post-LLM canonical split，确保高风险 attributed dialogue 在落库前被统一到固定粒度 | `已完成` | `apps/web/src/lib/text-processor.ts:664-707`，`apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`，`apps/web/src/lib/script-generator/pipeline/segment-processor.ts`；`uploads/sample.txt(limitToSegments=10)` 最新代码 3 次稳定为 `86/0/0` | `否` |

## 6. 阶段回顾问题

### 6.1 我们这阶段做的事，是否直接推动了项目目标？

- 是。Prompt 契约、Validator 守门、失败段复核路由和 review workbench 强化，直接提升了“原文保真”“错误可见”“人工复核效率”这三条主线。

### 6.2 哪些是真正有效的？哪些只是缓解症状？

- 真正有效：`sourceText` 契约、段落级 Script Validator、失败段结构化入队、SCRIPT_VALIDATION 子类型与推荐动作归一化。
- 缓解症状：仅靠 review workbench 继续提高信息密度；它能帮助人更快处理失败，但不能替代上游切段和生成稳定性本身。

### 6.3 当前阶段暴露了哪些新问题？

- `limitToSegments` 之前在 runner 层没有单独生效，closeout 真实样本回归中已暴露并修复。
- 真实样本 `uploads/sample.txt` 的旧基线已经 3 次稳定收敛到 `24 lines / 7 failed segments / 7 pending SCRIPT_VALIDATION`；最新代码下 2 次复跑把失败段压到 `1/1`，说明问题已从 runner/粗粒度切段层，下沉到少数高风险 quoted report / attributed dialogue 组合。
- `70/75` 的句子数波动已定位到 `orderIndex=1`：两次运行使用的是同一段原文，但 LLM 对“多句旁白 + 句尾引语”的拆分粒度不同；当前差异表现为 narration granularity 漂移，而不是漏内容或重复抽取。
- 当前剩余 `BOUNDARY_DRIFT` 的直接根因已经定位：`“是。” + 归属语 + 报表引语` 会在 refinement 中把后续报表引语从归属语上拆掉，导致 `“陵州纳灵石……` 这类纯引号片段失去上下文；`2026-03-16` 已补失败测试并修复该规则，实时复跑中 `orderIndex=3` 已从 `0` 句恢复到 `9` 句，但整轮 closeout 新基线尚未跑完。
- 同一轮完整复跑进一步暴露出 runner 成功路径没有自动清理旧 `SCRIPT_VALIDATION` review item：`task=785da8c6-fb88-4137-b992-721b1ba87c16` 已完成且 `failedSegments=0`，但旧 pending review 仍残留；`2026-03-16` 已补 runner 单测并修复为成功后自动 `auto_resolved`，随后单段真实回归 `task=b9000337-538f-4907-ac72-baca43c9a00f` 已验证 pending review 从 `1 -> 0`。
- 最新整本复跑 `task=7b18cf90-cbab-4a77-8fbe-680b214a309b` 已证明：即使 `failed segments / pending review` 都归零，`totalLines` 仍会从 `79` 漂到 `84`；而且这轮运行中 `orderIndex=1/3/5/7/9` 都曾在主路径触发 validator，再由 refinement 兜底，说明真正未收口的是“句子粒度 canonicalization”，不是 review 路由或失败段清理。
- 最新实验 `task=51676eb3-8ebe-496e-ae25-c43f72552c20` 继续证明：仅靠把部分 mixed narration/quote 情况更早打进 validator，并不能让 `totalLines` 收敛；新代码把整本结果从 `84` 又拉回 `76`，但 `failed/pending` 仍然是 `0/0`。这说明当前系统已经具备“靠 validator + refinement 清零失败段”的能力，却仍缺少一个稳定的句子级 canonicalization 层。
- 当前问题链已经收口：在补入 post-LLM canonical split 之后，同一提交下的 `run-9/run-10/run-11` 连续 3 次都稳定为 `86 lines / 0 failed / 0 pending`，说明 `orderIndex=1/5/7/9` 这批真实高风险模式已经被压成可重复的新基线。
- 当前推荐动作虽然可用，但几乎全部落在 `regenerate`，尚未形成更细粒度动作判断价值。

### 6.4 剩余规划里，下一阶段最该做哪个块？为什么？

- 按 roadmap 的结项纪律，Phase 1 当前已经具备转入 Phase 2 的条件。
- 原因是“真实样本收敛 + 高风险切段收口”这最后一刀已经落地：当前主线不再是原文到台本的正确性问题，而是后续音频稳定性与生产链路问题。

## 7. 结项判断

- 结论：`可结项`
- 依据：`Phase 1 的护栏、失败路由、review 清理和句子级 canonicalization 已在同一真实样本上形成完整证据链：旧基线 3 次稳定失败、随后逐轮把 failed/pending 压到 0/0，最终在当前代码下连续 3 次收敛到 86 / 0 / 0。对于 roadmap 定义的“原文 -> 台本 正确性重建”，当前证据已足够支撑结项并进入 Phase 2。`

## 8. PR Readiness

- `pnpm --filter web test:regression`：`2026-03-16 已执行，通过（11 tests / 3 suites）`
- Phase 1 targeted tests：`2026-03-16 已补跑通过：failed-segment-refinement / segment-processor-refinement / segment-processor-canonicalization / segment-script-validator / script-generation-runner`
- `pnpm --filter web typecheck`：`2026-03-16 已执行，通过`
- 真实样本回归记录：`旧基线已完成 3 次一致回归；2026-03-16 最新代码下已完成 2 次 1/1 复跑 + 6 次 0 failed 完整复跑`
- convergence 记录：`旧基线已完成 3 次一致记录；当前代码下最新 3 次整本复跑已稳定收敛到 86 / 0 / 0`
- closeout review 是否完整：`完整`
- PR readiness：`yes`
- 剩余备注：
  - `86` 应视为当前代码下的 canonical baseline，而不是历史 `70/75/79/84/76` 的延续
  - 进入 Phase 2 后，若音频链路再暴露新的句子粒度问题，应按新阶段问题单独处理，不回滚 Phase 1 结项判断
