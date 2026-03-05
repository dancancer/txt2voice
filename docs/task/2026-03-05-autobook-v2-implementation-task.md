# AutoBook V2 实施任务单（2026-03-05）

> 任务来源：
> - `docs/plan/2026-03-05-autobook-v2-full-automation-plan.md`
> - `docs/plan/2026-03-05-autobook-v2-prisma-migration-draft.md`

## 1. 本轮目标（可提交增量）

S0-S4（第一批改造）已完成，本次继续推进第二批可落地增量：

1. 音频生成失败路径补齐 `synthesis_attempts(status=failed)` 写入。
2. 增加 `QUALITY_CHECK` 任务类型与 Fast Gate（Q1-Q3）Worker 骨架。
3. 打通质检任务入队与 API 触发（按整书/章节/批量音频）。
4. 补齐回归测试、更新 task/handoff，并提交本轮增量。

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

## 4. 风险与备注

1. 本轮未切换新读路径（仍保持旧查询兼容）。
2. Fast Gate 当前使用轻量启发式规则，未接入真实 ASR/CER 与声纹模型。
3. 已有 `manual_review_items` 自动写入，但尚未提供复核处理 API（resolve/驳回/重生）。
