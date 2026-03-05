# AutoBook V2 Handoff（2026-03-05）

## 当前状态

- 分支基线：`main`
- 任务文档：`docs/task/2026-03-05-autobook-v2-implementation-task.md`
- 当前进度：S0-S22 全部完成，已完成第十二轮（策略配置中心化）；待推进 S23-S24。

## 总体目标回顾与现状判断（2026-03-05 20:18 CST）

### 总体目标（来自 `full-automation-plan`）

1. 上传后自动跑完整链路并可追踪进度。
2. 质量闭环可收敛（自动返工 + 人工复核 + 章节一致性）。
3. 生产可运营（指标、告警、阈值、灰度与配置中心）。

### 现状判断（按里程碑）

| 里程碑 | 当前状态 | 现状说明 |
| --- | --- | --- |
| M1（Annotation v2 + Auto Pipeline） | ✅ 已完成 | Annotation v2 与 `AUTO_PIPELINE` 编排、状态 API、任务恢复链路已打通。 |
| M2（Fast Gate + 自动返工闭环） | ✅ 已完成（Fast Gate 范围） | Q1-Q3、`qc/retry`、二次派单策略、阈值拦截、观测指标与告警查询已具备。 |
| M3（Deep Gate + 人工复核工作台） | 🔄 部分完成 | 复核 API 已完成；Q4/Q5、`chapter_quality_audit` 执行链路、复核工作台 UI 仍未落地。 |
| M4（SLO + 告警运营 + 配置中心） | 🔄 部分完成 | 告警扫描、事件沉淀、Webhook 通知与 `dispatchPolicy` 配置中心已就绪；缺 SLO 看板与策略治理 UI。 |

## 已完成内容

### 1) 数据底座（Prisma）

- 完成 V2 6 张新表建模：
  - `speaker_engine_variants`
  - `speaker_emotion_presets`
  - `synthesis_attempts`
  - `quality_check_results`
  - `manual_review_items`
  - `chapter_quality_audits`
- 扩展既有字段：
  - `script_sentences`: `roleType/emotionLabel/emotionIntensity/engineHint/priority/prosody`
  - `audio_files`: `attemptNo/engineUsed/qualityScore/qualityVerdict/qualityStatus`
- 已完成 schema 格式校验：`prisma format`。

### 2) 服务层改造（最小双写）

- 台本生成存储：落库 Annotation v2 衍生字段。
- 段落处理：透传 role/emotion/engine/priority/prosody。
- 台词 API：支持新增字段创建/更新/格式化返回。
- 音频生成：完成 `audio_files + synthesis_attempts` 事务双写（成功路径）。

### 3) 第二轮增量（失败路径 + QC）

- 音频失败路径：
  - `generateSingleAudio` 在异常分支和声音配置缺失分支补写 `synthesis_attempts(status=failed)`。
  - `attemptNo` 改为基于 `synthesis_attempts` 统一递增，成功/失败共用同一计数源。
- Fast Gate worker：
  - 新增 `quality-check-runner`（Q1-Q3 启发式判定）。
  - 写入 `quality_check_results`（含 `verdict/score/reasons/detail.repairPlan`）。
  - 回写 `audio_files.qualityScore/qualityVerdict/qualityStatus`。
  - 低分或硬失败自动入 `manual_review_items`（去重 pending 项）。
- 队列接入：
  - 新增 `QUALITY_CHECK` 任务类型，覆盖 enqueue/worker/replay/recovery/health/dead-letter。
- API：
  - 新增 `POST/GET /api/books/[id]/qc/run`，支持整书/章节/批量音频触发与状态查询。
  - `/api/tasks/[taskId]/retry` 与 `/api/tasks/[taskId]/replay` 已支持 `QUALITY_CHECK`。

### 4) 第三轮增量（人工复核闭环第一版）

- 人工复核 API：
  - 新增 `GET /api/books/[id]/review/items`（分页 + 过滤 + summary 统计）。
  - 新增 `POST /api/books/[id]/review/items/[itemId]/resolve`（`approve/reject/regenerate`）。
- 复核服务层：
  - 新增 `manual-review-service`，统一封装 query 解析、resolve 动作、格式化输出。
  - `regenerate` 会创建 `AUDIO_GENERATION(single)` 任务并入队，复核项状态流转到 `reprocessing`。
- 风险兜底：
  - `regenerate` 入队失败时会把 retry task 标记为 `failed` 并写入 `queueError`。
  - 仅允许 `pending` 状态复核项被处理，避免重复提交导致状态冲突。

### 5) 第四轮增量（重生自动回流闭环）

- 重生强制覆盖：
  - `resolve(regenerate)` 入队参数改为 `skipExisting=false` + `overwriteExisting=true`，避免复用旧音频造成“重生未生效”。
- 音频任务联动：
  - `runAudioGenerationTask` 识别 `source=manual_review` 上下文。
  - 重生失败（全部失败）自动将复核项从 `reprocessing` 回写为 `rejected(regenerate_failed)`。
  - 重生成功后自动创建并入队 `QUALITY_CHECK(batch)` 任务，保留 `manualReviewFollowup` 追踪信息。
- 质检回写联动：
  - `runQualityCheckTask` 新增 `reprocessing` 自动回流：
    - `pass/repair -> resolved(auto_resolved)`
    - `manual_review/hard_fail -> rejected(auto_rejected)`
  - 同步更新 `qcResultId/audioFileId/attemptId`，并在 `resolutionNote` 追加自动回写标记。

### 6) 第五轮增量（`qc/retry` 批量返工）

- 新增批量返工 API：
  - 新增 `POST /api/books/[id]/qc/retry`，支持按 `issueType/chapterId/sentenceIds/minScore/maxScore/includeRejected/limit` 过滤返工对象。
- 新增返工服务层：
  - 新增 `qc-retry-service`，统一封装 payload 解析、候选筛选、任务创建、入队与失败回滚。
  - 返工任务统一创建 `AUDIO_GENERATION(batch)`，并强制 `skipExisting=false + overwriteExisting=true`。
  - 入队成功后将命中 `manual_review_items` 批量回写到 `reprocessing(batch_regenerate)`，并追加 `qc_retry_task:<taskId>` 标记。
- 失败兜底：
  - 入队失败时自动将返工任务标记为 `failed` 并写入 `queueError`，避免“任务卡 processing”。

### 7) 第六轮增量（`qc_retry` 自动复检 + 二次派单）

- `qc_retry` 后置质检自动联动：
  - `runAudioGenerationTask` 识别 `source=qc_retry` 任务上下文，并在返工成功后自动创建/入队 `QUALITY_CHECK(batch)`。
  - 后置质检任务 metadata 新增：
    - `source=qc_retry`
    - `retryReviewItemIds`
    - `autoCreatePendingOnReject=true`
  - 返工失败（全部失败）或“无有效音频引用”时，自动将目标 `manual_review_items` 从 `reprocessing` 回写为 `rejected`，避免状态悬挂。
  - 后置质检入队失败时，自动把该质检任务标记为 `failed`，并批量回写复核项为 `rejected(batch_regenerate_qc_enqueue_failed)`。
- `auto_rejected` 二次派单策略：
  - `runQualityCheckTask` 新增任务上下文策略解析（`autoCreatePendingOnReject`）。
  - `syncReprocessingManualReviewItems` 支持“先拒绝后派单”：
    - 对命中的 `reprocessing` 项回写 `rejected(auto_rejected)`；
    - 在无重复 `pending` 项时自动复制生成新的 `pending` 复核项，并打 `dispatch=secondary_pending` 追踪标记。
  - 质检任务汇总新增 `secondaryDispatchCount` 和 `source`，便于统计自动派单规模与来源。

### 8) 第七轮增量（`qc_retry` 策略配置化 + 失败阈值）

- `qc_retry` 策略配置化：
  - `qc-retry-service` 新增 `dispatchPolicy` 参数解析与校验，支持：
    - `autoCreatePendingOnReject`
    - `maxAutoRejectedCount`
    - `issueTypePolicies`
  - 策略合并顺序：默认值 -> `book.metadata.qcRetryPolicy`（兼容 `book.metadata.qualityCheck.qcRetryPolicy`）-> 请求级 `dispatchPolicy`。
  - 返工任务 `taskData.metadata` 新增策略快照，保证任务重放可复现。
- 策略透传联动：
  - `runAudioGenerationTask` 读取 `qc_retry` 任务策略并透传到后置 `QUALITY_CHECK(batch)` 任务 metadata。
  - 后置质检不再依赖“固定开启”逻辑，改为策略驱动。
- 阈值收敛：
  - `runQualityCheckTask` 在 `auto_rejected` 链路引入 `issueDetail.autoRejectedCount` 累计计数。
  - 当累计次数超过 `maxAutoRejectedCount` 时，不再创建二次 `pending` 项，并回写 `secondaryDispatch=threshold_blocked`。
  - 质检汇总新增 `secondaryDispatchSkippedByThresholdCount`，用于监控阈值拦截量。

### 9) 第八轮增量（自动派单观测指标）

- 新增指标服务与 API：
  - 新增 `qc-dispatch-metrics-service`，支持窗口聚合（默认 7 天，最大 90 天）。
  - 新增 `GET /api/books/[id]/qc/dispatch-metrics`，支持 `days/source/issueType` 过滤。
- 指标覆盖：
  - `autoRejectedEventCount`
  - `autoRejectedAccumulatedCount`
  - `thresholdBlockedCount`
  - `secondaryPendingCount`
  - `qualityTaskSummary.secondaryDispatchCount`
  - `qualityTaskSummary.secondaryDispatchSkippedByThresholdCount`
- 数据透传补齐：
  - `runQualityCheckTask` 在 `auto_rejected` 回写时补写 `issueDetail.source`。
  - 二次 `secondary_pending` 复核项创建时同步写入 `issueDetail.source`，并在首次落入人工复核时补齐来源。

### 10) 第九轮增量（派单告警联动）

- 新增告警服务与 API：
  - 新增 `qc-dispatch-alert-service`，基于现有聚合指标输出三类告警：
    - `threshold_blocked_spike`（最近 24h 相对上一窗口突增）
    - `secondary_pending_backlog`
    - `auto_rejected_accumulated_pressure`
  - 新增 `GET /api/books/[id]/qc/dispatch-alerts`，支持 `days/source/issueType` 与阈值参数查询。
- 阈值参数化：
  - `thresholdBlockedSpikeDelta`
  - `thresholdBlockedGrowthRate`
  - `thresholdBlockedCurrentFloor`
  - `secondaryPendingLimit`
  - `autoRejectedAccumulatedLimit`
- 返回结构：
  - `alerts`（触发告警清单）
  - `snapshot`（窗口总览 + 24h 对比）
  - `thresholds`（生效阈值回显）

### 11) 第十轮增量（`AUTO_PIPELINE` 主链路自动编排）

- 新增自动编排执行器与阶段编排：
  - 新增 `auto-pipeline-runner`（拆分为 `common/task-stage-utils/runner`）；
  - 四阶段串行编排：`TEXT_PROCESSING -> SCRIPT_GENERATION -> AUDIO_GENERATION -> QUALITY_CHECK`；
  - `QUALITY_CHECK` 可按请求开关；
  - 主任务写入 `currentStage/stages/failedStage` 结构化元数据。
- 队列体系新增 `AUTO_PIPELINE` 全链路能力：
  - dedupe、enqueue、worker、health、replay payload、manual replay/retry、watchdog recovery、legacy namespace 检查；
  - 支持 `GET /api/tasks` 统一查询与 `taskType=AUTO_PIPELINE` 追踪。
- API 落地：
  - 新增 `POST /api/books/[id]/pipeline/auto`（触发自动编排）；
  - 新增 `GET /api/books/[id]/pipeline/status`（阶段进度、当前阶段、质检摘要、待复核数量）。
- 状态机扩展：
  - 新增书籍状态：`quality_checking`、`manual_review_pending`、`assembling_audio`；
  - 同步更新状态校验与展示映射（类型/验证/status meta/task label）。

### 12) 第十一轮增量（S21：告警运营闭环）

- Prisma 扩展：
  - 新增 `qc_dispatch_alert_events` 表，沉淀告警事件生命周期与快照（`open/acked/resolved`、`fingerprint`、`triggerCount`、`snapshot`）。
  - `Book` 增加 `qcDispatchAlerts` 反向关系。
- 服务层落地：
  - 新增 `qc-dispatch-alert-event-service`，支持：
    - 单书扫描沉淀（新建/重开/自动收敛）
    - 事件列表查询（status/source/issueType/alertCode 过滤）
    - 事件生命周期处理（ack/resolve）
    - 跨书籍批量扫描（定时任务入口）
  - 新增 `qc-dispatch-alert-notifier`，支持 Webhook 通知（`QC_DISPATCH_ALERT_WEBHOOK_URL` + timeout）。
- API 新增：
  - `POST /api/books/[id]/qc/dispatch-alerts/scan`
  - `GET /api/books/[id]/qc/dispatch-events`
  - `POST /api/books/[id]/qc/dispatch-events/[eventId]/resolve`
  - `POST /api/qc/dispatch-alerts/scan`（支持 `QC_DISPATCH_ALERT_SCAN_TOKEN`）
- 闭环能力：
  - 告警从“查询即算”升级为“扫描沉淀 + 生命周期管理 + 通知触达”。

### 13) 第十二轮增量（S22：`dispatchPolicy` 配置中心化）

- Prisma 扩展：
  - 新增 `qc_dispatch_policy_configs`（三级 scope 配置主表，含 `isActive/rolloutPercentage/version`）。
  - 新增 `qc_dispatch_policy_revisions`（create/update/rollback 审计快照）。
  - `Book` 新增 `tenantId/projectId` 与 `dispatchPolicyConfigs` 反向关系。
- 服务层落地：
  - 新增 `qc-dispatch-policy.ts`，统一策略契约解析/合并/序列化。
  - 新增 `qc-dispatch-policy-config-service`（拆分 parser/runtime/mutation）：
    - `tenant -> project -> book -> request override` 运行时合并；
    - `rolloutPercentage` 灰度命中；
    - `expectedVersion` 乐观版本校验；
    - 版本审计与指定版本回滚。
  - `qc-retry-service` 切换策略来源到配置中心，移除 `book.metadata.qcRetryPolicy` 主入口依赖。
  - 返工任务 metadata 增补 `dispatchPolicyScopes + dispatchPolicyContext`，便于回放与排障。
- API 新增：
  - `GET/PUT /api/books/[id]/qc/dispatch-policy`
  - `POST /api/books/[id]/qc/dispatch-policy/rollback`

## 待完成内容

1. Deep Gate（Q4/Q5）与 `chapter_quality_audit` 未接入，Fast Gate 仍是启发式规则。
2. 人工复核工作台暂无最小可用 UI（当前仅有 API 能力）。
3. SLO/运营看板仍缺前端入口与策略治理交互面板。

## 剩余任务优先级（建议，S23-S24）

| 优先级 | 任务编号 | 目标 | 建议落地项 | 验收标准 | 前置依赖 |
| --- | --- | --- | --- | --- | --- |
| P0 | S23 | Deep Gate 与章节审计 | Q4（情绪匹配）/Q5（章节一致性）+ `chapter_quality_audit` 执行链路 + 阈值模板 | 质检结果包含 Q4/Q5 指标；支持章节级验收与返工决策；误报率可观测 | S22（策略模板复用） |
| P1 | S24 | 人工复核与运营体验补齐 | 人工复核最小工作台（列表/试听/重生）+ SLO 看板整合 | 复核操作可视化；关键指标（backlog/pass/retry）可日常运营使用 | S22/S23 输出可直接复用 |

## 测试与验证结果

- 新增与更新测试：
  - `apps/web/src/lib/__tests__/script-annotation-v2.test.ts`（新增）
  - `apps/web/src/lib/__tests__/script-sentence-contract.test.ts`（更新）
  - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`（新增）
  - `apps/web/src/lib/__tests__/task-replay-payload-quality.test.ts`（新增）
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-retry-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-policy-config-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-metrics-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-alert-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-alert-event-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`（新增）
  - `apps/web/src/lib/__tests__/task-replay-payload-auto.test.ts`（新增）
- 已执行：
  - `pnpm --filter web exec prisma format --schema prisma/schema.prisma`
  - `pnpm --filter web exec prisma generate --schema prisma/schema.prisma`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-policy-config-service.test.ts src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-policy-config-service.test.ts src/lib/__tests__/qc-retry-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-alert-event-service.test.ts src/lib/__tests__/qc-dispatch-alert-service.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-runner.test.ts src/lib/__tests__/task-replay-payload-auto.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-alert-service.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-dispatch-metrics-service.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/qc-retry-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-retry-service.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/task-replay-payload-quality.test.ts`
  - `pnpm --filter web test:regression`
  - `pnpm --filter web typecheck`
- 结果：全部通过。

## 下一步建议（接手即做）

1. 先做 **S23（P0）**：Deep Gate（Q4/Q5 + 章节审计）能力上线，并复用 S22 的策略模板。
2. 随后做 **S24（P1）**：人工复核工作台与运营看板整合。
3. 同步补充 SLO 与策略治理前端入口，形成运营侧闭环。
