# AutoBook V2 实施任务单（2026-03-05）

> 任务来源：
> - `docs/epic/2026-03-05-autobook-v2/2026-03-05-autobook-v2-full-automation-plan.md`
> - `docs/epic/2026-03-05-autobook-v2/2026-03-05-autobook-v2-prisma-migration-draft.md`

## 1. 本轮目标（可提交增量）

S0-S29（前十九批改造）已完成，本轮推进第二十批 **S30 Q0-Q3 指标化升级（CER/声纹优先）**：

1. 在 `quality-check-runner` 落地 Q0-Q3 统一运行时（信号源解析、阈值模板、评分融合、issueType 归因），把 Fast Gate 从纯启发式升级为“指标优先 + 启发式兜底”。
2. 在 `QUALITY_CHECK` 任务与 `quality_check_results/manual_review_items` 沉淀 Q0-Q3 诊断字段（`q0Score/q2Cer/q3SpeakerSimilarity/signalSources/primarySignal`），并将 stage 升级为 `Q0_Q5`。
3. 扩展质检观测 API：`POST /api/books/[id]/qc/run` 支持 `signalSources/q0q3Thresholds`；`GET /api/books/[id]/qc/run` 返回最新 Q0-Q3 摘要；`GET /api/books/[id]/qc/dispatch-metrics` 输出 `signalBreakdown(cer/speaker)`。

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
| S24 | 人工复核最小工作台 + SLO 看板整合 | ✅ 完成 | 提供列表/试听/重生最小 UI 与 backlog/pass/retry 日常运营指标 |
| S25 | Deep Gate 模型运行时接入 + 阈值重标定快照 | ✅ 完成 | 支持情绪/一致性模型可配置调用、自动回退观测、阈值校准建议输出与测试回归 |
| S26 | 复核运营自动化（批量处置 + 告警处置 + 审计导出） | ✅ 完成 | 复核页支持批量通过/重生、告警事件 ack/resolve、处置日志 CSV 导出并通过测试回归 |
| S27 | Deep Gate 阈值治理闭环 V1（evaluate/publish/rollback） | ✅ 完成 | 支持离线评估报告、阈值版本发布与回滚，链路可审计且测试/回归通过 |
| S28 | 上传自动触发 Auto Pipeline + 主入口统一 | ✅ 完成 | 上传后默认触发自动编排，手工触发/上传触发复用同一建链服务，并回传 upload 来源与阶段耗时 |
| S29 | Engine Router v1 运行时接入 | ✅ 完成 | 音频生成支持路由决策/自动降级/策略透传，新增路由指标 API，并完成测试回归 |
| S30 | Q0-Q3 指标化升级（CER/声纹优先） | ✅ 完成 | 质检主链路支持 Q0-Q3 指标化评分与信号来源观测，新增参数透传与指标聚合 API，测试/回归/类型校验通过 |

## 3. 执行日志

### [S0] 文档初始化（2026-03-05 12:14 CST）

- 已创建：
  - `docs/epic/2026-03-05-autobook-v2/2026-03-05-autobook-v2-implementation-task.md`
  - `docs/epic/2026-03-05-autobook-v2/2026-03-05-autobook-v2-implementation-handoff.md`
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

### [S24] 人工复核最小工作台 + SLO 看板整合（2026-03-06 10:22 CST）

- 完成内容：
  1. 新增 `books/[id]/review` 页面，落地人工复核最小工作台：
     - 支持 `status/issueType/priority` 筛选与分页；
     - 支持句级文本查看、最近音频试听；
     - 支持单条 `approve/reject/regenerate` 操作并自动刷新队列与看板。
  2. 工作台接入 SLO 看板：
     - 聚合展示 backlog、pass rate、retry pressure、false-positive 候选；
     - 集成 `dispatch-metrics` 与 `dispatch-alerts` 数据，支持窗口（日/周/月）与来源过滤；
     - 展示 issueType 维度拆分表和告警建议动作。
  3. 导航入口联动：
     - `BookNavigation` 新增“质检复核”页签；
     - 书籍概览页操作区新增“质检复核”快捷入口。
  4. 结构与可维护性：
     - 新页面按 `components/hooks/models` 分层，单文件控制在 400 行内；
     - 类型约束与数据钩子分离，避免 UI 逻辑和请求编排耦合。
- 关键文件：
  - `apps/web/src/app/books/[id]/review/page.tsx`
  - `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchData.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueuePanel.tsx`
  - `apps/web/src/app/books/[id]/review/components/ReviewSloPanel.tsx`
  - `apps/web/src/app/books/[id]/review/models/types.ts`
  - `apps/web/src/components/BookNavigation.tsx`
  - `apps/web/src/app/books/[id]/page.tsx`
- 执行命令：
  - `pnpm --filter web lint`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web test:regression`
- 结果：Lint、类型校验与回归测试通过，复核工作台最小可用 UI 与 SLO 看板整合完成。
- 下一步建议：
  1. 执行 S25：将 Deep Gate 代理规则替换为真实情绪分类与章节一致性模型，降低误报率。
  2. 为复核工作台补批量操作（批量通过/批量重生）与审计记录导出能力。
  3. 为 SLO 看板补事件生命周期视图（open/acked/resolved）与处置入口。

### [S25] Deep Gate 模型运行时接入 + 阈值重标定快照（2026-03-06 10:48 CST）

- 完成内容：
  1. 新增 Deep Gate 模型运行时模块，支持情绪模型与章节一致性模型双路可配置调用：
     - 支持从环境变量、书籍 metadata、任务 metadata 三层解析运行时配置；
     - 模型请求失败时自动回退启发式规则，不阻塞 `QUALITY_CHECK` 主链路。
  2. 升级 Deep Gate 判定融合逻辑：
     - `evaluateDeepGate` 支持接收模型推理分数（`q4/q5`）与来源标记（`heuristic/emotion_model/continuity_model`）；
     - 质检明细中新增 `deepGate.q4Source/q5Source/modelDiagnostics`，可定位模型回退原因。
  3. 在 `quality-check-runner` 落地模型观测与阈值重标定：
     - 新增 `emotionModelUsedCount/continuityModelUsedCount/fallbackCount` 统计；
     - 新增 `deepGateCalibration` 快照（分位点 + 建议阈值 + delta），同步回写 `taskData.metadata` 与 `book.metadata.qualityCheck`。
  4. `POST /api/books/[id]/qc/run` 新增 `deepGateModelRuntime`（兼容 `modelRuntime`）任务级覆盖入口，支持灰度任务注入模型运行参数。
- 关键文件：
  - `apps/web/src/lib/quality-check/deep-gate-model-runtime.ts`
  - `apps/web/src/lib/quality-check/deep-gate-model-inference.ts`
  - `apps/web/src/lib/quality-check/deep-gate-model-scoring.ts`
  - `apps/web/src/lib/quality-check/deep-gate-calibration.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/lib/quality-gate/evaluator.ts`
  - `apps/web/src/lib/quality-gate/types.ts`
  - `apps/web/src/app/api/books/[id]/qc/run/route.ts`
  - `apps/web/src/lib/__tests__/deep-gate-model-runtime.test.ts`
  - `apps/web/src/lib/__tests__/deep-gate-calibration.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-model-runtime.test.ts src/lib/__tests__/deep-gate-calibration.test.ts src/lib/__tests__/quality-gate.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web test:regression`
  - `pnpm --filter web lint`
- 结果：新增测试、回归测试、类型校验与 lint 全部通过；Deep Gate 已具备“模型优先 + 启发式回退 + 阈值校准”的生产化基础能力。
- 下一步建议：
  1. 执行 S26：在复核工作台补批量操作（批量通过/批量重生）与告警事件 `ack/resolve` 一体化处置。
  2. 为 S25 模型运行时补离线回放评估集（按 `issueType/source` 分桶），把 `deepGateCalibration.recommendation` 纳入阈值发布流程。
  3. 增加模型可用性监控（成功率/延迟/回退率），避免模型波动导致复核队列突增。

### [S26] 复核运营自动化（批量处置 + 告警处置 + 审计导出）（2026-03-06 11:21 CST）

- 完成内容：
  1. 人工复核批量处置后端落地：
     - 新增 `POST /api/books/[id]/review/items/batch-resolve`，支持 `itemIds + action(approve/reject/regenerate)`；
     - `manual-review-service` 新增批量解析与执行，`regenerate` 会创建 `AUDIO_GENERATION(batch)`，并统一写 `source=manual_review_batch` 元数据；
     - 新增失败兜底，批量重生入队失败时自动回写任务 `failed + queueError`。
  2. 批量重生链路自动回流：
     - `audio-generation-runner` 识别 `manual_review_batch` 上下文并在重生成功后自动创建后置 `QUALITY_CHECK(batch)`；
     - 失败或缺少音频引用场景自动回写 `manual_review_items(rejected)`，避免 `reprocessing` 悬挂；
     - `quality-check-runner` 新增 `source=manual_review_batch` 解析，支持按 `retryReviewItemIds` 精准回写且默认关闭二次派单。
  3. 复核工作台与运营看板增强：
     - 新增批量选择、批量通过、批量重生交互；
     - SLO 看板接入 `dispatch-events` 生命周期卡片，支持单页 `ack/resolve`；
     - 新增 `GET /api/books/[id]/review/items/export`，按筛选条件导出处置日志 CSV（含状态、分数、处置备注等）。
  4. 代码组织优化：
     - 复核动作逻辑拆分为 `useReviewWorkbenchActions`；
     - 队列列表拆分为 `ReviewQueueList`，保持页面模块可维护性并控制单文件复杂度。
- 关键文件：
  - `apps/web/src/lib/manual-review-service.ts`
  - `apps/web/src/app/api/books/[id]/review/items/batch-resolve/route.ts`
  - `apps/web/src/app/api/books/[id]/review/items/export/route.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/app/books/[id]/review/hooks/useReviewWorkbenchActions.ts`
  - `apps/web/src/app/books/[id]/review/components/ReviewQueueList.tsx`
  - `apps/web/src/app/books/[id]/review/components/ReviewSloPanel.tsx`
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`
  - `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：批量复核、告警事件处置与日志导出均已联通；新增测试、类型校验、lint 与回归测试全部通过。
- 下一步建议：
  1. 执行 S27：把 `deepGateCalibration.recommendation` 接入离线回放评估 + 配置中心发布闭环。
  2. 为 `manual_review_batch` 增补来源维度运营指标（成功率/回流时延/回退率），避免新链路成为观测盲区。
  3. 在复核页增加批量处置审计筛选（按 operator/time/action）与导出模板版本号，提升审计可追溯性。

### [S27] Deep Gate 阈值治理闭环 V1（evaluate/publish/rollback）（2026-03-06 12:52 CST）

- 完成内容：
  1. 新增阈值治理服务 `deep-gate-calibration-governance-service`，落地三段式闭环：
     - `evaluate`：支持样本评估（内联样本或最近质检结果回放），输出 baseline/candidate 误报率、漏报率、命中率对比；
     - `publish`：基于评估报告发布新阈值版本，写入审批人与发布说明；
     - `rollback`：支持按版本一键回滚，并生成新的回滚版本号。
  2. 新增 API：
     - `POST /api/books/[id]/qc/deep-gate/calibration/evaluate`
     - `POST /api/books/[id]/qc/deep-gate/calibration/publish`
     - `POST /api/books/[id]/qc/deep-gate/calibration/rollback`
  3. 治理数据落库策略：
     - 以 `book.metadata.qualityCheck.deepGateThresholdGovernance` 作为版本审计源（报告列表 + 发布/回滚版本链）；
     - 线上生效阈值同步写回 `book.metadata.qualityCheck.deepGateThresholdTemplate` 与 `deepGateThresholdRelease` 快照，保证后续 `qc/run` 可复现。
  4. 补充单测覆盖：
     - 新增 `apps/web/src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`，覆盖 payload 校验、评估、发布、回滚关键路径。
- 关键文件：
  - `apps/web/src/lib/deep-gate-calibration-governance-service.ts`
  - `apps/web/src/app/api/books/[id]/qc/deep-gate/calibration/evaluate/route.ts`
  - `apps/web/src/app/api/books/[id]/qc/deep-gate/calibration/publish/route.ts`
  - `apps/web/src/app/api/books/[id]/qc/deep-gate/calibration/rollback/route.ts`
  - `apps/web/src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：S27 阈值治理闭环 V1 已打通；评估报告、发布审批、回滚链路均可审计，新增测试与回归全部通过。
- 下一步建议：
  1. 执行 S28：上传成功后自动触发 `AUTO_PIPELINE`，补齐“上传即自动生成”主链路闭环。
  2. 在 S28 并行补“评估样本集规范化”能力（按 `issueType/source` 固定抽样规则），降低样本漂移风险。
  3. 执行 S29：将 `speaker_engine_variants/speaker_emotion_presets` 接入运行时路由，并把路由摘要沉淀到任务 metadata。

### [S28] 上传自动触发 Auto Pipeline + 主入口统一（2026-03-06 13:05 CST）

- 完成内容：
  1. 新增自动编排触发服务 `auto-pipeline-trigger-service`，统一承载任务创建、并发幂等、入队失败回滚与触发元数据沉淀。
  2. 重构 `POST /api/books/[id]/pipeline/auto`：
     - 切换为复用触发服务；
     - 重复触发场景返回运行中任务（`reused=true`）而非直接报错。
  3. 改造 `POST /api/books/[id]/upload`：
     - 默认自动触发 `AUTO_PIPELINE`；
     - 支持 `autoPipelineEnabled` 显式关闭与 `autoPipelineOptions` JSON 参数覆盖；
     - 自动触发失败不影响上传主流程，响应中回传 `autoPipeline.warning` 便于前端兜底提示。
  4. 扩展 `GET /api/books/[id]/pipeline/status`：
     - 新增 `latestUploadTriggerSource`；
     - 新增 `stageDurations.totalMs/byStage`，用于阶段耗时观测。
  5. 前端入口对齐：
     - 上传组件移除“上传后再手动 process”链路，改为上传后自动编排；
     - 书籍卡片“开始处理”按钮切换为触发 `/pipeline/auto`，并展示复用态提示。
  6. `completeAutoPipeline` 回写时保留已有 `book.metadata.autoPipeline` 字段，避免覆盖掉 `lastTrigger` 等触发信息。
- 关键文件：
  - `apps/web/src/lib/auto-pipeline-trigger-service.ts`
  - `apps/web/src/app/api/books/[id]/upload/route.ts`
  - `apps/web/src/app/api/books/[id]/pipeline/auto/route.ts`
  - `apps/web/src/app/api/books/[id]/pipeline/status/route.ts`
  - `apps/web/src/lib/auto-pipeline/task-stage-utils.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/components/BookCard.tsx`
  - `apps/web/src/components/BookUpload.tsx`
  - `apps/web/src/lib/__tests__/auto-pipeline-trigger-service.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-trigger-service.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：S28 主链路闭环完成；上传后默认自动建链，上传/手工触发共享同一建链逻辑，阶段耗时与 upload 来源可观测。
- 五轮回顾节奏：当前累计到第 18 轮；下一次阶段性总结回顾节点为第 20 轮（计划在 S30 完成后执行）。

### [S29] Engine Router v1 运行时接入（2026-03-06 14:08 CST）

- 完成内容：
  1. 新增 `audio-engine-router`，在音频生成阶段按 `roleType/emotionLabel/priority/engineHint/engineHealth` 对候选引擎评分，并输出可审计路由决策。
  2. `audio-generator` 接入路由运行时与自动降级：
     - 候选来源统一纳入 `speaker_engine_variants`、角色声线绑定与旁白兜底；
     - 单句生成支持“同任务内候选降级重试”，并记录候选命中、降级深度与规则。
  3. `synthesis_attempts` 落库增强：
     - 成功/失败路径均写入 `speakerProfileId/speakerEngineVariantId`；
     - `requestPayload/appliedParams/metrics` 新增 `routerDecision/routerSelection/routerFallbackDepth` 诊断字段。
  4. `audio-generation-runner` 任务回写增强：
     - 在 `taskData.metadata` 新增 `routerDecisionSummary`（按 engine/source/policyVersion 聚合）；
     - 补充结果级 `selectedEngine/selectedSource` 摘要，便于重放排障。
  5. API 扩展：
     - `POST /api/books/[id]/audio/generate` 支持 `routerPolicyVersion` 和 `routerDebug`（兼容 `enableRouterDebug`）；
     - 新增 `GET /api/books/[id]/audio/router/metrics`，输出路由命中率、降级率、失败率与规则 TopN。
  6. 队列重放/幂等对齐：
     - `task-queue/dedupe` 纳入 `routerPolicyVersion`；
     - `task-replay-payload` 支持回放透传 `routerPolicyVersion/enableRouterDebug`。
- 关键文件：
  - `apps/web/src/lib/audio-engine-router.ts`
  - `apps/web/src/lib/audio-generator.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
  - `apps/web/src/lib/audio-router-metrics-service.ts`
  - `apps/web/src/app/api/books/[id]/audio/generate/route.ts`
  - `apps/web/src/app/api/books/[id]/audio/router/metrics/route.ts`
  - `apps/web/src/lib/task-queue/dedupe.ts`
  - `apps/web/src/lib/task-queue/replay-payload.ts`
  - `apps/web/src/lib/__tests__/audio-engine-router.test.ts`
  - `apps/web/src/lib/__tests__/audio-router-metrics-service.test.ts`
  - `apps/web/src/lib/__tests__/task-replay-payload-audio.test.ts`
  - `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-engine-router.test.ts src/lib/__tests__/audio-router-metrics-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/task-replay-payload-audio.test.ts src/lib/__tests__/auto-pipeline-trigger-service.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：S29 已完成，Engine Router 已进入音频主链路，具备策略透传、自动降级与指标观测能力。
- 五轮回顾节奏：当前累计到第 19 轮；下一次阶段性总结回顾节点为第 20 轮（计划在 S30 完成后执行）。
- 下一步建议：
  1. 执行 S30：补 Q0-Q3 指标化（CER/声纹优先），把返工策略从启发式升级到指标优先。
  2. 并行推进 S27.1：固化评估样本集并落地 `QUALITY_CHECK(source=calibration_eval)` 任务化回放。
  3. 执行 S28.1：补上传触发补偿任务化，收敛“上传成功但自动触发失败”的漏触发窗口。

### [S30] Q0-Q3 指标化升级（CER/声纹优先）（2026-03-06 15:27 CST）

- 完成内容：
  1. 新增 `q0q3-runtime` 模块，统一实现：
     - `signalSources` 解析（默认/书籍 metadata/任务覆盖）；
     - `q0q3Thresholds` 模板解析（默认/书籍 metadata/任务覆盖）；
     - `attempt.metrics + task signalPayload` 信号抽取（CER/声纹/削波/静音/LUFS）；
     - Q0-Q3 评分与 `issueType(primarySignal)` 归因（`CER/SPEAKER/AUDIO/FAST_GATE`）。
  2. `quality-check-runner` 主链路升级：
     - `evaluateFastGate` 切换到 Q0-Q3 运行时评分；
     - `quality_check_results` 升级为 `stage=Q0_Q5`、`thresholdKey=fast_deep_gate_v3`；
     - 落库 `q0Score/q2Cer/q3SpeakerSimilarity/signalSources`，并在 `manual_review_items.issueDetail` 沉淀 `primarySignal/signalValues`。
  3. 观测与 API 扩展：
     - `POST /api/books/[id]/qc/run` 支持 `signalSources/q0q3Thresholds`；
     - `GET /api/books/[id]/qc/run` 新增 `latestQ0Q3Summary/latestSignalSourceSummary`；
     - `qc-dispatch-metrics-service` 新增 `signalBreakdown(cer/speaker)` 聚合，并同步前端类型。
  4. 兼容回放链路：
     - `deep-gate-calibration-governance` 样本加载兼容 `stage in (Q1_Q5, Q0_Q5)`，避免历史数据中断。
- 关键文件：
  - `apps/web/src/lib/quality-check/q0q3-runtime.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/lib/quality-gate/types.ts`
  - `apps/web/src/lib/quality-gate/evaluator.ts`
  - `apps/web/src/app/api/books/[id]/qc/run/route.ts`
  - `apps/web/src/lib/qc-dispatch-metrics-service.ts`
  - `apps/web/src/app/books/[id]/review/models/types.ts`
  - `apps/web/src/lib/deep-gate-calibration-governance/service.ts`
  - `apps/web/src/lib/__tests__/q0q3-runtime.test.ts`
  - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `apps/web/src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
  - `apps/web/src/lib/__tests__/qc-dispatch-alert-service.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/q0q3-runtime.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts src/lib/__tests__/qc-dispatch-alert-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：S30 已完成，Fast Gate 已具备 Q0-Q3 指标化能力并支持 CER/声纹信号优先，返工链路可追溯到具体信号来源和原始值。
- 五轮回顾节奏：当前累计到第 20 轮；已完成一次阶段性总结回顾（S26-S30），结论为“方向与原始需求一致，剩余工作聚焦任务化补偿与 SLO 产品化”。
- 下一步建议：
  1. 执行 S27.1：固化评估样本集并落地 `QUALITY_CHECK(source=calibration_eval)` 任务化回放。
  2. 执行 S28.1：补上传触发失败补偿任务，闭合漏触发窗口。
  3. 执行 S31：落地 `FINAL_ASSEMBLY/MANUAL_REVIEW_SYNC` 任务类型，完成交付阶段可重放闭环。

## 4. 风险与备注（2026-03-06 15:27 CST）

1. S29 已完成运行时接入，但当前 engine health 仍基于近 24h 合成尝试统计，尚未接入独立健康探针与外部可用性信号。
2. S30 已打通 Q0-Q3 指标化判定，但 CER/声纹原始信号仍依赖上游 `attempt.metrics` 或任务 payload 注入，尚未接入独立 ASR/embedding 生产任务。
3. S27.1 已补齐“评估样本集标准化 + `QUALITY_CHECK(source=calibration_eval)` 任务化回放”，当前阈值治理链路已具备固定样本回放能力。
4. S28.1 已补齐上传触发失败补偿任务，上传成功但触发失败的场景已具备自动收敛能力。
5. 告警扫描虽已支持 API 入口，但默认仍依赖外部调度触发，需要补运营侧定时任务编排。

## 5. 总体回顾与目标 gap（2026-03-06 15:27 CST）

### 5.1 总体目标回顾（对齐 `full-automation-plan`）

1. 实现“上传即自动生成”的端到端自动链路（文本处理 -> 角色抽取 -> 台本标注 -> 合成 -> 质检 -> 复核 -> 交付）。
2. 建立可持续优化的数据与流程底座（多引擎策略、返工闭环、可观测性与告警）。
3. 在质量与成本上可运营（SLO、阈值、灰度、告警联动）。

### 5.2 当前现状（S0-S30 完成后，按目标重新评估）

| 里程碑 | 当前状态 | 现状说明 |
| --- | --- | --- |
| M1（Annotation v2 + Auto Pipeline） | 🟢 完成度较高 | 上传链路已默认自动触发 `AUTO_PIPELINE`，手工触发/上传触发已统一；补偿重试也已任务化，剩余灰度控制可后续补强。 |
| M2（Fast Gate + 自动返工闭环） | 🟡 部分完成 | `qc/retry`、二次派单、Engine Router v1 与 Q0-Q3 指标化已具备；但 CER/声纹原始信号生产仍待任务化接入。 |
| M3（Deep Gate + 人工复核工作台） | 🟡 部分完成 | Q4/Q5、复核 UI、批量处置与阈值治理 API 已上线；评估样本集与任务化回放已补齐，剩余交付任务语义与 SLO 产品化收口。 |
| M4（SLO + 告警运营 + 配置中心） | 🟡 部分完成 | dispatch 侧看板与事件处置已上线；核心 SLO 指标体系与告警尚未完整产品化。 |

### 5.3 目标 gap 列表（聚焦）

1. `G1`：已关闭，上传触发失败后的补偿重试已任务化，漏触发可被自动收敛与观测。
2. `G2`：Q0-Q3 虽已指标化，但 CER/声纹信号仍未形成独立生产任务（ASR/embedding）与 SLA 保障。
3. `G3`：已关闭，固定评估样本集与 `QUALITY_CHECK(source=calibration_eval)` 任务化回放已落地。
4. `G4`：计划中 `MANUAL_REVIEW_SYNC/FINAL_ASSEMBLY` 任务类型尚未落地为独立可重放任务。
5. `G5`：核心 SLO（`pipeline_success_rate` 等）尚未形成统一指标 API + 告警闭环。

### 5.4 剩余任务目标与优先级（重排）

| 优先级 | 任务编号 | 目标 | 建议落地项 | 验收标准 | 前置依赖 |
| --- | --- | --- | --- | --- | --- |
| P1 | S30.1 | CER/声纹信号生产任务化 | 接入 ASR/CER 与 speaker embedding 任务化产线并回写 `attempt.metrics` | Q0-Q3 指标来源稳定、可监控、可追溯 | S30 |
| P2 | S31 | 编排任务语义补齐 | 落地 `FINAL_ASSEMBLY`（及必要的复核同步任务） | 合并交付阶段可独立重放与审计 | S28-S30 |
| P2 | S32 | 核心 SLO 指标产品化 | 输出 `pipeline_success_rate` 等核心指标 API 与阈值告警 | 支持按计划执行运营验收 | S30/S31 |

### 5.5 推荐执行顺序（下一轮）

1. **S30.1（P1）**：把 ASR/CER + 声纹 embedding 变成稳定信号生产任务，补齐 Q0-Q3 供给侧。
2. **S30.1（P1）**：补 ASR/CER + 声纹 embedding 的稳定信号产线，把 Q0-Q3 指标从“可消费”推进到“稳定供给”。
3. **S31 + S32（P2）**：收口交付任务语义与 SLO 运营验收。

### 5.6 本次仓库复核验证结果（2026-03-06 15:27 CST）

1. `pnpm --filter web test -- --runInBand src/lib/__tests__/q0q3-runtime.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts src/lib/__tests__/qc-dispatch-alert-service.test.ts`：通过。
2. `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`：通过。
3. `pnpm --filter web typecheck`：通过。
4. `pnpm --filter web lint`：通过。
5. `pnpm --filter web test:regression`：通过。

### 5.7 本次文档同步说明

1. 已同步追加 S30 实施日志、验收结果与关键文件索引。
2. 已将优先级从 “S30 主线” 切换为 “S30.1 信号生产补齐 + S31/S32 交付运营收口”。
3. 已同步更新 handoff 文档，确保接手人可直接按新优先级执行。

### 5.8 S27-S32 实施卡（可执行拆分）

1. 详细实施卡文档：`docs/epic/2026-03-05-autobook-v2/2026-03-06-autobook-v2-s27-s32-execution-cards.md`。
2. 覆盖范围：S27-S32 全部包含输入、输出、API/任务改造点、验收标准、主要风险与缓解策略。
3. 执行要求：
   - 开发前先核对“输入是否齐备”（样本集、配置、任务元数据等）；
   - 评审时必须逐项核对验收标准，不以“代码完成”替代“目标达成”；
   - 任务若发生范围变更，先更新实施卡与 handoff，再进入编码。

### 5.9 第 20 轮阶段回顾（S26-S30）

1. 进度确认：S26（复核运营自动化）-> S27（阈值治理）-> S28（上传自动触发）-> S29（Engine Router）-> S30（Q0-Q3 指标化）五轮已按计划闭环完成。
2. 方向一致性：与 `full-automation-plan` 原始目标保持一致（自动链路、质量闭环、可运营），没有出现偏离主需求的旁支开发。
3. 差距定位：当前主要差距已收敛到“信号稳定供给（S30.1）+ 交付/SLO 收口（S31/S32）”。
4. 下一轮策略：先补“可回放 + 可收敛”基础设施，再推进 `FINAL_ASSEMBLY` 与核心 SLO 产品化，避免先做展示层而底层不稳。


### [S27.1] 固化评估样本集 + `calibration_eval` 任务化回放（2026-03-06 17:08 CST）

- 完成内容：
  1. 扩展 `deep-gate-calibration-governance`：新增 `sampleSets`、`report.sampleSetId/replayTaskId/replayTaskStatus`，让阈值评估、样本集和回放任务形成可追溯闭环。
  2. `evaluateDeepGateCalibrationForBook` 默认会从历史 `quality_check_results` 固化评估样本集，并自动创建 `QUALITY_CHECK(batch)` 回放任务，元数据标记 `source=calibration_eval`。
  3. `quality-check-runner` 新增 `calibration_eval` 干跑模式：回放结果写入 `quality_check_results.detail.calibrationLabel` 与任务摘要，但不会回写 `audio_files`、不会创建/更新 `manual_review_items`、不会写 `chapter_quality_audits`、不会覆盖书籍主质检摘要。
  4. `task-queue/worker-state` 失败路径识别 `calibration_eval`，失败时不再降级书籍状态，并把治理报告回写为 `replayTaskStatus=failed`。
- 关键文件：
  - `apps/web/src/lib/deep-gate-calibration-governance/types.ts`
  - `apps/web/src/lib/deep-gate-calibration-governance/parsers.ts`
  - `apps/web/src/lib/deep-gate-calibration-governance/service.ts`
  - `apps/web/src/lib/deep-gate-calibration-governance-service.ts`
  - `apps/web/src/lib/quality-check-runner.ts`
  - `apps/web/src/lib/task-queue/worker-state.ts`
- 新增/更新测试：
  - `apps/web/src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增单测、类型校验、lint 与回归测试全部通过；S27.1 已收敛，`G3` 关闭。
- 下一步建议：
  1. 执行 `S28.1`：上传自动触发失败补偿任务化，继续补“可收敛”底线能力。
  2. 执行 `S30.1`：把 ASR/CER + speaker embedding 改成稳定供给任务，解决 Q0-Q3 信号 SLA 问题。
  3. 执行 `S31`：落地 `FINAL_ASSEMBLY/MANUAL_REVIEW_SYNC`，收口交付阶段可重放闭环。


### [S28.1] 上传触发失败补偿任务化（2026-03-06 20:12 CST）

- 完成内容：
  1. 新增 `AUTO_PIPELINE_COMPENSATION` 任务，上传接口在 `startAutoPipelineTask` 失败后会自动创建补偿任务，而不是仅返回 warning。
  2. 补偿任务复用 `auto-pipeline` 队列，新增 `mode=trigger_compensation` 执行语义与指数退避重试策略；成功后会重新触发或复用真实 `AUTO_PIPELINE`。
  3. `task-replay/retry/watchdog recovery` 全链路补齐 `AUTO_PIPELINE_COMPENSATION` 支持，补偿任务具备可重放、可恢复、可观测属性。
  4. 新增 `book.metadata.autoPipeline.compensation` 状态回写（`scheduled/processing/completed/failed` + `linkedTaskId`），并在上传接口响应中回传 `compensationTaskId/compensationScheduled`。
  5. 失败路径隔离：补偿任务失败时只更新补偿状态，不再把书籍主状态降级为错误状态。
- 关键文件：
  - `apps/web/src/lib/auto-pipeline-trigger-service.ts`
  - `apps/web/src/lib/auto-pipeline-compensation-runner.ts`
  - `apps/web/src/lib/auto-pipeline-trigger-metadata.ts`
  - `apps/web/src/app/api/books/[id]/upload/route.ts`
  - `apps/web/src/app/api/books/[id]/pipeline/auto/route.ts`
  - `apps/web/src/lib/task-queue/ops/auto-pipeline-enqueue.ts`
  - `apps/web/src/lib/task-queue/ops/worker.ts`
  - `apps/web/src/lib/task-queue/worker-state.ts`
  - `apps/web/src/lib/task-queue/replay-payload.ts`
  - `apps/web/src/lib/task-queue/ops/recovery.ts`
- 新增/更新测试：
  - `apps/web/src/lib/__tests__/auto-pipeline-trigger-service.test.ts`
  - `apps/web/src/lib/__tests__/auto-pipeline-compensation-runner.test.ts`
  - `apps/web/src/lib/__tests__/task-replay-payload-auto.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-trigger-service.test.ts src/lib/__tests__/auto-pipeline-compensation-runner.test.ts src/lib/__tests__/task-replay-payload-auto.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增单测、类型校验、lint 与回归测试全部通过；S28.1 已收敛，`G1` 关闭。
- 下一步建议：
  1. 执行 `S30.1`：把 ASR/CER + speaker embedding 任务化，补齐 Q0-Q3 信号供给侧。
  2. 执行 `S31`：落地 `FINAL_ASSEMBLY/MANUAL_REVIEW_SYNC`，收口交付阶段语义与可重放能力。
  3. 执行 `S32`：输出统一 SLO 指标 API 与阈值告警闭环。


### [P1] 测试就绪与下一阶段执行规划文档化（2026-03-06 20:25 CST）

- 完成内容：
  1. 新增独立规划文档 `docs/epic/2026-03-06-autobook-v2-next-phase/2026-03-06-autobook-v2-test-readiness-and-next-phase-plan.md`，把“当前是否适合测试、怎么测、先测什么、后做什么”落成可执行计划。
  2. 规划文档明确把 `uploads/sample.txt` 设为统一测试素材，覆盖上传主链路、补偿演练、`calibration_eval` 隔离验证与 S30.1 基线建立。
  3. 规划文档明确下一阶段顺序：先链路验收，再推进 `S30.1 -> S31 -> S32`，避免继续叠功能而不做收敛验证。
  4. 同步更新 epic 索引，确保接手人可以从 `README` 直接进入新规划文档。
- 关键文件：
  - `docs/epic/2026-03-06-autobook-v2-next-phase/2026-03-06-autobook-v2-test-readiness-and-next-phase-plan.md`
  - `docs/epic/2026-03-05-autobook-v2/README.md`
- 下一步建议：
  1. 按规划文档的 `Phase A/B/C` 先做上传、补偿、回放隔离验收。
  2. 验收完成后再进入 `S30.1`，并用 `uploads/sample.txt` 固化前后基线对比。
  3. 若测试中暴露链路缺口，先回写本文档与 handoff，再决定是否继续推功能。


### [P2] 规划文档目录拆分（2026-03-06 20:35 CST）

- 完成内容：
  1. 按要求将测试就绪与下一阶段规划从原 epic 目录中迁出，独立放入 `docs/epic/2026-03-06-autobook-v2-next-phase/`。
  2. 新增独立目录索引 `docs/epic/2026-03-06-autobook-v2-next-phase/README.md`，避免新规划继续与原实施文档混放。
  3. 同步修正原 epic `README`、task、handoff 中的全部引用路径，保持交接入口一致。
- 关键文件：
  - `docs/epic/2026-03-06-autobook-v2-next-phase/2026-03-06-autobook-v2-test-readiness-and-next-phase-plan.md`
  - `docs/epic/2026-03-06-autobook-v2-next-phase/README.md`
  - `docs/epic/2026-03-05-autobook-v2/README.md`
- 下一步建议：
  1. 按独立规划文档开始执行 `Phase A/B/C` 测试验收。
  2. 验收完成后再推进 `S30.1`。


### [P3] Phase A/B 自动化验收入口落地（2026-03-06 20:43 CST）

- 完成内容：
  1. 新增 `upload-route.test.ts`，直接使用 `uploads/sample.txt` 作为测试素材，覆盖上传成功自动触发与触发失败后创建补偿任务两条主路径。
  2. 新增 `pipeline-status-route.test.ts`，覆盖 `GET /api/books/[id]/pipeline/status` 的阶段状态与 `latestUploadTriggerSource=upload_api` 观测回显。
  3. 本轮把新规划中的 `Phase A/B` 先落成“代码可执行的自动化验收入口”，为后续手工链路验收和故障演练提供稳定基线。
- 关键文件：
  - `apps/web/src/lib/__tests__/upload-route.test.ts`
  - `apps/web/src/lib/__tests__/pipeline-status-route.test.ts`
  - `uploads/sample.txt`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/upload-route.test.ts src/lib/__tests__/pipeline-status-route.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增测试、类型校验、lint 与回归测试全部通过；Phase A/B 已具备自动化验收入口。
- 下一步建议：
  1. 继续执行规划中的 `Phase C`：对 `calibration_eval` 做真实链路隔离验收。
  2. 完成 `Phase C` 后，用 `uploads/sample.txt` 固化 `S30.1` 的前置对照基线。
  3. 若 `Phase C` 无阻塞，再进入 `S30.1` 实施。

### 5.10 第 25 轮阶段回顾（S27.1-S28.1 + 规划执行启动）

1. 进度确认：本轮已完成新规划的第一段执行，`Phase A/B` 已从“纸面计划”推进到“可运行自动化验收”。
2. 方向一致性：当前开发方向仍与原始需求保持一致，仍然围绕“上传即自动生成、质量闭环、可运营”三条主线推进，没有偏离主目标。
3. 收敛判断：`G1/G3` 已关闭，当前主要缺口进一步收敛到 `Phase C` 验收与 `S30.1/S31/S32` 三项主线工作。
4. 下一轮策略：先完成 `Phase C` 和 `S30.1` 基线固化，再进入信号生产任务化，避免边接外部信号边补验收。


### [P4] Phase C 自动化隔离验收落地（2026-03-07 11:12 CST）

- 完成内容：
  1. 补强 `quality-check-runner-reprocessing.test.ts` 中的 `calibration_eval` 用例，新增对 `quality_check_results.detail.calibrationLabel` 与 `detail.source=calibration_eval` 的断言，确保回放结果确实被打上校准标签。
  2. 新增 `task-queue-worker-state.test.ts`，覆盖 `calibration_eval` 失败路径：确认失败时会回写 `deepGateThresholdGovernance.report.replayTaskStatus=failed`，且不会把书籍状态降级为 `completed_with_errors`。
  3. 本轮把规划中的 `Phase C` 从“已有实现”推进到“可重复自动化验收”，覆盖成功回放隔离与失败隔离两侧场景。
- 关键文件：
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `apps/web/src/lib/__tests__/task-queue-worker-state.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/task-queue-worker-state.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增测试、类型校验、lint 与回归测试全部通过；`Phase C` 已具备自动化隔离验收能力。
- 下一步建议：
  1. 执行 `Phase D`：使用 `uploads/sample.txt` 固化 `S30.1` 前置对照基线。
  2. 随后进入 `S30.1`，把 ASR/CER + speaker embedding 任务化。
  3. 若 `Phase D` 数据口径稳定，再推进 `S31`。


### [P5] Phase D 基线采集服务落地（2026-03-07 14:05 CST）

- 完成内容：
  1. 新增 `qc-baseline-service`，从最新已完成且非 `calibration_eval` 的 `QUALITY_CHECK` 任务中提取当前质量摘要，形成可固化的基线快照。
  2. 新增 `GET/POST /api/books/[id]/qc/baseline`：
     - `GET` 返回当前可用于对照的实时摘要与历史基线；
     - `POST` 固化一份基线快照到 `book.metadata.qualityCheck.baselineSnapshots`，默认 `sampleSourcePath=uploads/sample.txt`。
  3. 基线快照包含 `pass/repair/manualReview/hardFail`、`issueTypeCounts`、`q0q3Summary`、`signalSourceSummary`、`pendingReviewCount` 与计数摘要，可直接作为 `S30.1` 前后对照基线。
  4. 新增服务测试与路由测试，确认会跳过 `calibration_eval` 任务、能正确固化默认测试书路径，并能通过 API 读写基线。
- 关键文件：
  - `apps/web/src/lib/qc-baseline-service.ts`
  - `apps/web/src/app/api/books/[id]/qc/baseline/route.ts`
  - `apps/web/src/lib/__tests__/qc-baseline-service.test.ts`
  - `apps/web/src/lib/__tests__/qc-baseline-route.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-baseline-service.test.ts src/lib/__tests__/qc-baseline-route.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增测试、类型校验、lint 与回归测试全部通过；`Phase D` 已具备可复用的基线采集入口。
- 下一步建议：
  1. 基于 `uploads/sample.txt` 调用 `POST /api/books/[id]/qc/baseline` 固化当前基线。
  2. 进入 `S30.1`，开始 ASR/CER + speaker embedding 任务化。
  3. 进入 `S30.1` 后，每完成一个子阶段，用同一书籍重新抓一版基线做前后对照。


### [S30.1-A] 信号生产任务化 V1（2026-03-07 19:44 CST）

- 完成内容：
  1. 新增 `QUALITY_SIGNAL_SYNC` 任务类型与 `quality-signal-sync-runner`，支持按 `book/chapter/batch` 扫描已完成音频并回写最新 `synthesis_attempts.metrics`。
  2. 信号生产任务会产出并回写：
     - `cer/asrCer/q2Cer`
     - `speakerSimilarity/speakerEmbeddingSimilarity/q3SpeakerSimilarity`
     - `signalSync.version/syncedAt/taskId/cerSource/speakerSource`
  3. 新增 `POST/GET /api/books/[id]/qc/signals/sync`，支持手动发起信号生产、查看最近一次生产任务摘要。
  4. `task-replay/retry/watchdog recovery` 全链路已支持 `QUALITY_SIGNAL_SYNC`，并补齐任务标签、health、dedupe、队列 worker 与失败隔离。
  5. 当前 V1 以 `task_payload + heuristic fallback` 作为稳定供给方案，先把“任务化供给链”跑通；真实外部 ASR / speaker embedding provider 将作为后续收口项继续接入。
- 关键文件：
  - `apps/web/src/lib/quality-signal-sync-runner.ts`
  - `apps/web/src/app/api/books/[id]/qc/signals/sync/route.ts`
  - `apps/web/src/lib/task-queue/core/constants.ts`
  - `apps/web/src/lib/task-queue/core/runtime.ts`
  - `apps/web/src/lib/task-queue/core/types.ts`
  - `apps/web/src/lib/task-queue/ops/enqueue.ts`
  - `apps/web/src/lib/task-queue/ops/worker.ts`
  - `apps/web/src/lib/task-queue/replay-payload.ts`
- 新增/更新测试：
  - `apps/web/src/lib/__tests__/quality-signal-sync-runner.test.ts`
  - `apps/web/src/lib/__tests__/qc-signal-sync-route.test.ts`
  - `apps/web/src/lib/__tests__/task-replay-payload-signal-sync.test.ts`
- 执行命令：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-signal-sync-runner.test.ts src/lib/__tests__/qc-signal-sync-route.test.ts src/lib/__tests__/task-replay-payload-signal-sync.test.ts`
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web test:regression`
- 结果：新增测试、类型校验、lint 与回归测试全部通过；`S30.1` 已进入“任务化供给链可用”阶段。
- 下一步建议：
  1. 执行 `S30.1-B`：把 `QUALITY_SIGNAL_SYNC` 挂到 `AUTO_PIPELINE`/`qc/run` 前置链路，形成默认供给闭环。
  2. 执行 `S30.1-C`：接入真实 ASR/CER 与 speaker embedding provider，逐步替换纯启发式 fallback。
  3. `S30.1` 收口后再推进 `S31`。
