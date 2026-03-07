# AutoBook V2 测试就绪与下一阶段执行规划（2026-03-06）

## 1. 目的

将当前“代码级验证已通过”的状态，推进到“链路级可验收、故障可收敛、下一阶段可安全继续开发”的状态，并明确 S30.1 / S31 / S32 的执行顺序、测试入口与验收标准。

## 2. 当前结论

### 2.1 是否适合开始测试

结论：**适合，现在就应该开始更高层级测试。**

原因：

1. 当前代码层验证已经覆盖到关键主链路：`typecheck`、`lint`、`test:regression`、S27.1/S28.1 相关单测均通过。
2. 当前剩余风险已经不主要在语法或局部逻辑，而在：
   - 上传触发后的链路收敛
   - 任务补偿/重放/恢复
   - 真实样本上的质量门控表现
   - 交付阶段语义与运营指标闭环
3. 如果继续叠加 S30.1 / S31 / S32 而不先做链路测试，后续问题定位成本会明显上升。

### 2.2 当前已具备的测试基础

1. `S27.1` 已完成：固定评估样本集 + `QUALITY_CHECK(source=calibration_eval)` 任务化回放。
2. `S28.1` 已完成：上传自动触发失败补偿任务化，新增 `AUTO_PIPELINE_COMPENSATION`。
3. `task-replay / retry / watchdog recovery` 已识别补偿任务，可用于故障演练。
4. 已有一份可重复使用的测试书：`uploads/sample.txt`。

## 3. 测试素材说明

### 3.1 推荐主测试素材

- 文件：`uploads/sample.txt`
- 用途：作为本轮链路测试、补偿测试、质量门控验证、回放隔离验证的统一样本。

### 3.2 该样本适合做什么

从文本结构看，`uploads/sample.txt` 具备以下测试价值：

1. 存在明确章节起点（适合验证章节识别与单章/全书处理）。
2. 同时包含旁白与对话（适合验证角色识别、台词生成、音频路由与质检 issueType 分布）。
3. 文本量中等（适合快速重复执行，不会造成过高测试成本）。
4. 有较多人物发言与叙述切换（适合观察 CER/声纹/情绪/连续性指标的后续演进）。

## 4. 本轮执行目标

本规划不直接扩大业务范围，而是围绕“当前已完成能力的验收 + 下一阶段开发入口”来安排工作：

1. 验收上传自动触发与补偿闭环是否真实可用。
2. 验收 `calibration_eval` 是否真正做到审计隔离、不会污染生产状态。
3. 为 `S30.1` 建立测试入口，避免信号生产任务落地后没有基准可对照。
4. 为 `S31/S32` 保留可插入的验收点，避免后续边开发边返工。

## 5. 执行顺序

### Phase A：上传主链路验收（立即执行）

目标：确认“上传即自动生成”在正常路径上可稳定运行。

#### 输入

- 测试书：`uploads/sample.txt`
- 当前上传接口：`POST /api/books/[id]/upload`
- 当前状态查询：`GET /api/books/[id]/pipeline/status`

#### 操作

1. 上传 `uploads/sample.txt`，默认开启 `autoPipelineEnabled=true`。
2. 观察是否立即创建 `AUTO_PIPELINE` 主任务。
3. 轮询 `pipeline/status`，确认阶段推进顺序为：
   - `text_processing`
   - `script_generation`
   - `audio_generation`
   - `quality_check`
4. 确认书籍状态与阶段状态一致。

#### 验收标准

1. 上传成功后可查询到进行中的 `AUTO_PIPELINE`。
2. `pipeline/status` 能看到当前阶段、阶段任务 ID、错误信息与耗时。
3. 无补偿任务产生时，`autoPipeline.compensation` 为空或不存在。

### Phase B：上传失败补偿演练（优先执行）

目标：确认 `S28.1` 不是“留 warning”，而是“真的会自动收敛”。

#### 输入

- 测试书：`uploads/sample.txt`
- 当前补偿任务：`AUTO_PIPELINE_COMPENSATION`

#### 操作

1. 在测试环境中人为制造自动触发失败：
   - 可通过临时让队列入队失败；
   - 或在 `startAutoPipelineTask` 入口注入错误；
   - 或模拟 `REDIS_URL` 不可达场景。
2. 再次上传 `uploads/sample.txt`。
3. 检查上传响应是否返回：
   - `autoPipeline.warning`
   - `autoPipeline.compensationTaskId`
   - `autoPipeline.compensationScheduled=true`
4. 检查补偿任务是否进入队列并自动重试。
5. 检查补偿成功后是否重新拉起或复用真实 `AUTO_PIPELINE`。

#### 验收标准

1. 上传接口不会因为自动触发失败而丢失后续收敛能力。
2. `AUTO_PIPELINE_COMPENSATION` 可被 replay / retry / watchdog recovery 识别。
3. 补偿失败时只更新补偿状态，不污染书籍主状态。
4. 书籍 `metadata.autoPipeline.compensation` 中可看到：
   - `scheduled`
   - `processing`
   - `completed` 或 `failed`
   - `linkedTaskId`

### Phase C：`calibration_eval` 隔离验证（建议紧接执行）

目标：确认 `S27.1` 回放审计不污染生产状态。

#### 输入

- 测试书：`uploads/sample.txt`
- Deep Gate 评估接口：`POST /api/books/[id]/qc/deep-gate/calibration/evaluate`

#### 操作

1. 基于当前书籍历史质检结果生成评估报告。
2. 触发自动创建 `QUALITY_CHECK(source=calibration_eval)` 回放任务。
3. 等待任务结束后检查以下对象：
   - `quality_check_results`
   - `audio_files`
   - `manual_review_items`
   - `chapter_quality_audits`
   - `book.metadata.qualityCheck`
   - `book.metadata.qualityCheck.deepGateThresholdGovernance`

#### 验收标准

1. `quality_check_results` 有新增审计记录，且 `detail.calibrationLabel` 存在。
2. `audio_files` 不因 `calibration_eval` 被覆盖。
3. `manual_review_items` 不因 `calibration_eval` 被新增或改写。
4. `chapter_quality_audits` 不因 `calibration_eval` 被新增。
5. `deepGateThresholdGovernance.report.replayTaskStatus` 会被正确回写。

### Phase D：S30.1 前置基线建立（建议本轮完成）

目标：在真正开发 `S30.1` 前，先建立对照基线，避免信号任务接入后无从比较。

#### 需要记录的基线

1. 以 `uploads/sample.txt` 跑一次当前全链路。
2. 保存当前：
   - `q0/q1/q2/q3` 平均分
   - `manualReviewCount`
   - `hardFailCount`
   - `issueTypeCounts`
   - `signalSourceSummary`
3. 记录当前 Q0-Q3 的信号缺失情况：
   - `q2Cer.availableCount`
   - `q3SpeakerSimilarity.availableCount`
4. 将这些结果作为 `S30.1` 前后对照基线。

#### 验收标准

1. 基线口径固定，可复算。
2. 后续 S30.1 接入 ASR/CER 与 speaker embedding 后，可直接对比“缺失率/命中率/误报率”。

## 6. 下一阶段开发规划

### 6.1 S30.1：CER / 声纹信号生产任务化

#### 目标

把 Q0-Q3 从“消费现成信号”推进为“平台稳定生产信号”。

#### 建议拆分

1. 新增 ASR/CER 生产任务或阶段，回写 `attempt.metrics.cer`。
2. 新增 speaker embedding / similarity 生产任务或阶段，回写 `attempt.metrics.speakerSimilarity`。
3. 在质检运行时保留“指标优先 + 启发式兜底”。
4. 观测信号缺失率与回退率，避免新任务接入后反而降低可用性。

#### 前置测试要求

1. 先完成本规划中的 Phase A-D。
2. 以 `uploads/sample.txt` 作为第一批对照样本。

### 6.2 S31：交付阶段任务语义补齐

#### 目标

把“最终合并/复核同步”从隐含动作升级为显式任务语义。

#### 建议落地项

1. 新增 `FINAL_ASSEMBLY` 任务。
2. 视实际需要新增 `MANUAL_REVIEW_SYNC`。
3. 让交付失败可重放、可恢复、可审计。

#### 为什么放在 S30.1 后面

因为当前最大的实际缺口是质量信号供给，不是交付任务语义；先补信号，再补交付，更符合“先解决真实问题”的原则。

### 6.3 S32：核心 SLO 指标产品化

#### 目标

让运营指标从“能算”升级为“能看、能告警、能复盘”。

#### 建议落地项

1. 新增统一 SLO 指标 API。
2. 对 `pipeline_success_rate / sentence_pass_rate_first_try / manual_review_ratio` 建立固定口径。
3. 增加阈值扫描、事件沉淀、告警生命周期处理。

## 7. 推荐本周执行节奏

### Day 1

1. 用 `uploads/sample.txt` 完成正常上传链路验收。
2. 完成补偿任务故障注入演练。
3. 固定一版当前基线数据。

### Day 2

1. 完成 `calibration_eval` 隔离验证。
2. 开始 `S30.1` 技术设计与数据流定义。

### Day 3-4

1. 实施 `S30.1`。
2. 使用 `uploads/sample.txt` 回归对比前后质量信号变化。

### Day 5

1. 判断是否进入 `S31`。
2. 若 `S30.1` 稳定，再继续交付任务语义收口。

## 8. 风险提醒

1. `uploads/sample.txt` 当前只是一份单书样本，适合做第一批验证，不适合替代多样本集。
2. 补偿任务当前与 `AUTO_PIPELINE` 共用队列，后续若补偿任务量显著增长，可能需要独立队列或限流策略。
3. `S30.1` 一旦接入外部 ASR / embedding 服务，新的主要风险会变成时延、成本与可用性抖动。
4. 当前阶段最忌讳的不是“少做一个功能”，而是“没做链路验收就继续叠功能”。

## 9. 本文档的使用方式

1. 先按 Phase A-C 做验收，不要跳过故障演练。
2. 再按 Phase D 固化基线，作为 S30.1 的对照样本。
3. S30.1 开发期间，每完成一个子阶段，都用 `uploads/sample.txt` 回归一次。
4. 若范围发生变化，先更新本文档，再继续开发。


## 10. 执行快照（2026-03-06 20:43 CST）

### 已完成

1. `Phase A/B` 已落成自动化验收入口：
   - `apps/web/src/lib/__tests__/upload-route.test.ts`
   - `apps/web/src/lib/__tests__/pipeline-status-route.test.ts`
2. 统一使用 `uploads/sample.txt` 作为测试书夹具。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/upload-route.test.ts src/lib/__tests__/pipeline-status-route.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。

### 待继续

1. 执行 `Phase C`：`calibration_eval` 隔离验收。
2. 执行 `Phase D`：固化 `S30.1` 前置对照基线。
3. 然后进入 `S30.1` 实施。


### Phase C 更新（2026-03-07 11:12 CST）

1. 已新增自动化测试覆盖 `calibration_eval` 成功回放打标与失败回写治理状态。
2. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/task-queue-worker-state.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
3. 结果：全部通过。
4. 结论：`Phase C` 已可视为自动化验收完成，下一步进入 `Phase D` 基线固化。


### Phase D 更新（2026-03-07 14:05 CST）

1. 已新增 `GET/POST /api/books/[id]/qc/baseline`，用于查询和固化 `S30.1` 前置基线。
2. 默认测试素材已绑定为 `uploads/sample.txt`。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/qc-baseline-service.test.ts src/lib/__tests__/qc-baseline-route.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。
5. 结论：`Phase D` 已具备可复用采集入口，下一步可直接切换到 `S30.1`。


### S30.1 V1 更新（2026-03-07 19:44 CST）

1. 已新增 `QUALITY_SIGNAL_SYNC` 任务、执行器和 `POST/GET /api/books/[id]/qc/signals/sync`。
2. 当前已可稳定回写 `attempt.metrics.cer` 与 `attempt.metrics.speakerSimilarity` 系列字段。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-signal-sync-runner.test.ts src/lib/__tests__/qc-signal-sync-route.test.ts src/lib/__tests__/task-replay-payload-signal-sync.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。
5. 结论：`S30.1` 已进入 V1 阶段，下一步应把信号生产挂入默认链路并接入真实 provider。


### S30.1 V2 更新（2026-03-07 20:14 CST）

1. 默认质检链路已接入前置信号生产：`qc/run` 和 `AUTO_PIPELINE` 质量阶段现在会默认先跑 `QUALITY_SIGNAL_SYNC`。
2. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner-signal-sync.test.ts src/lib/__tests__/qc-run-route.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
3. 结果：全部通过。
4. 结论：`S30.1` 默认供给闭环已成立，下一步应进入真实 provider 接入与基线对照。


### S30.1 V3 更新（2026-03-07 21:21 CST）

1. 已新增真实 provider 运行时与推理模块：支持 env / book / task 三层配置，以及 direct score / transcript / embedding 三类响应解析。
2. `QUALITY_SIGNAL_SYNC` 已升级为 `existing -> task_payload -> provider -> heuristic` 四级决策。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/signal-model-runtime.test.ts src/lib/__tests__/signal-model-inference.test.ts src/lib/__tests__/quality-signal-sync-runner-provider.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。
5. 结论：`S30.1` 已收口完成，下一步切换到 `S31`。


### S31 更新（2026-03-07 22:30 CST）

1. 已新增 `FINAL_ASSEMBLY` 与 `MANUAL_REVIEW_SYNC` 任务执行器，并接入 `audio/merge` 与 `review/items/sync`。
2. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/final-assembly-runner.test.ts src/lib/__tests__/manual-review-sync-runner.test.ts src/lib/__tests__/audio-merge-route.test.ts src/lib/__tests__/manual-review-sync-route.test.ts src/lib/__tests__/task-replay-payload-workflow.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
3. 结果：全部通过。
4. 结论：`S31` 已完成，下一步切换到 `S32`。


### S32 V1 更新（2026-03-07 22:50 CST）

1. 已新增 `slo-metrics` 模块与 `GET /api/books/[id]/slo/metrics`，统一五项核心 SLO 指标口径，并支持 `days/source` 过滤。
2. `pipeline_success_rate` 已建立 `AUTO_PIPELINE` 直达交付 + `FINAL_ASSEMBLY` 复核后交付的 delivery terminal 口径；`calibration_eval` 已自动从生产 SLO 统计中剔除。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/slo-metrics-service.test.ts src/lib/__tests__/slo-metrics-route.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。
5. 结论：`S32` 已进入 V1 阶段，下一步应补 `POST /api/slo/alerts/scan` 与事件生命周期兼容层。


### S32 V2 更新（2026-03-07 23:07 CST）

1. 已新增 `slo-alerts` 模块与 `POST /api/slo/alerts/scan`，用于按窗口扫描核心 SLO breach 并批量沉淀事件。
2. 核心 SLO 告警已复用既有 `qc_dispatch_alert_events` 与 webhook 通道，避免新增第二套事件生命周期。
3. 已执行：
   - `pnpm --filter web test -- --runInBand src/lib/__tests__/slo-alert-service.test.ts src/lib/__tests__/slo-alert-scanner.test.ts src/lib/__tests__/slo-alert-scan-route.test.ts`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web lint`
   - `pnpm --filter web test:regression`
4. 结果：全部通过。
5. 结论：`S32` 已进入 V2 阶段，下一步只剩复核页切换统一 SLO API 与最终验收收口。
