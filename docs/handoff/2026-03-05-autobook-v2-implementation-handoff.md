# AutoBook V2 Handoff（2026-03-05）

## 当前状态

- 分支基线：`main`
- 任务文档：`docs/task/2026-03-05-autobook-v2-implementation-task.md`
- 当前进度：S0-S10 全部完成，已进入第三轮（人工复核列表 + resolve + 重生入队）。

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

## 待完成内容

1. 仍缺“重生后自动状态回流”：`reprocessing -> resolved/rejected` 依赖后续任务联动。
2. `POST /api/books/[id]/qc/retry` 尚未落地，当前无法按错误类型批量返工。
3. 当前 Fast Gate 仍为轻量规则，需要后续接入真实 ASR/CER 与声纹模型。

## 测试与验证结果

- 新增与更新测试：
  - `apps/web/src/lib/__tests__/script-annotation-v2.test.ts`（新增）
  - `apps/web/src/lib/__tests__/script-sentence-contract.test.ts`（更新）
  - `apps/web/src/lib/__tests__/quality-check-runner.test.ts`（新增）
  - `apps/web/src/lib/__tests__/task-replay-payload-quality.test.ts`（新增）
  - `apps/web/src/lib/__tests__/manual-review-service.test.ts`（新增）
- 已执行：
  - `pnpm --filter web test -- --runInBand src/lib/__tests__/manual-review-service.test.ts src/lib/__tests__/quality-check-runner.test.ts src/lib/__tests__/task-replay-payload-quality.test.ts`
  - `pnpm --filter web test:regression`
  - `pnpm --filter web typecheck`
- 结果：全部通过。

## 下一步建议（接手即做）

1. 增加重生任务结果回写器，自动关闭/重开 `manual_review_items`（消除手工同步分支）。
2. 新增 `POST /api/books/[id]/qc/retry`，按 issueType/score 区间批量返工并打标签。
3. 扩展 Deep Gate（Q4/Q5）与章节审计，并沉淀阈值模板（按引擎/角色类型）。
