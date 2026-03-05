# AutoBook V2 实施任务单（2026-03-05）

> 任务来源：
> - `docs/plan/2026-03-05-autobook-v2-full-automation-plan.md`
> - `docs/plan/2026-03-05-autobook-v2-prisma-migration-draft.md`

## 1. 本轮目标（可提交增量）

S0-S7（前两批改造）已完成，本次继续推进第三批可落地增量：

1. 新增人工复核队列读取 API（支持分页与状态过滤）。
2. 新增人工复核处理 API（通过/驳回/重生）。
3. 将“重生”动作接入 `AUDIO_GENERATION` 队列，形成可追踪返工入口。
4. 补齐测试、更新 task/handoff，并提交本轮增量。

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

## 4. 风险与备注

1. 本轮未切换新读路径（仍保持旧查询兼容）。
2. Fast Gate 当前使用轻量启发式规则，未接入真实 ASR/CER 与声纹模型。
3. 已具备复核列表与处理 API，但“重生后自动闭环（状态回流 + 二次质检联动）”仍未落地。
