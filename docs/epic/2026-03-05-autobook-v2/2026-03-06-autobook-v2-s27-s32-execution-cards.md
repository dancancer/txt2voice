# AutoBook V2 S27-S32 实施卡（2026-03-06）

## 目标

将 S27-S32 拆分为可执行工作卡，统一给出每项任务的输入、输出、API 改造点、验收标准与主要风险，降低交接和执行偏差。

## S27（P0）Deep Gate 阈值发布治理闭环

### 输入

1. `quality-check-runner` 输出的 `deepGateCalibration` 建议快照（按 `bookId/issueType/source` 分桶）。
2. 离线评估样本集（包含人工标注基线，覆盖 `EMOTION/CONTINUITY`）。
3. 现有策略中心配置与审计表（`qc_dispatch_policy_configs/revisions`）。

### 输出

1. 可审计阈值版本（含 `version/author/reviewer/发布说明/回滚指针`）。
2. 发布前后离线评估报告（误报率、漏报率、回退率、样本规模）。
3. 线上生效阈值快照回写（供 `qc/run` 与任务重放复现）。

### API 与任务改造

1. 新增 `POST /api/books/[id]/qc/deep-gate/calibration/evaluate`：触发离线评估并产出报告。
2. 新增 `POST /api/books/[id]/qc/deep-gate/calibration/publish`：基于评估结果发布阈值版本。
3. 新增 `POST /api/books/[id]/qc/deep-gate/calibration/rollback`：一键回滚到指定版本。
4. 复用 `QUALITY_CHECK` 任务执行离线回放（通过 metadata 区分 `source=calibration_eval`），避免新增任务类型。

### 验收标准

1. 任意阈值发布都能追溯到唯一评估报告和审批记录。
2. 支持按版本回滚，并在 1 次操作内恢复旧阈值配置。
3. 发布后 7 天内 `EMOTION/CONTINUITY` 误报率与回退率趋势可观测且可对比。

### 主要风险与缓解

1. 样本集偏差导致阈值失真 -> 固定抽样规则，要求覆盖章节、角色、来源分布。
2. 模型波动导致评估不可复现 -> 评估任务固化模型版本、参数与 prompt hash。
3. 发布误操作 -> 强制双人审批 + 回滚演练。

## S28（P1）上传自动触发 Auto Pipeline + 主入口统一

### 输入

1. 上传完成事件（`POST /api/books/[id]/upload`）。
2. 自动编排默认参数（`book.metadata` + 请求覆盖）。
3. 任务去重规则（防止重复创建 `AUTO_PIPELINE`）。

### 输出

1. 上传成功后自动创建 `AUTO_PIPELINE` 主任务（返回 `taskId`）。
2. 书籍页统一展示自动流程入口与阶段进度（状态与任务一致）。
3. 上传链路与手工触发链路行为一致（参数、状态、日志口径统一）。

### API 与任务改造

1. 改造 `POST /api/books/[id]/upload`：默认自动触发 `AUTO_PIPELINE`，支持显式关闭。
2. 复用 `POST /api/books/[id]/pipeline/auto` 作为唯一建链路入口，上传接口仅做编排触发。
3. 扩展 `GET /api/books/[id]/pipeline/status`：回传最近一次 upload 触发来源与阶段耗时。

### 验收标准

1. 上传成功后 3 秒内可查询到进行中的 `AUTO_PIPELINE` 任务。
2. 重复上传或重复点击不会产生并行冲突任务（满足幂等）。
3. 主入口交互可直接定位阶段失败原因并支持重放。

### 主要风险与缓解

1. 上传与触发并发竞态 -> 上传事务提交后再触发任务，失败则补偿重试。
2. 历史手动流程兼容问题 -> 增加 feature flag，逐书灰度切换。
3. 用户误触重复执行 -> 前端入口加任务执行态锁与后端幂等键。

## S29（P1）Engine Router v1 运行时接入

### 输入

1. Annotation v2 字段（`roleType/emotionLabel/priority/engineHint`）。
2. 引擎能力与变体配置（`speaker_engine_variants/speaker_emotion_presets`）。
3. 引擎健康信息（超时率、最近错误率、fallback 可用性）。

### 输出

1. 每句引擎路由决策日志（命中规则、候选列表、降级路径）。
2. `synthesis_attempts` 新增路由诊断字段（便于排障和复盘）。
3. 失败时自动降级策略与回退统计（按引擎、角色、情绪维度）。

### API 与任务改造

1. 扩展 `POST /api/books/[id]/audio/generate`：支持 `routerPolicyVersion` 与调试回显开关。
2. 新增 `GET /api/books/[id]/audio/router/metrics`：查询路由命中率、降级率、失败率。
3. `audio-generation-runner` 在任务元数据回写 `routerDecisionSummary`，支持 replay 复现。

### 验收标准

1. 95% 以上音频任务可追溯到明确路由决策与命中规则。
2. 单引擎异常时自动降级成功率达到预设阈值且无批量阻塞。
3. 路由策略切换可灰度、可回滚、可观测。

### 主要风险与缓解

1. 路由规则膨胀 -> 采用优先级规则表，限制同层冲突规则数量。
2. 引擎健康探针不稳定 -> 降级采用滑动窗口，避免瞬时抖动放大。
3. 路由日志过大 -> 任务中仅保留摘要，详细日志按采样落盘。

## S30（P1）Q0-Q3 指标化升级（CER/声纹优先）

### 输入

1. 音频特征（时长、语速、响度等现有启发式信号）。
2. ASR 输出与 CER 计算结果（句级、章节级）。
3. 说话人 embedding 相似度（声纹一致性）。

### 输出

1. `quality_check_results` 持久化 Q0-Q3 结构化得分与来源。
2. `qc/retry` 策略改为“指标优先 + 启发式兜底”。
3. 质量趋势看板可按信号来源拆分（heuristic vs CER vs speaker embedding）。

### API 与任务改造

1. 扩展 `POST /api/books/[id]/qc/run`：支持 `signalSources`、`q0q3Thresholds` 参数。
2. 扩展 `GET /api/books/[id]/qc/run` 返回结构：增加 Q0-Q3 明细与信号来源统计。
3. 扩展 `GET /api/books/[id]/qc/dispatch-metrics`：新增 CER/声纹维度聚合。

### 验收标准

1. Q0-Q3 指标均可追溯到具体信号来源和原始值。
2. 返工命中率提升，误报/漏报相对基线有显著下降。
3. 指标缺失场景自动回退启发式，链路不中断。

### 主要风险与缓解

1. ASR 成本与时延上升 -> 先按章节采样与异步批处理灰度上线。
2. 声纹阈值跨角色偏移 -> 分角色类型维护阈值模板。
3. 外部模型不可用 -> 保留启发式兜底并监控 fallback rate。

## S31（P2）编排任务语义补齐（`MANUAL_REVIEW_SYNC/FINAL_ASSEMBLY`）

### 输入

1. `AUTO_PIPELINE` 阶段状态与复核项状态（pending/reprocessing/resolved）。
2. 现有合并导出能力（`/api/books/[id]/audio/merge`）。
3. 任务重放/恢复框架（enqueue/replay/retry/recovery）。

### 输出

1. 新增可重放任务类型：`MANUAL_REVIEW_SYNC`、`FINAL_ASSEMBLY`。
2. 交付阶段可独立追踪（创建、执行、失败、回滚、重放）。
3. 复核完成到交付合并形成可审计状态机。

### API 与任务改造

1. 扩展任务类型枚举、队列 worker、重试/重放/recovery 覆盖新任务类型。
2. `POST /api/books/[id]/audio/merge` 改为创建 `FINAL_ASSEMBLY` 任务并异步执行。
3. 新增 `POST /api/books/[id]/review/items/sync`：触发 `MANUAL_REVIEW_SYNC` 归集状态。

### 验收标准

1. 新任务类型在 `GET /api/tasks`、`retry/replay`、watchdog recovery 全部可用。
2. 交付失败可单独重放，不影响前序台本与音频任务。
3. 状态机中“复核完成 -> 最终合并 -> 可下载”路径清晰可审计。

### 主要风险与缓解

1. 任务状态复杂度上升 -> 保持任务职责单一，避免跨阶段隐式写状态。
2. 合并过程重放导致重复产物 -> 采用产物版本目录与幂等输出命名。
3. 与旧入口兼容成本 -> 提供兼容层，逐步将旧入口迁移为任务触发。

## S32（P2）核心 SLO 指标产品化

### 输入

1. `ProcessingTask`、`quality_check_results`、`manual_review_items`、dispatch 事件数据。
2. 计划定义的核心指标：`pipeline_success_rate/sentence_pass_rate_first_try/avg_retry_per_sentence/manual_review_ratio/chapter_consistency_fail_rate`。
3. 现有告警扫描基础能力与 Webhook 通知通道。

### 输出

1. 统一 SLO 指标 API（书籍维度 + 时间窗口 + 来源维度）。
2. 运营看板与阈值告警（含触发、ack、resolve、通知闭环）。
3. 每日/每周运营验收报表模板（用于迭代复盘）。

### API 与任务改造

1. 新增 `GET /api/books/[id]/slo/metrics`：输出核心 SLO 指标快照。
2. 新增 `POST /api/slo/alerts/scan`：执行核心 SLO 阈值扫描（支持 token）。
3. 扩展 `GET /api/books/[id]/qc/dispatch-events`：兼容核心 SLO 告警事件类型。

### 验收标准

1. 核心 SLO 指标口径固定且可回放复算，前后端展示一致。
2. 告警支持自动扫描、生命周期管理与通知触达。
3. 运营可按周输出“目标值 vs 实际值 vs 异常处置”闭环报告。

### 主要风险与缓解

1. 指标口径分裂 -> 建立单一指标定义模块并强制复用。
2. 扫描频率过高带来压力 -> 支持窗口缓存与增量扫描。
3. 告警噪声过大 -> 引入抖动抑制与多窗口确认策略。

## 执行顺序建议

1. S27（P0）先落地阈值治理闭环，稳定 Deep Gate 策略面。
2. S28 + S29（P1）并行推进，先修主链路自动化，再兑现引擎路由收益。
3. S30（P1）补质量信号可信度，再推进 S31/S32 的任务语义和运营产品化。
4. S31 + S32（P2）作为交付层与运营层收口，完成计划目标验收。
