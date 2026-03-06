# AutoBook V2 Handoff（2026-03-06）

## 当前状态

- 分支基线：`main`
- 任务文档：`docs/epic/2026-03-05-autobook-v2/2026-03-05-autobook-v2-implementation-task.md`
- 当前进度：S0-S30 + S27.1 + S28.1 功能实施已完成；已补齐上传触发补偿任务化，待推进 S30.1/S31/S32。

## 总体目标回顾与现状判断（2026-03-06 15:27 CST）

### 总体目标（来自 `full-automation-plan`）

1. 上传后自动跑完整链路并可追踪进度。
2. 质量闭环可收敛（自动返工 + 人工复核 + 章节一致性）。
3. 生产可运营（指标、告警、阈值、灰度与配置中心）。

### 现状判断（按里程碑）

| 里程碑 | 当前状态 | 现状说明 |
| --- | --- | --- |
| M1（Annotation v2 + Auto Pipeline） | 🟢 完成度较高 | 上传链路已默认自动触发 `AUTO_PIPELINE`，且上传/手工触发共享同一建链逻辑；上传触发失败补偿也已任务化。 |
| M2（Fast Gate + 自动返工闭环） | 🟡 部分完成 | 自动返工闭环、Engine Router v1、Q0-Q3 指标化已具备；CER/声纹原始信号生产仍待任务化接入。 |
| M3（Deep Gate + 人工复核工作台） | 🟡 部分完成 | Deep Gate、复核 UI、批量处置与阈值治理 API 已落地；样本集标准化与任务化回放已补齐，剩余交付任务语义与 SLO 产品化收口。 |
| M4（SLO + 告警运营 + 配置中心） | 🟡 部分完成 | dispatch 维度观测可用；核心 SLO 指标体系与告警仍需补齐。 |

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

### 14) 第十三轮增量（S23：Deep Gate + 章节审计）

- Deep Gate 接入与融合判定：
  - 新增 `quality-gate` 模块（`types/thresholds/evaluator`），支持 Q4（情绪匹配）/Q5（章节一致性）评分；
  - `runQualityCheckTask` 升级为 Fast + Deep 融合判定，`quality_check_results` 落库 `Q1_Q5` 指标、融合分数、阈值快照与 issueType。
- 阈值模板能力：
  - 支持从 `book.metadata.qualityCheck.deepGateThresholdTemplate` 读取书籍默认阈值；
  - `POST /api/books/[id]/qc/run` 支持 `deepGateThresholdTemplate`（兼容 `thresholdTemplate`）任务级覆盖。
- 章节审计落地：
  - 质检任务结束后按章写入 `chapter_quality_audits`（`auditBatchId=taskId`）；
  - 审计记录包含 `overallScore/verdict/continuityMetric/speakerDrift/actions`，可直接支撑章节验收和返工决策。
- 误报观测与回流增强：
  - 新增 `deepGateOverrideCount/falsePositiveCandidateCount` 指标并回写 `taskData`/`book.metadata.qualityCheck`；
  - `reprocessing` 同步支持 `retryReviewItemIds` 精准回写，issueType 扩展到 `EMOTION/CONTINUITY`。
- 文案与入口同步：
  - 自动后置质检文案从 “Fast Gate” 升级为 “Fast/Deep Gate”；
  - `qc/run` 创建任务 metadata 增补阈值模板上下文，便于回放排障。

### 15) 第十四轮增量（S24：人工复核工作台 + SLO 看板）

- 新增 `books/[id]/review` 复核工作台 UI：
  - 支持 `status/issueType/priority` 筛选、分页与刷新；
  - 支持句级文本查看、最近音频试听；
  - 支持单条 `approve/reject/regenerate` 处置并自动刷新队列。
- SLO 看板整合：
  - 接入 `pipeline/status` 的质量摘要（pass/retry/false-positive）；
  - 接入 `dispatch-metrics` / `dispatch-alerts` 指标与告警；
  - 支持窗口天数与来源过滤，提供 issueType 维度拆分视图。
- 入口联动：
  - `BookNavigation` 新增“质检复核”页签；
  - 书籍概览页新增“质检复核”快捷按钮。
- 代码组织：
  - 新页面按 `components/hooks/models` 分层，避免页面层堆叠请求逻辑；
  - 单文件控制在 400 行内，便于后续演进批量复核能力。

### 16) 第十五轮增量（S25：Deep Gate 模型运行时 + 阈值重标定）

- 模型运行时接入：
  - 新增 `deep-gate-model-runtime`，支持情绪模型与一致性模型双路调用；
  - 新增 `deep-gate-model-inference` + `deep-gate-model-scoring`，把模型请求、响应解析与评分映射解耦；
  - 运行时配置支持三层来源：环境变量 -> `book.metadata.qualityCheck.deepGateModelRuntime` -> 任务级 `deepGateModelRuntime/modelRuntime` 覆盖；
  - 模型请求失败自动回退启发式评分，不阻塞质检主链路。
- 判定融合升级：
  - `evaluateDeepGate` 支持接收模型推理分数并落库来源标记（`q4Source/q5Source`）；
  - 质检明细新增 `deepGate.modelDiagnostics`，可追踪模型不可用/低置信度等原因。
- 阈值重标定快照：
  - 新增 `deep-gate-calibration`，按样本分位点产出 `deepGateCalibration`（建议阈值 + delta）；
  - `quality-check-runner` 汇总 `emotionModelUsedCount/continuityModelUsedCount/fallbackCount`，并回写 `taskData.metadata` 与 `book.metadata.qualityCheck`。
- API 扩展：
  - `POST /api/books/[id]/qc/run` 支持 `deepGateModelRuntime`（兼容 `modelRuntime`）任务级传参，支持灰度任务切换模型配置。

### 17) 第十六轮增量（S26：复核运营自动化）

- 批量复核后端能力：
  - 新增 `POST /api/books/[id]/review/items/batch-resolve`，支持批量 `approve/reject/regenerate`。
  - `manual-review-service` 新增批量解析、批量状态回写与批量重生任务派发。
  - 批量重生统一写入 `source=manual_review_batch`，并保留 `selectedReviewItemIds` 追踪上下文。
- 批量重生链路闭环：
  - `audio-generation-runner` 新增 `manual_review_batch` 上下文识别，支持成功后自动触发后置 `QUALITY_CHECK(batch)`。
  - 重生失败、无音频引用、后置质检入队失败场景，自动回写复核项到 `rejected`，避免 `reprocessing` 悬挂。
  - `quality-check-runner` 新增 `source=manual_review_batch` 解析与精准回写，默认关闭二次派单。
- 复核工作台增强：
  - 列表新增“全选当前页 + 批量通过 + 批量重生”。
  - SLO 看板新增告警事件生命周期卡片，支持单页 `ack/resolve` 处置。
  - 新增 `GET /api/books/[id]/review/items/export`，按当前筛选条件导出处置日志 CSV。
- 代码组织：
  - 新增 `useReviewWorkbenchActions`，拆分复核动作和告警事件操作逻辑；
  - 队列组件拆分为 `ReviewQueuePanel + ReviewQueueList`，保持模块职责清晰与文件规模可控。

### 18) 第十七轮增量（S27：Deep Gate 阈值治理闭环 V1）

- 新增阈值治理服务与三段式 API：
  - `POST /api/books/[id]/qc/deep-gate/calibration/evaluate`
  - `POST /api/books/[id]/qc/deep-gate/calibration/publish`
  - `POST /api/books/[id]/qc/deep-gate/calibration/rollback`
- 治理能力落地：
  - `evaluate` 支持内联样本或最近质检结果回放，输出 baseline/candidate 对比报告（误报/漏报/命中率）；
  - `publish` 支持按报告发布阈值版本，要求携带 reviewer 信息并保留审批说明；
  - `rollback` 支持指定版本回滚，自动生成新的回滚版本号并保留回滚指针。
- 审计与生效快照：
  - 报告与版本链写入 `book.metadata.qualityCheck.deepGateThresholdGovernance`；
  - 当前生效阈值写回 `book.metadata.qualityCheck.deepGateThresholdTemplate` 与 `deepGateThresholdRelease`，后续 `qc/run` 可直接复现。
- 测试覆盖：
  - 新增 `apps/web/src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`（校验 evaluate/publish/rollback 关键路径与 payload 约束）。

### 19) 第十八轮增量（S28：上传自动触发 + 主入口统一）

- 自动编排触发服务统一：
  - 新增 `auto-pipeline-trigger-service`，统一处理任务创建、并发幂等、入队失败回滚与触发元数据沉淀；
  - `POST /api/books/[id]/pipeline/auto` 改为复用同一服务，重复触发返回 `reused=true` 而不是并发创建新任务。
- 上传链路默认自动触发：
  - `POST /api/books/[id]/upload` 默认自动触发 `AUTO_PIPELINE`；
  - 支持 `autoPipelineEnabled` 显式关闭与 `autoPipelineOptions` JSON 参数覆盖；
  - 自动触发失败不阻断上传主流程，响应新增 `autoPipeline.warning` 便于前端提示和补偿。
- 状态观测增强：
  - `GET /api/books/[id]/pipeline/status` 新增 `latestUploadTriggerSource`；
  - 新增 `stageDurations.totalMs/byStage`，直接回传各阶段耗时统计。
- 前端入口对齐：
  - `BookUpload` 移除“上传后手动 process”逻辑，改为上传后自动编排；
  - `BookCard` 的“开始处理”按钮改为触发 `/pipeline/auto`，并展示复用态提示。
- 元数据保留：
  - `completeAutoPipeline` 回写时保留 `book.metadata.autoPipeline` 既有字段，避免覆盖 `lastTrigger` 触发信息。
- 里程碑节奏：
  - 当前累计执行到第 18 轮；按“每 5 轮回顾”约定，下一次阶段总结应在第 20 轮（预计 S30）完成后执行。

### 20) 第十九轮增量（S29：Engine Router v1 运行时接入）

- 路由运行时接入：
  - 新增 `audio-engine-router`，按 `roleType/emotionLabel/priority/engineHint/engineHealth` 对候选进行评分并输出可审计决策。
  - 候选来源统一纳入 `speaker_engine_variants`、角色声线绑定与旁白兜底，支持同句候选降级重试。
- 落库诊断增强：
  - `synthesis_attempts` 成功/失败链路补写 `speakerProfileId/speakerEngineVariantId`。
  - `requestPayload/appliedParams/metrics` 新增 `routerDecision/routerSelection/routerFallbackDepth` 诊断字段。
- 任务元数据增强：
  - `audio-generation-runner` 在任务 `taskData.metadata` 写入 `routerDecisionSummary`（按 engine/source/policyVersion 聚合）。
  - 结果级摘要补 `selectedEngine/selectedSource`，用于重放排障与运营观测。
- API 与队列透传：
  - `POST /api/books/[id]/audio/generate` 支持 `routerPolicyVersion` 与 `routerDebug`（兼容 `enableRouterDebug`）。
  - 新增 `GET /api/books/[id]/audio/router/metrics`，返回路由命中率、降级率、失败率与规则 TopN。
  - `task-queue/dedupe` 纳入 `routerPolicyVersion`；`task-replay-payload` 补路由参数回放透传。
- 里程碑节奏：
  - 当前累计执行到第 19 轮；按“每 5 轮回顾”约定，下一次阶段总结应在第 20 轮（预计 S30）完成后执行。

### 21) 第二十轮增量（S30：Q0-Q3 指标化升级）

- Q0-Q3 运行时落地：
  - 新增 `q0q3-runtime`，统一实现信号源解析（默认/书籍/任务级）、阈值模板解析、CER/声纹/音频信号提取与评分融合；
  - Fast Gate 从纯启发式升级为“指标优先 + 启发式兜底”，新增 issueType 归因：`CER/SPEAKER/AUDIO/FAST_GATE`。
- 质检链路升级：
  - `quality-check-runner` 写入 `stage=Q0_Q5` 与 `thresholdKey=fast_deep_gate_v3`；
  - `quality_check_results.metrics/detail` 与 `manual_review_items.issueDetail` 增补 `q0Score/q2Cer/q3SpeakerSimilarity/primarySignal/signalSources/signalValues`。
- API 与观测扩展：
  - `POST /api/books/[id]/qc/run` 支持 `signalSources/q0q3Thresholds`；
  - `GET /api/books/[id]/qc/run` 返回 `latestQ0Q3Summary/latestSignalSourceSummary`；
  - `GET /api/books/[id]/qc/dispatch-metrics` 新增 `signalBreakdown(cer/speaker)` 聚合。
- 兼容性处理：
  - `deep-gate-calibration-governance` 样本加载兼容 `stage in (Q1_Q5, Q0_Q5)`，保证历史数据可继续评估。
- 里程碑节奏：
  - 当前累计执行到第 20 轮，已按“每 5 轮回顾”约定完成一次阶段回顾（S26-S30），结论为“进度与原始需求保持一致，优先补任务化收敛能力”。

## 待完成内容

3. S30 已完成 Q0-Q3 指标化判定，但 CER/声纹原始信号生产仍依赖上游注入，需补 ASR/embedding 任务化供给（S30.1）。
4. 计划中的 `MANUAL_REVIEW_SYNC/FINAL_ASSEMBLY` 任务类型尚未落地为独立可重放任务（S31）。
5. 核心 SLO 指标（`pipeline_success_rate` 等）尚未形成统一 API + 告警闭环（S32）。

## 剩余任务优先级（建议，S30.1-S32）

| 优先级 | 任务编号 | 目标 | 建议落地项 | 验收标准 | 前置依赖 |
| --- | --- | --- | --- | --- | --- |
| P1 | S30.1 | CER/声纹信号生产任务化 | 接入 ASR/CER 与 speaker embedding 任务并稳定回写 `attempt.metrics` | Q0-Q3 指标来源稳定、可观测、可追溯 | S30 |
| P2 | S31 | 编排任务语义补齐 | 落地 `FINAL_ASSEMBLY`（及必要复核同步任务） | 交付阶段可独立重放/审计 | S28-S30 |
| P2 | S32 | 核心 SLO 指标产品化 | 输出核心指标 API、看板和阈值告警 | 支持按计划执行运营验收 | S30/S31 |

## 执行卡片索引（S27-S32）

1. 详细执行卡：`docs/epic/2026-03-05-autobook-v2/2026-03-06-autobook-v2-s27-s32-execution-cards.md`。
2. 接手执行顺序：S30.1 -> S31 -> S32。
3. 交接要求：每完成一项任务，必须同步更新实施卡中的“API 变更”和“验收结果”。

## 测试与验证结果

- 新增与更新测试：
  - `apps/web/src/lib/__tests__/script-annotation-v2.test.ts`（新增）
  - `apps/web/src/lib/__tests__/script-sentence-contract.test.ts`（更新）
  - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`（新增）
  - `apps/web/src/lib/__tests__/task-replay-payload-quality.test.ts`（新增）
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`（新增，S26 补批量复核覆盖）
  - `apps/web/src/lib/__tests__/audio-generation-runner-manual-review.test.ts`（新增，S26 补 `manual_review_batch` 覆盖）
  - `apps/web/src/lib/__tests__/qc-retry-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-policy-config-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`（新增，S26 补 `manual_review_batch` 回写覆盖）
  - `apps/web/src/lib/__tests__/qc-dispatch-metrics-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-alert-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/qc-dispatch-alert-event-service.test.ts`（新增）
  - `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`（新增）
  - `apps/web/src/lib/__tests__/task-replay-payload-auto.test.ts`（新增）
  - `apps/web/src/lib/__tests__/quality-gate.test.ts`（新增）
  - `apps/web/src/lib/__tests__/deep-gate-model-runtime.test.ts`（新增）
  - `apps/web/src/lib/__tests__/deep-gate-calibration.test.ts`（新增）
  - `apps/web/src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`（新增，S27 阈值治理闭环）
  - `apps/web/src/lib/__tests__/auto-pipeline-trigger-service.test.ts`（新增，S28 上传/手工触发统一服务）
  - `apps/web/src/lib/__tests__/audio-engine-router.test.ts`（新增，S29 路由评分与降级）
  - `apps/web/src/lib/__tests__/audio-router-metrics-service.test.ts`（新增，S29 路由指标聚合）
  - `apps/web/src/lib/__tests__/task-replay-payload-audio.test.ts`（新增，S29 音频任务回放参数透传）
  - `apps/web/src/lib/__tests__/q0q3-runtime.test.ts`（新增，S30 Q0-Q3 信号解析与评分）
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
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-gate.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/qc-retry-service.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-model-runtime.test.ts src/lib/__tests__/deep-gate-calibration.test.ts src/lib/__tests__/quality-gate.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`（S26）
  - `pnpm --filter web lint`（S24 UI）
  - `pnpm --filter web typecheck`（S24 UI）
  - `pnpm --filter web test:regression`（S24 UI）
  - `pnpm --filter web lint`（S25）
  - `pnpm --filter web typecheck`（S25）
  - `pnpm --filter web test:regression`（S25）
  - `pnpm --filter web lint`（S26）
  - `pnpm --filter web typecheck`（S26）
  - `pnpm --filter web test:regression`（S26）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`（2026-03-06 复核）
  - `pnpm --filter web typecheck`（2026-03-06 复核）
  - `pnpm --filter web lint`（2026-03-06 复核）
  - `pnpm --filter web test:regression`（2026-03-06 复核）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`（S27）
  - `pnpm --filter web typecheck`（S27）
  - `pnpm --filter web lint`（S27）
  - `pnpm --filter web test:regression`（S27）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-trigger-service.test.ts`（S28）
  - `pnpm --filter web typecheck`（S28）
  - `pnpm --filter web lint`（S28）
  - `pnpm --filter web test:regression`（S28）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-engine-router.test.ts src/lib/__tests__/audio-router-metrics-service.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/task-replay-payload-audio.test.ts src/lib/__tests__/auto-pipeline-trigger-service.test.ts`（S29）
  - `pnpm --filter web typecheck`（S29）
  - `pnpm --filter web lint`（S29）
  - `pnpm --filter web test:regression`（S29）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/q0q3-runtime.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/qc-dispatch-metrics-service.test.ts src/lib/__tests__/qc-dispatch-alert-service.test.ts`（S30）
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts`（S30 兼容回放校验）
  - `pnpm --filter web typecheck`（S30）
  - `pnpm --filter web lint`（S30）
  - `pnpm --filter web test:regression`（S30）
- 结果：全部通过。

## 下一步建议（接手即做）

1. 先做 **S30.1（P1）**：把 ASR/CER + speaker embedding 变成稳定信号生产任务，补齐 Q0-Q3 的供给侧。
2. 再做 **S30.1（P1）**：接入 ASR/CER + 声纹 embedding 稳定供给链路，解决 Q0-Q3 信号来源 SLA 问题。
3. 收尾执行 **S31 + S32（P2）**：补 `FINAL_ASSEMBLY` 任务化与核心 SLO 指标产品化，完成运营验收。


### 22) 第二十一轮增量（S27.1：评估样本集 + 任务化回放）

- 阈值治理样本集固化：
  - `deep-gate-calibration-governance` 新增 `sampleSets` 元数据结构，保存 `audioFileIds/qualityResultIds/samples/latestReplayTaskId`；
  - 评估报告新增 `sampleSetId/replayTaskId/replayTaskStatus`，后续回放与发布都可追溯到固定样本集。
- 评估入口升级：
  - `POST /api/books/[id]/qc/deep-gate/calibration/evaluate` 现支持 `sampleSetId/createReplayTask/replayDryRun`；
  - 默认会从历史 `quality_check_results` 固化样本集，并自动创建 `QUALITY_CHECK(batch, source=calibration_eval)` 回放任务。
- `QUALITY_CHECK(calibration_eval)` 干跑隔离：
  - `quality-check-runner` 会为回放结果写入 `calibrationLabel`，但不会回写 `audio_files`、不会创建/更新 `manual_review_items`、不会写 `chapter_quality_audits`、不会覆盖书籍主 `qualityCheck` 摘要；
  - 仅保留任务摘要与 `quality_check_results` 审计痕迹，避免离线评估污染生产状态。
- 失败路径补齐：
  - `task-queue/worker-state` 识别 `source=calibration_eval`，失败时不再把书籍状态降级到 `completed_with_errors`；
  - 同时会回写治理元数据中的 `replayTaskStatus=failed`，避免报告长期停留在 `queued`。
- 验证结果：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/deep-gate-calibration-governance-service.test.ts src/lib/__tests__/quality-check-runner-reprocessing.test.ts`：通过；
  - `pnpm --filter web typecheck`、`pnpm --filter web lint`、`pnpm --filter web test:regression`：通过。
- 下一步建议：
  1. 执行 `S28.1`：上传触发失败补偿任务化，补齐 Auto Pipeline 漏触发收敛链路；
  2. 执行 `S30.1`：把 ASR/CER 与 speaker embedding 变成稳定信号生产任务，而不是依赖上游注入；
  3. 执行 `S31`：落地 `FINAL_ASSEMBLY`/必要的复核同步任务，收口交付阶段的可重放语义。


### 23) 第二十二轮增量（S28.1：上传触发补偿任务化）

- 上传失败补偿任务化：
  - 新增 `AUTO_PIPELINE_COMPENSATION` 任务语义，专门承载“上传成功但自动触发失败”的补偿重试；
  - 上传接口在直接触发失败后会自动创建补偿任务，而不再只返回 warning。
- 自动收敛链路：
  - 补偿任务复用 `auto-pipeline` 队列，支持指数退避重试；
  - worker 会执行 `runAutoPipelineCompensationTask`，成功时重新触发或复用真实 `AUTO_PIPELINE`，失败时仅回写补偿状态，不污染书籍主状态。
- 观测与 replay/recovery：
  - `task-replay/retry/watchdog recovery` 已支持 `AUTO_PIPELINE_COMPENSATION`；
  - 书籍 `metadata.autoPipeline.compensation` 会保存 `scheduled/processing/completed/failed` 与 `linkedTaskId`，便于追踪漏触发收敛情况。
- API 回显增强：
  - `POST /api/books/[id]/upload` 响应新增 `compensationTaskId/compensationScheduled`，调用方可直接感知是否进入补偿链路。
- 验证结果：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/auto-pipeline-trigger-service.test.ts src/lib/__tests__/auto-pipeline-compensation-runner.test.ts src/lib/__tests__/task-replay-payload-auto.test.ts`：通过；
  - `pnpm --filter web typecheck`、`pnpm --filter web lint`、`pnpm --filter web test:regression`：通过。
- 下一步建议：
  1. 执行 `S30.1`：把 CER/声纹从“消费现成信号”升级为“稳定生产信号”；
  2. 执行 `S31`：落地 `FINAL_ASSEMBLY`/必要复核同步任务，打通交付阶段语义；
  3. 执行 `S32`：产品化核心 SLO 指标与阈值告警闭环。


### 24) 第二十三轮增量（测试就绪与下一阶段规划）

- 新增独立规划文档：
  - `docs/epic/2026-03-06-autobook-v2-next-phase/2026-03-06-autobook-v2-test-readiness-and-next-phase-plan.md`
  - 覆盖“是否适合开始测试、测试顺序、测试素材、S30.1/S31/S32 建议节奏”。
- 测试素材统一：
  - 规划文档指定 `uploads/sample.txt` 为第一批统一测试书；
  - 该样本将用于上传主链路验收、上传补偿故障演练、`calibration_eval` 隔离验证以及 S30.1 前后对照基线。
- 下一阶段顺序更新：
  - 先做链路验收（Phase A/B/C），确认“上传 -> 自动触发 -> 补偿 -> 回放隔离”真实可用；
  - 再推进 `S30.1 -> S31 -> S32`，避免继续叠功能而不做收敛验证。
- 文档索引同步：
  - `README` 已追加新规划文档入口，接手人可直接进入执行。


### 25) 第二十四轮增量（规划文档目录拆分）

- 文档结构调整：
  - 测试就绪与下一阶段规划已从原 epic 目录迁出，独立放入 `docs/epic/2026-03-06-autobook-v2-next-phase/`；
  - 新增目录索引 `README.md`，避免新规划继续和原实施文档混放。
- 引用修正：
  - 原 epic 的 `README`、task、handoff 均已切换到新路径，接手人仍可从原主线文档跳转到新规划。
- 下一步建议：
  1. 直接按新目录中的规划文档执行 `Phase A/B/C`；
  2. 待链路验收通过后推进 `S30.1`。
