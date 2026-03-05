# AutoBook V2 实施任务单（2026-03-05）

> 任务来源：
> - `docs/plan/2026-03-05-autobook-v2-full-automation-plan.md`
> - `docs/plan/2026-03-05-autobook-v2-prisma-migration-draft.md`

## 1. 本轮目标（可提交增量）

S0-S22（前十二批改造）已完成，本次推进第十三批“Deep Gate + 章节审计”增量：

1. 接入 Deep Gate（Q4/Q5），在句级质检中补齐情绪匹配与章节一致性评分。
2. 落地 `chapter_quality_audits` 写入链路与章节级验收结论，支持返工决策。
3. 提供阈值模板（书籍元数据 + 任务级覆盖）与误报观测指标，完成测试回归、task/handoff 回写与提交。

## 2. 执行步骤

| Step | 内容 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| S0 | 创建 task/handoff 文档骨架 | ✅ 完成 | 文档可追踪步骤状态与下一步建议 |
| S1 | Prisma Schema V2 增量建模 | ✅ 完成 | `schema.prisma` 可通过 `prisma format` |
| S2 | 服务层最小双写与注解落库 | ✅ 完成 | ScriptSentence/AudioFile 写入新增字段并写 `synthesis_attempts` |
| S3 | 补充测试并执行验证 | ✅ 完成 | 新增测试通过，回归测试通过 |
| S4 | 更新 task/handoff 并提交 | ✅ 完成 | 提交包含代码、文档、验证结果 |
| S5 | 失败路径补齐 attempt 双写 | ✅ 完成 | `generateSingleAudio` 失败场景写入 `synthesis_attempts(status=failed)` |
| S6 | Fast Gate worker + 任务队列接入 | ✅ 完成 | 支持 `QUALITY_CHECK` 入队、执行、重放、恢复与健康检查 |
| S7 | 质检 API + 测试验证 + 文档回写 | ✅ 完成 | `/api/books/[id]/qc/run` 可触发任务，测试与类型校验通过 |
| S8 | 人工复核列表/处理 API 落地 | ✅ 完成 | 支持 `GET review/items` 和 `POST resolve`（通过/驳回/重生） |
| S9 | 测试与回归验证（复核 API） | ✅ 完成 | 新增服务测试通过，回归测试与类型校验通过 |
| S10 | task/handoff 回写与提交 | ✅ 完成 | 文档同步本轮进展、建议与验证结论，并提交代码 |
| S11 | 重生自动回流 + 后置 QC 任务联动 | ✅ 完成 | `reprocessing` 在重生链路中可自动收敛到 `resolved/rejected`，并自动触发 `QUALITY_CHECK(batch)` |
| S12 | 测试回归 + 文档回写 + 提交 | ✅ 完成 | 新增/更新测试通过，task/handoff 同步本轮进展并提交 |
| S13 | `qc/retry` 批量返工 API + 服务落地 | ✅ 完成 | 支持 `issueType/chapterId/sentenceIds/score` 过滤，创建并入队 `AUDIO_GENERATION(batch)`，复核项回写 `reprocessing` |
| S14 | 测试回归 + 文档回写 + 提交 | ✅ 完成 | 新增测试通过，回归与类型校验通过，task/handoff 同步并提交 |
| S15 | `source=qc_retry` 自动后置 QC 联动 | ✅ 完成 | 返工音频任务成功后自动创建并入队 `QUALITY_CHECK(batch)`，失败场景自动回写复核项状态 |
| S16 | `auto_rejected` 二次派单策略 + 测试回归 | ✅ 完成 | `rejected(auto_rejected)` 可按策略自动转新 `pending`，新增测试通过并完成文档回写 |
| S17 | `qc_retry` 派单策略配置化 + 失败阈值落地 | ✅ 完成 | 支持 `dispatchPolicy`（书籍 + 请求 + issueType）并实现 `maxAutoRejectedCount` 阈值拦截，测试/回归/类型校验通过 |
| S18 | 二次派单看板指标 API + `source` 透传 | ✅ 完成 | 提供 `GET /api/books/[id]/qc/dispatch-metrics`，并在质检回写中落库 `source` 字段，测试/回归/类型校验通过 |
| S19 | 派单告警服务 + API（观测联动） | ✅ 完成 | 提供 `GET /api/books/[id]/qc/dispatch-alerts`，支持阈值参数和日增突变告警，测试/回归/类型校验通过 |
| S20 | `AUTO_PIPELINE` 编排入口 + 状态 API + 队列联动 | ✅ 完成 | 提供 `POST /api/books/[id]/pipeline/auto`、`GET /api/books/[id]/pipeline/status`，并支持 `AUTO_PIPELINE` 任务重放/恢复、状态流转与测试回归 |
| S21 | 告警扫描任务 + 事件沉淀 + 生命周期闭环 | ✅ 完成 | 提供定时扫描入口、`qc_dispatch_alert_events` 事件表、`dispatch-events` 查询/ack/resolve API、Webhook 通知联动，并完成测试回归 |
| S22 | `dispatchPolicy` 配置中心化 + 审计/灰度/回滚 | ✅ 完成 | 提供租户/项目/书籍三级策略配置模型与 API，`qc_retry` 主入口切换到配置中心，并支持版本审计、灰度开关和回滚 |
| S23 | Deep Gate（Q4/Q5）+ `chapter_quality_audits` + 阈值模板 | ✅ 完成 | `QUALITY_CHECK` 写入 Q1-Q5 指标，产出章节审计记录、误报观测指标，并支持任务级阈值覆盖 |
| S24 | 人工复核最小工作台 + SLO 看板整合 | ⏳ 待开始 | 提供列表/试听/重生最小 UI 与 backlog/pass/retry 日常运营指标 |

## 3. 执行日志

### [S0] 文档初始化（2026-03-05 12:14 CST）

- 已创建：
  - `docs/task/2026-03-05-autobook-v2-implementation-task.md`
  - `docs/handoff/2026-03-05-autobook-v2-implementation-handoff.md`
- 目标拆分为 S0-S4 五步，后续每步结束都回写日志与 handoff。
- 下一步建议：执行 S1，先做 schema 增量建模，避免先改业务导致数据结构阻塞。

### [S1] Prisma V2 Schema 增量建模（2026-03-05 12:15 CST）

- 完成内容：
  1. 扩展 `ScriptSentence`：`roleType`、`emotionLabel`、`emotionIntensity`、`engineHint`、`priority`、`prosody`。
  2. 扩展 `AudioFile`：`attemptNo`、`engineUsed`、`qualityScore`、`qualityVerdict`、`qualityStatus`。
  3. 新增模型：`SpeakerEngineVariant`、`SpeakerEmotionPreset`、`SynthesisAttempt`、`QualityCheckResult`、`ManualReviewItem`、`ChapterQualityAudit`。
  4. 补齐 `Book/Chapter/TextSegment/ScriptSentence/AudioFile/SpeakerProfile` 的反向关系与关键索引。
  5. 已执行 `pnpm --filter web exec prisma format --schema prisma/schema.prisma`。
- 关键文件：`apps/web/prisma/schema.prisma`
- 下一步建议：执行 S2，在现有业务流实现最小双写，不引入流程切换。

### [S2] 台本注解 + 合成尝试双写（2026-03-05 12:17 CST）

- 完成内容：
  1. 台本持久化阶段新增 Annotation v2 字段映射（含 tone->emotionLabel 标准化、优先级与韵律回填）。
  2. 段落处理新增 `roleType/engineHint/priority/prosody` 的透传。
  3. 台词 API 创建/更新契约支持新字段读写。
  4. 音频保存改为事务写入：
     - 写 `audio_files` 新质量字段（最小状态）
     - 同步写 `synthesis_attempts`（request/appliedParams/metrics/duration）
- 关键文件：
  - `apps/web/src/lib/script-generator/storage/persistence.ts`
  - `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
  - `apps/web/src/lib/script-generator/types.ts`
  - `apps/web/src/lib/script-sentence-contract.ts`
  - `apps/web/src/lib/script-sentence-service.ts`
  - `apps/web/src/lib/audio-generator.ts`
- 下一步建议：执行 S3，补充针对新增字段与情绪标准化的回归测试。

### [S3] 测试与类型校验（2026-03-05 12:22 CST）

- 完成内容：
  1. 新增测试：`apps/web/src/lib/__tests__/script-annotation-v2.test.ts`。
  2. 更新测试：`apps/web/src/lib/__tests__/script-sentence-contract.test.ts`（覆盖新增字段契约）。
  3. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/script-annotation-v2.test.ts src/lib/__tests__/script-sentence-contract.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  4. 覆盖率抽样（目标测试集）：
     - `script-sentence-contract.ts`：行覆盖 90.69%
     - `script-generator/storage/persistence.ts`：行覆盖 20.87%（新增情绪标签标准化路径已覆盖）
- 下一步建议：执行 S4，整理 task/handoff 最终状态并提交 commit。

### [S4] 交接回写与提交（2026-03-05 12:30 CST）

- 完成内容：
  1. 已回写 task/handoff 的阶段状态、验证结果、风险与下一步建议。
  2. 本轮提交范围覆盖 Schema、服务层、测试与文档，不包含流程切读切换。
  3. 提交后建议立即进入下一轮：失败路径 attempt 双写 + Fast Gate worker。
- 下一步建议：
  1. 增加 `QUALITY_CHECK` 任务类型与 worker 骨架。
  2. 用 `quality_check_results` 输出句级 verdict 与 repairPlan。

### [S5] 失败路径 attempt 双写（2026-03-05 12:34 CST）

- 完成内容：
  1. `AudioGenerator.generateSingleAudio` 新增失败链路追踪上下文（scriptSentence/voiceProfile/ttsRequest/startedAt）。
  2. 新增 `recordFailedSynthesisAttempt`，在异常分支和声音配置缺失分支写 `synthesis_attempts(status=failed)`。
  3. `attemptNo` 统一改为基于 `synthesis_attempts` 计数，成功/失败路径保持同一递增语义。
- 关键文件：
  - `apps/web/src/lib/audio-generator.ts`
- 下一步建议：执行 S6，接入 `QUALITY_CHECK` 任务类型与 Fast Gate worker。

### [S6] QUALITY_CHECK 队列与 Fast Gate Worker 骨架（2026-03-05 12:36 CST）

- 完成内容：
  1. 新增 `quality-check-runner`，实现 Q1-Q3 最小判定、repairPlan 生成与 `quality_check_results` 写入。
  2. 同步更新 `audio_files` 质量字段（`qualityScore/qualityVerdict/qualityStatus`）。
  3. 低分/硬失败场景写入 `manual_review_items`（去重 pending 项）。
  4. 队列层新增 `QUALITY_CHECK` 任务全链路：dedupe、enqueue、worker、replay、recovery、health、dead-letter。
- 关键文件：
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/lib/task-queue/ops/worker.ts`
  - `apps/web/src/lib/task-queue/ops/enqueue.ts`
  - `apps/web/src/lib/task-queue/replay-payload.ts`
  - `apps/web/src/lib/task-queue/ops/recovery.ts`
- 下一步建议：执行 S7，补齐 API 触发与测试验证并更新交接文档。

### [S7] 质检 API、测试与交接回写（2026-03-05 12:38 CST）

- 完成内容：
  1. 新增 `POST/GET /api/books/[id]/qc/run`，支持整书/章节/批量质检任务触发与状态查询。
  2. 更新任务重放/重试接口，支持 `QUALITY_CHECK`。
  3. 新增测试：
     - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`
     - `apps/web/src/lib/__tests__/task-replay-payload-quality.test.ts`
  4. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/task-replay-payload-quality.test.ts src/lib/__tests__/task-replay-route.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
- 下一步建议：
  1. 增加 `manual_review_items` 列表与 resolve API（闭环处理）。
  2. 补 Q4/Q5（情绪与章节一致性）并沉淀阈值配置。

### [S8] 人工复核列表 + resolve API（2026-03-05 13:58 CST）

- 完成内容：
  1. 新增 `GET /api/books/[id]/review/items`，支持分页、`status/priority/issueType/chapterId/sentenceId` 过滤，默认返回 pending 队列。
  2. 新增 `POST /api/books/[id]/review/items/[itemId]/resolve`，支持 `approve/reject/regenerate`（兼容“通过/驳回/重生”别名）。
  3. 新增 `manual-review-service` 统一承载查询、格式化与复核处理逻辑。
  4. `regenerate` 动作会创建 `AUDIO_GENERATION(single)` 任务并入队，同时把复核项状态切到 `reprocessing`。
- 关键文件：
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/app/api/books/[id]/review/items/route.ts`
  - `apps/web/src/app/api/books/[id]/review/items/[itemId]/resolve/route.ts`
- 下一步建议：执行 S9，补充服务层测试并跑回归，确认复核闭环基础稳定。

### [S9] 测试与回归验证（2026-03-05 14:02 CST）

- 完成内容：
  1. 新增测试：`apps/web/src/lib/__tests__/manual-review-service.test.ts`（覆盖 query 解析、resolve 三动作、重生入队失败回滚）。
  2. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/task-replay-payload-quality.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  3. 结果：测试与类型校验全部通过。
- 下一步建议：执行 S10，同步 task/handoff 并提交本轮增量。

### [S10] 文档回写与提交（2026-03-05 14:05 CST）

- 完成内容：
  1. 回写 task/handoff 的 S8-S10 进展、验证与后续建议。
  2. 本轮增量聚焦“人工复核闭环第一版”：列表、处理、重生入队、测试与验证。
  3. 已提交本轮代码与文档。
- 下一步建议：
  1. 增加 `reprocessing -> resolved/rejected` 自动回流（基于重生任务结果与 QC 回写）。
  2. 落地 `POST /api/books/[id]/qc/retry`，支持按错误类型批量返工。
  3. 继续推进 Q4/Q5（情绪匹配与章节一致性）与阈值模板化。

### [S11] 重生自动回流 + 后置 QC 联动（2026-03-05 14:30 CST）

- 完成内容：
  1. `resolve(regenerate)` 触发音频重生时，强制 `skipExisting=false` + `overwriteExisting=true`，避免直接复用旧音频导致“伪重生”。
  2. `runAudioGenerationTask` 新增人工复核上下文识别：
     - 重生失败（全部失败）时自动把对应 `manual_review_items` 从 `reprocessing` 回写为 `rejected`。
     - 重生成功后自动创建并入队后置 `QUALITY_CHECK(batch)` 任务，形成 `AUDIO_GENERATION -> QUALITY_CHECK` 的可追踪返工链路。
  3. `runQualityCheckTask` 新增 `reprocessing` 同步逻辑：
     - `pass/repair` 自动回写 `resolved(auto_resolved)`；
     - `manual_review/hard_fail` 自动回写 `rejected(auto_rejected)`；
     - 同步 `qcResultId/audioFileId/attemptId`，并追加自动回写标记到 `resolutionNote`。
- 关键文件：
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
- 下一步建议：执行 S12，补齐自动回流测试并完成文档与提交。

### [S12] 测试验证 + 文档回写 + 提交（2026-03-05 14:35 CST）

- 完成内容：
  1. 新增测试：`apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`（覆盖“重生成功触发后置 QC”与“重生失败自动拒绝”）。
  2. 更新测试：
     - `apps/web/src/lib/__tests__/manual-review-service.test.ts`（校验重生强制覆盖参数）
     - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`（覆盖 reprocessing verdict 映射）
  3. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  4. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 落地 `POST /api/books/[id]/qc/retry`，按 issueType/score 区间批量返工并打标签。
  2. 在 `rejected(auto_rejected)` 场景补“二次派单策略”（可选自动转新 pending 项）。
  3. 继续推进 Q4/Q5（情绪匹配与章节一致性）与阈值模板化。

### [S13] `qc/retry` 批量返工 API + 服务落地（2026-03-05 15:21 CST）

- 完成内容：
  1. 新增 `qc-retry-service`，支持返工参数解析与校验：`issueType/issueTypes/chapterId/sentenceIds/minScore/maxScore/includeRejected/limit/provider/voiceProfileId`。
  2. 新增批量筛选与排序策略（优先级 + 时间），并支持从 `qualityCheckResult.score`/`issueDetail.score` 双来源做分数过滤。
  3. 落地 `POST /api/books/[id]/qc/retry`：
     - 创建 `AUDIO_GENERATION(batch)` 任务；
     - 入队参数强制 `skipExisting=false + overwriteExisting=true`；
     - 入队成功后将命中 `manual_review_items` 回写到 `reprocessing`，并追加 `qc_retry_task:<taskId>` 标记。
  4. 入队失败兜底：任务自动置为 `failed` 并写入 `taskData.metadata.queueError`。
- 关键文件：
  - `apps/web/src/lib/qc-retry-service.ts`
  - `apps/web/src/app/api/books/[id]/qc/retry/route.ts`
  - `apps/web/src/app/api/books/[id]/qc/retry/README.md`
- 下一步建议：执行 S14，补齐单测/回归并完成文档回写和提交。

### [S14] 测试回归 + 文档回写 + 提交（2026-03-05 15:24 CST）

- 完成内容：
  1. 新增测试：`apps/web/src/lib/__tests__/qc-retry-service.test.ts`（覆盖 payload 解析、成功入队、无候选、活跃任务冲突、入队失败回滚）。
  2. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  3. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 在 `rejected(auto_rejected)` 场景补“二次派单策略”（可选自动复制为新 pending 项）。
 2. 为 `source=qc_retry` 增加“自动后置 QC”联动，降低返工后漏检风险。
 3. 继续推进 Q4/Q5（情绪匹配与章节一致性）与阈值模板化。

### [S15] `source=qc_retry` 自动后置 QC 联动（2026-03-05 15:31 CST）

- 完成内容：
  1. `runAudioGenerationTask` 新增 `qc_retry` 任务上下文识别（`selectedReviewItemIds`）。
  2. `qc_retry` 返工成功后自动创建并入队 `QUALITY_CHECK(batch)`，并在质检任务 metadata 中注入：
     - `source=qc_retry`
     - `retryReviewItemIds`
     - `autoCreatePendingOnReject=true`
  3. `qc_retry` 返工失败（全部失败）或无有效音频引用时，自动将命中的 `manual_review_items` 从 `reprocessing` 回写为 `rejected`，避免状态悬挂。
  4. 若后置质检入队失败，自动标记质检任务为 `failed` 并回写返工复核项为 `rejected(batch_regenerate_qc_enqueue_failed)`。
- 关键文件：
  - `apps/web/src/lib/audio-generation-runner.ts`
- 下一步建议：执行 S16，补齐 `auto_rejected` 二次派单策略并补充测试回归。

### [S16] `auto_rejected` 二次派单策略 + 测试回归（2026-03-05 15:34 CST）

- 完成内容：
  1. `runQualityCheckTask` 新增任务上下文解析，支持 `autoCreatePendingOnReject` 策略开关（`source=qc_retry` 默认开启）。
  2. `syncReprocessingManualReviewItems` 在 `verdict=manual_review/hard_fail` 且策略开启时，自动执行“二次派单”：
     - 先回写原 `reprocessing` 项为 `rejected(auto_rejected)`；
     - 再复制生成新的 `pending` 复核项（去重后创建），并标记 `dispatch=secondary_pending`。
  3. 质检任务统计新增 `secondaryDispatchCount` 与 `source`，便于后续看板追踪自动派单规模。
  4. 新增测试：
     - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
     - 更新 `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`（覆盖 `qc_retry` 后置 QC 与失败回写）
  5. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  6. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 将 `autoCreatePendingOnReject` 抽为可配置策略（按书籍/租户/issueType 粒度），避免全局固定行为。
  2. 在二次派单链路增加“累计失败次数阈值”，超过阈值后切换为人工强制介入。
  3. 继续推进 Q4/Q5（情绪匹配与章节一致性）与阈值模板化。

### [S17] `qc_retry` 策略配置化 + 阈值落地（2026-03-05 15:50 CST）

- 完成内容：
  1. `qc-retry-service` 支持 `dispatchPolicy` 参数解析，新增策略结构：
     - `autoCreatePendingOnReject`
     - `maxAutoRejectedCount`
     - `issueTypePolicies`
  2. `qc-retry-service` 新增策略合并逻辑：
     - 默认策略：`autoCreatePendingOnReject=true`、`maxAutoRejectedCount=2`
     - 书籍策略来源：`book.metadata.qcRetryPolicy`（兼容 `book.metadata.qualityCheck.qcRetryPolicy`）
     - 请求级策略可覆盖默认/书籍策略，并回写到返工任务 `taskData.metadata`。
  3. `audio-generation-runner` 在 `source=qc_retry` 场景下透传策略到后置 `QUALITY_CHECK(batch)` 任务，避免上下文丢失。
  4. `quality-check-runner` 落地阈值控制：
     - 二次派单前读取 `issueDetail.autoRejectedCount` 做累计；
     - 支持 issueType 级策略覆盖；
     - 超阈值时拒绝再次自动派单，回写 `secondaryDispatch=threshold_blocked` 并统计 `secondaryDispatchSkippedByThresholdCount`。
  5. 新增/更新测试：
     - `apps/web/src/lib/__tests__/qc-retry-service.test.ts`
     - `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`
     - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  6. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  7. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 把策略配置从 `book.metadata` 下沉到可管理实体（如租户级/项目级配置表）并补管理 API。
  2. 为 `autoRejectedCount` 增加看板指标（按 `issueType/source` 聚合）并做告警阈值。
  3. 继续推进 Deep Gate（Q4/Q5）与章节审计阈值模板化。

### [S18] 二次派单看板指标 API + `source` 透传（2026-03-05 16:22 CST）

- 完成内容：
  1. 新增 `qc-dispatch-metrics-service`，支持窗口期聚合（默认 7 天，最大 90 天）：
     - `autoRejectedEventCount`
     - `autoRejectedAccumulatedCount`（累计重拒次数）
     - `thresholdBlockedCount`
     - `secondaryPendingCount`
     - `qualityTaskSummary.secondaryDispatch*`
  2. 新增 `GET /api/books/[id]/qc/dispatch-metrics`，支持 `days/source/issueType` 过滤并返回按 `issueType/source` 聚合结果。
  3. `quality-check-runner` 在 `auto_rejected` 与二次 `secondary_pending` 回写链路补写 `issueDetail.source`，并在首次入复核时回写 `source`，保证指标聚合可追踪来源。
  4. 新增/更新测试：
     - 新增 `apps/web/src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
     - 更新 `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  5. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-metrics-service.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/qc-retry-service.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  6. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 把当前指标服务接入告警策略（例如 `thresholdBlockedCount` 日增突变告警）。
  2. 补充租户/项目级 `dispatchPolicy` 配置中心，替代 `book.metadata` 作为主配置入口。
  3. 继续推进 Deep Gate（Q4/Q5）与章节一致性审计落地。

### [S19] 派单告警服务 + API（2026-03-05 16:31 CST）

- 完成内容：
  1. 新增 `qc-dispatch-alert-service`，基于现有 `qc-dispatch-metrics-service` 落地三类告警：
     - `threshold_blocked_spike`（最近 24h 相对上一窗口突增）
     - `secondary_pending_backlog`
     - `auto_rejected_accumulated_pressure`
  2. 告警查询支持阈值参数化（含默认值）：
     - `thresholdBlockedSpikeDelta`
     - `thresholdBlockedGrowthRate`
     - `thresholdBlockedCurrentFloor`
     - `secondaryPendingLimit`
     - `autoRejectedAccumulatedLimit`
  3. 新增 `GET /api/books/[id]/qc/dispatch-alerts`，支持 `days/source/issueType` 与阈值参数，返回 `alerts + snapshot + thresholds`。
  4. 新增测试：
     - `apps/web/src/lib/__tests__/qc-dispatch-alert-service.test.ts`
  5. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-alert-service.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  6. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 将当前“按请求实时计算告警”升级为定时扫描任务 + 告警事件落库（便于历史追踪与通知集成）。
  2. 补充租户/项目级 `dispatchPolicy` 配置中心，替代 `book.metadata` 作为主配置入口。
  3. 继续推进 Deep Gate（Q4/Q5）与章节一致性审计落地。

### [S20] `AUTO_PIPELINE` 编排入口 + 状态 API（2026-03-05 17:12 CST）

- 完成内容：
  1. 新增 `auto-pipeline-runner`（拆分为 `common/task-stage-utils/runner` 三个模块），实现四阶段串行编排：
     - `TEXT_PROCESSING -> SCRIPT_GENERATION -> AUDIO_GENERATION -> QUALITY_CHECK`（可按参数关闭质检阶段）
     - 自动创建子任务并回写 `AUTO_PIPELINE` 主任务阶段状态
     - 失败场景保留 `failedStage/error` 追踪信息
  2. 队列体系新增 `AUTO_PIPELINE` 全链路支持：
     - dedupe key、enqueue、worker、health、replay payload、manual replay/retry、watchdog recovery、legacy namespace 检查
  3. 新增 API：
     - `POST /api/books/[id]/pipeline/auto`（创建并入队自动编排任务）
     - `GET /api/books/[id]/pipeline/status`（返回阶段任务状态、当前阶段、质检摘要与待复核数量）
  4. 状态机扩展：
     - `BookStatus`/`validation`/`constants`/`status meta` 新增 `quality_checking/manual_review_pending/assembling_audio`
     - 任务视图新增 `AUTO_PIPELINE` 标签
  5. 新增测试：
     - `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`
     - `apps/web/src/lib/__tests__/task-replay-payload-auto.test.ts`
  6. 执行命令：
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-runner.test.ts src/lib/__tests__/task-replay-payload-auto.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  7. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 执行 S21：把“实时查询告警”升级成定时扫描 + 事件落库 + 通知联动。
  2. 执行 S22：将 `dispatchPolicy` 从 `book.metadata` 下沉到租户/项目/书籍三级配置中心。
  3. 执行 S23：接入 Deep Gate（Q4/Q5）与章节一致性审计链路。

### [S21] 告警扫描任务 + 事件沉淀 + 生命周期闭环（2026-03-05 19:35 CST）

- 完成内容：
  1. Prisma 新增 `qc_dispatch_alert_events` 事件模型（含 `status/open|acked|resolved` 生命周期字段、`fingerprint` 去重键、`triggerCount` 与快照载荷），并在 `Book` 增加反向关系。
  2. 新增 `qc-dispatch-alert-event-service`：
     - 支持单书扫描沉淀（`scanQcDispatchAlertsForBook`）：新告警创建事件、已 ack 告警自动 reopen、已消失告警自动 `resolved(auto_resolved_by_scan)`；
     - 支持事件列表查询（按 `status/source/issueType/alertCode` 过滤）；
     - 支持事件生命周期处理（`ack/resolve`）；
     - 支持跨书籍批量扫描（用于定时任务入口）。
  3. 新增 `qc-dispatch-alert-notifier`，接入 Webhook 通知通道（`QC_DISPATCH_ALERT_WEBHOOK_URL`），对新建/重开事件执行投递并回传投递状态。
  4. 新增 API：
     - `POST /api/books/[id]/qc/dispatch-alerts/scan`（单书手动扫描）
     - `GET /api/books/[id]/qc/dispatch-events`（事件列表）
     - `POST /api/books/[id]/qc/dispatch-events/[eventId]/resolve`（ack/resolve）
     - `POST /api/qc/dispatch-alerts/scan`（跨书籍定时扫描入口，支持 token 保护）
  5. 新增测试：`apps/web/src/lib/__tests__/qc-dispatch-alert-event-service.test.ts`（覆盖事件创建、重开、自动收敛、生命周期处理与批量扫描容错）。
  6. 执行命令：
     - `pnpm --filter web exec prisma format --schema prisma/schema.prisma`
     - `pnpm --filter web exec prisma generate --schema prisma/schema.prisma`
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-alert-event-service.test.ts src/lib/__tests__/qc-dispatch-alert-service.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  7. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 执行 S22：落地 `dispatchPolicy` 配置中心（租户/项目/书籍三级）并替换 `book.metadata` 主入口。
  2. 在 S22 同步补“策略变更审计 + 灰度开关 + 回滚快照”，避免策略上线风险。
  3. 执行 S23：接入 Deep Gate（Q4/Q5）与 `chapter_quality_audit` 执行链路。

### [S22] `dispatchPolicy` 配置中心化 + 审计/灰度/回滚（2026-03-05 20:18 CST）

- 完成内容：
  1. Prisma 新增配置中心数据模型：
     - `qc_dispatch_policy_configs`（`scopeType/scopeKey` 唯一键、`policy`、`isActive`、`rolloutPercentage`、`version`）
     - `qc_dispatch_policy_revisions`（版本快照、变更类型、操作者与变更备注）
     - `books` 补充 `tenantId/projectId` 与 `dispatchPolicyConfigs` 反向关系。
  2. 新增策略契约与配置中心服务：
     - `qc-dispatch-policy.ts` 统一解析/合并/序列化 `dispatchPolicy` 契约；
     - `qc-dispatch-policy-config-service`（拆分 `parsers/runtime/mutations/types`）支持：
       - 三级 scope 运行时合并（`tenant -> project -> book -> request override`）
       - 灰度开关（`rolloutPercentage` 稳定哈希命中）
       - 版本审计（create/update/rollback）
       - 指定版本回滚与 optimistic version 校验（`expectedVersion`）。
  3. 新增 API：
     - `GET/PUT /api/books/[id]/qc/dispatch-policy`
     - `POST /api/books/[id]/qc/dispatch-policy/rollback`
  4. `qc-retry-service` 已切换为配置中心主入口：
     - 移除对 `book.metadata.qcRetryPolicy` 的读取依赖；
     - 入队 metadata 新增 `dispatchPolicyScopes/dispatchPolicyContext`，便于策略追踪与回放排障。
  5. 新增/更新测试：
     - 新增 `apps/web/src/lib/__tests__/qc-dispatch-policy-config-service.test.ts`
     - 更新 `apps/web/src/lib/__tests__/qc-retry-service.test.ts`
  6. 执行命令：
     - `pnpm --filter web exec prisma format --schema prisma/schema.prisma`
     - `pnpm --filter web exec prisma generate --schema prisma/schema.prisma`
     - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-policy-config-service.test.ts src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
     - `pnpm --filter web test:regression`
     - `pnpm --filter web typecheck`
  7. 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 执行 S23：接入 Deep Gate（Q4/Q5）并落地 `chapter_quality_audits` 写入与阈值模板。
  2. 在 S23 增补 Fast Gate/Deep Gate 的误报对照指标，避免质量门控误杀。
  3. 执行 S24：补人工复核最小工作台（列表/试听/重生）并接入运营看板。

### [S23] Deep Gate（Q4/Q5）+ 章节审计 + 阈值模板（2026-03-05 21:08 CST）

- 完成内容：
  1. 新增 `quality-gate` 模块（`types/thresholds/evaluator`）并接入 `quality-check-runner`：
     - Fast Gate 输出与 Deep Gate（Q4 情绪匹配、Q5 章节一致性）融合为统一 verdict；
     - `quality_check_results` 升级为 `gate=FAST_DEEP_GATE`、`stage=Q1_Q5`，落库 Q1-Q5 指标、融合分数与阈值快照。
  2. 质检任务支持阈值模板双来源：
     - 书籍级：`book.metadata.qualityCheck.deepGateThresholdTemplate`；
     - 任务级：`POST /api/books/[id]/qc/run` 可传 `deepGateThresholdTemplate`（兼容 `thresholdTemplate` 别名）覆盖本次执行。
  3. 落地 `chapter_quality_audits` 写入链路：
     - 每章按 `taskId` 生成审计批次（`auditBatchId`）；
     - 写入章节级 `overallScore/verdict/continuityMetric/speakerDrift/actions`，支持章节验收与返工决策。
  4. 误报观测与 issueType 扩展：
     - 新增 `deepGateOverrideCount/falsePositiveCandidateCount` 指标；
     - 复核项 issueType 支持 `EMOTION/CONTINUITY`，`reprocessing` 同步逻辑改为支持 `retryReviewItemIds` 精准回写。
  5. 回写链路增强：
     - `book.metadata.qualityCheck` 增补阈值来源、章节审计摘要与误报信号；
     - 自动后置 QC 文案与创建入口更新为 Fast/Deep Gate 语义。
- 关键文件：
  - `apps/web/src/lib/quality-gate/index.ts`
  - `apps/web/src/lib/quality-gate/thresholds.ts`
  - `apps/web/src/lib/quality-gate/evaluator.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/app/api/books/[id]/qc/run/route.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
- 新增/更新测试：
  - 新增 `apps/web/src/lib/__tests__/quality-gate.test.ts`
  - 更新 `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-gate.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/qc-retry-service.test.ts`
  - `pnpm --filter web test:regression`
  - `pnpm --filter web typecheck`
- 结果：新增测试、回归测试与类型校验全部通过。
- 下一步建议：
  1. 执行 S24：补人工复核最小工作台（列表/试听/重生）并串联 Deep Gate issueType（`EMOTION/CONTINUITY`）筛选。
  2. 在 S24 同步接入运营看板（backlog/pass/retry/false-positive）可视化，复用本轮沉淀指标。
  3. 下一轮将 Deep Gate 代理规则替换为真实模型（情绪分类/章节一致性 embedding），降低启发式误差。

## 4. 风险与备注

1. 本轮未切换新读路径（仍保持旧查询兼容）。
2. Fast Gate + Deep Gate 当前仍使用启发式代理，未接入真实 ASR/CER/声纹/情绪模型，需继续做离线对齐验证。
3. 已落地 `AUTO_PIPELINE` 主链路入口、S21 告警运营闭环、S22 策略配置中心与 S23 章节审计；当前主要缺口为复核工作台 UI 与 SLO 看板。

## 5. 总体回顾与剩余任务优先级（2026-03-05 21:08 CST）

### 5.1 总体目标回顾（对齐 `full-automation-plan`）

1. 实现“上传即自动生成”的端到端自动链路（文本处理 -> 角色抽取 -> 台本标注 -> 合成 -> 质检 -> 复核 -> 交付）。
2. 建立可持续优化的数据与流程底座（多引擎策略、返工闭环、可观测性与告警）。
3. 在质量与成本上可运营（SLO、阈值、灰度、告警联动）。

### 5.2 当前现状（S0-S23 完成后）

| 里程碑 | 当前状态 | 现状说明 |
| --- | --- | --- |
| M1（Annotation v2 + Auto Pipeline） | ✅ 已完成 | Annotation v2 与 `AUTO_PIPELINE` 编排、状态 API、任务恢复链路已打通。 |
| M2（Fast Gate + 自动返工闭环） | ✅ 已完成（Fast Gate 范围） | Q1-Q3、`qc/retry`、二次派单策略、阈值拦截、观测指标与告警查询已具备。 |
| M3（Deep Gate + 人工复核工作台） | 🔄 部分完成 | Q4/Q5 与 `chapter_quality_audit` 执行链路已完成；复核工作台 UI 仍未落地。 |
| M4（SLO + 告警运营 + 配置中心） | 🔄 部分完成 | 告警扫描、事件沉淀、Webhook 通知与 `dispatchPolicy` 配置中心已就绪；缺 SLO 看板与策略治理 UI。 |

### 5.3 剩余任务目标与优先级（重排）

| 优先级 | 任务编号 | 目标 | 建议落地项 | 验收标准 | 前置依赖 |
| --- | --- | --- | --- | --- | --- |
| P0 | S24 | 人工复核与运营体验补齐 | 人工复核最小工作台（列表/试听/重生）+ SLO 看板整合 + Deep Gate issueType 运营视图 | 复核操作可视化；关键指标（backlog/pass/retry/false-positive）可日常运营使用 | S23 |

### 5.4 推荐执行顺序（下一轮）

1. **S24（P0）**：补人工复核最小工作台 + SLO 看板，完成运营侧闭环。
2. **S24.1（建议）**：在 S24 末尾追加 Deep Gate 误报看板联调与阈值调参流程文档。

### 5.5 本次文档同步说明

1. 已同步更新本任务文档 S23 实施结果（代码落点、测试命令、风险与后续优先级）。
2. 已同步更新 handoff 文档，确保接手人可直接从 S24 开始推进。
