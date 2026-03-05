# txt2voice AutoBook V2 Prisma 迁移草案

> 版本：v0.9-draft  
> 日期：2026-03-05  
> 关联计划：`docs/plan/2026-03-05-autobook-v2-full-automation-plan.md`  
> 目标：为“多引擎路由 + 自动质检 + 人工复核闭环”提供可演进的数据底座

---

## 1. 迁移目标

本次迁移只做两件事：

1. **新增 V2 能力所需表结构**，不破坏现有生产链路。  
2. **渐进扩展现有核心表字段**，保证向后兼容与可回滚。

设计策略：先加表、再双写、后切读，最后再考虑收敛旧字段。

---

## 2. 迁移边界与约束

## 2.1 不做的事情

1. 不在本次迁移中删除现有字段。  
2. 不把 `status/taskType` 全量替换成 Prisma Enum（避免大范围历史数据治理风险）。  
3. 不修改现有主键类型（如 `SpeakerProfile.id` 仍保持 `Int`）。

## 2.2 强约束

1. 新表全部带 `createdAt/updatedAt`。  
2. 关键查询路径必须有索引（book、chapter、sentence、status、createdAt）。  
3. 高频明细日志表（attempt/qc）默认仅保留必要字段，避免早期过度建模。

---

## 3. 目标模型变更总览

## 3.1 新增模型（6 张）

1. `SpeakerEngineVariant`：同一说话人在不同引擎的可用变体。  
2. `SpeakerEmotionPreset`：情绪模板（标准情绪 + 引擎参数）。  
3. `SynthesisAttempt`：每次合成尝试与返工轨迹。  
4. `QualityCheckResult`：Q0-Q5 质检指标与判定。  
5. `ManualReviewItem`：人工复核队列项。  
6. `ChapterQualityAudit`：章节一致性审计结果。

## 3.2 扩展模型（3 张）

1. `ScriptSentence`：补齐标注字段（角色类型/情绪/路由提示）。  
2. `AudioFile`：补齐质量字段（判定/评分/尝试编号）。  
3. `ProcessingTask`：新增任务类型数据约定（不改 schema 字段类型，改数据契约）。

---

## 4. Prisma Schema 草案（可直接用于第一版迁移）

> 说明：以下为建议结构，字段命名与现有风格保持一致（camelCase + `@map` 蛇形表字段）。

```prisma
model SpeakerEngineVariant {
  id               String        @id @default(uuid())
  speakerProfileId Int           @map("speaker_profile_id")
  engine           String
  providerVoiceId  String?       @map("provider_voice_id")
  referenceAudio   String?       @map("reference_audio")
  capability       Json          @default("{}")
  routingWeight    Decimal       @default(1.0) @db.Decimal(4, 3) @map("routing_weight")
  isDefault        Boolean       @default(false) @map("is_default")
  isActive         Boolean       @default(true) @map("is_active")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  speakerProfile   SpeakerProfile        @relation(fields: [speakerProfileId], references: [id], onDelete: Cascade)
  emotionPresets   SpeakerEmotionPreset[]
  attempts         SynthesisAttempt[]

  @@unique([speakerProfileId, engine, providerVoiceId])
  @@index([engine, isActive])
  @@index([speakerProfileId, isDefault, isActive])
  @@map("speaker_engine_variants")
}

model SpeakerEmotionPreset {
  id                     String    @id @default(uuid())
  speakerEngineVariantId String    @map("speaker_engine_variant_id")
  emotionLabel           String    @map("emotion_label")
  rawAliases             Json      @default("[]") @map("raw_aliases")
  intensityDefault       Decimal   @default(0.5) @db.Decimal(3, 2) @map("intensity_default")
  prosodyPreset          Json      @default("{}") @map("prosody_preset")
  engineParams           Json      @default("{}") @map("engine_params")
  isActive               Boolean   @default(true) @map("is_active")
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  speakerEngineVariant SpeakerEngineVariant @relation(fields: [speakerEngineVariantId], references: [id], onDelete: Cascade)

  @@unique([speakerEngineVariantId, emotionLabel])
  @@index([emotionLabel, isActive])
  @@map("speaker_emotion_presets")
}

model SynthesisAttempt {
  id                     String    @id @default(uuid())
  bookId                 String    @map("book_id")
  chapterId              String?   @map("chapter_id")
  segmentId              String?   @map("segment_id")
  sentenceId             String    @map("sentence_id")
  audioFileId            String?   @map("audio_file_id")
  speakerProfileId       Int?      @map("speaker_profile_id")
  speakerEngineVariantId String?   @map("speaker_engine_variant_id")
  engine                 String
  status                 String    @default("pending")
  attemptNo              Int       @default(1) @map("attempt_no")
  triggerType            String    @default("auto") @map("trigger_type")
  requestPayload         Json      @default("{}") @map("request_payload")
  appliedParams          Json      @default("{}") @map("applied_params")
  metrics                Json      @default("{}")
  startedAt              DateTime  @default(now()) @map("started_at")
  finishedAt             DateTime? @map("finished_at")
  durationMs             Int?      @map("duration_ms")
  errorCode              String?   @map("error_code")
  errorMessage           String?   @map("error_message")
  isFinal                Boolean   @default(false) @map("is_final")
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  book                 Book                  @relation(fields: [bookId], references: [id], onDelete: Cascade)
  chapter              Chapter?              @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  segment              TextSegment?          @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  scriptSentence       ScriptSentence        @relation(fields: [sentenceId], references: [id], onDelete: Cascade)
  audioFile            AudioFile?            @relation(fields: [audioFileId], references: [id], onDelete: SetNull)
  speakerProfile       SpeakerProfile?       @relation(fields: [speakerProfileId], references: [id], onDelete: SetNull)
  speakerEngineVariant SpeakerEngineVariant? @relation(fields: [speakerEngineVariantId], references: [id], onDelete: SetNull)
  qcResults            QualityCheckResult[]
  reviewItems          ManualReviewItem[]

  @@index([bookId, sentenceId, attemptNo])
  @@index([status, createdAt])
  @@index([engine, createdAt])
  @@index([speakerEngineVariantId, createdAt])
  @@map("synthesis_attempts")
}

model QualityCheckResult {
  id             String    @id @default(uuid())
  bookId         String    @map("book_id")
  chapterId      String?   @map("chapter_id")
  segmentId      String?   @map("segment_id")
  sentenceId     String?   @map("sentence_id")
  audioFileId    String?   @map("audio_file_id")
  attemptId      String?   @map("attempt_id")
  gate           String
  stage          String
  verdict        String
  score          Decimal?  @db.Decimal(5, 2)
  hardFail       Boolean   @default(false) @map("hard_fail")
  thresholdKey   String?   @map("threshold_key")
  metrics        Json      @default("{}")
  reasons        Json      @default("[]")
  detail         Json      @default("{}")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  book           Book              @relation(fields: [bookId], references: [id], onDelete: Cascade)
  chapter        Chapter?          @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  segment        TextSegment?      @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  scriptSentence ScriptSentence?   @relation(fields: [sentenceId], references: [id], onDelete: SetNull)
  audioFile      AudioFile?        @relation(fields: [audioFileId], references: [id], onDelete: SetNull)
  attempt        SynthesisAttempt? @relation(fields: [attemptId], references: [id], onDelete: SetNull)
  reviewItems    ManualReviewItem[]

  @@index([bookId, gate, stage, createdAt])
  @@index([verdict, createdAt])
  @@index([sentenceId, createdAt])
  @@map("quality_check_results")
}

model ManualReviewItem {
  id             String    @id @default(uuid())
  bookId         String    @map("book_id")
  chapterId      String?   @map("chapter_id")
  segmentId      String?   @map("segment_id")
  sentenceId     String?   @map("sentence_id")
  audioFileId    String?   @map("audio_file_id")
  attemptId      String?   @map("attempt_id")
  qcResultId     String?   @map("qc_result_id")
  issueType      String    @map("issue_type")
  priority       String    @default("normal")
  status         String    @default("pending")
  issueDetail    Json      @default("{}") @map("issue_detail")
  assignedTo     String?   @map("assigned_to")
  resolutionType String?   @map("resolution_type")
  resolutionNote String?   @map("resolution_note")
  resolvedAt     DateTime? @map("resolved_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  book           Book               @relation(fields: [bookId], references: [id], onDelete: Cascade)
  chapter        Chapter?           @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  segment        TextSegment?       @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  scriptSentence ScriptSentence?    @relation(fields: [sentenceId], references: [id], onDelete: SetNull)
  audioFile      AudioFile?         @relation(fields: [audioFileId], references: [id], onDelete: SetNull)
  attempt        SynthesisAttempt?  @relation(fields: [attemptId], references: [id], onDelete: SetNull)
  qcResult       QualityCheckResult? @relation(fields: [qcResultId], references: [id], onDelete: SetNull)

  @@index([bookId, status, priority, createdAt])
  @@index([assignedTo, status])
  @@index([issueType, status])
  @@map("manual_review_items")
}

model ChapterQualityAudit {
  id               String    @id @default(uuid())
  bookId           String    @map("book_id")
  chapterId        String    @map("chapter_id")
  auditBatchId     String    @map("audit_batch_id")
  verdict          String
  overallScore     Decimal?  @db.Decimal(5, 2) @map("overall_score")
  targetLufs       Decimal?  @db.Decimal(5, 2) @map("target_lufs")
  actualLufs       Decimal?  @db.Decimal(5, 2) @map("actual_lufs")
  peakDbtp         Decimal?  @db.Decimal(5, 2) @map("peak_dbtp")
  continuityMetric Json      @default("{}") @map("continuity_metric")
  speakerDrift     Json      @default("{}") @map("speaker_drift")
  actions          Json      @default("[]")
  auditedAt        DateTime  @default(now()) @map("audited_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  book             Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  chapter          Chapter   @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@index([bookId, chapterId, auditedAt])
  @@index([auditBatchId])
  @@map("chapter_quality_audit")
}
```

---

## 5. 现有模型字段扩展草案

## 5.1 `ScriptSentence` 扩展

建议新增：

- `roleType String? @map("role_type")`  
- `emotionLabel String? @map("emotion_label")`  
- `emotionIntensity Decimal? @db.Decimal(3,2) @map("emotion_intensity")`  
- `engineHint String? @map("engine_hint")`  
- `priority String?`  
- `prosody Json?`（保存 pace/pitch/energy/pause）

用途：承接台本标注契约，避免参数散落在 `ttsParameters`。

## 5.2 `AudioFile` 扩展

建议新增：

- `attemptNo Int @default(1) @map("attempt_no")`  
- `engineUsed String? @map("engine_used")`  
- `qualityScore Decimal? @db.Decimal(5,2) @map("quality_score")`  
- `qualityVerdict String? @map("quality_verdict")`  
- `qualityStatus String? @map("quality_status")`

用途：音频结果直接可用于“通过/返工/人工复核”列表。

## 5.3 关系反向字段补充（可选）

在 `Book`、`ScriptSentence`、`AudioFile`、`Chapter`、`TextSegment`、`SpeakerProfile` 中增加相应 relation 数组，提升 Prisma 查询可读性。

---

## 6. 分阶段迁移步骤（建议）

## Phase 1：DDL 增量建模（无业务切换）

1. 新增 6 张 V2 表。  
2. 给现有表加 V2 字段（可空）。  
3. 建立必要索引。  
4. 业务代码不切换，只验证迁移安全。

## Phase 2：双写（Write Both）

1. 音频生成时同时写 `audio_files` 与 `synthesis_attempts`。  
2. 质检任务写 `quality_check_results`。  
3. 判定为人工复核时写 `manual_review_items`。

## Phase 3：灰度切读（Read New）

1. 新增 API 优先读 V2 表。  
2. 管理后台增加“旧读/新读”开关。  
3. 灰度比例从 10% -> 50% -> 100%。

## Phase 4：收敛与清理

1. 验证稳定后，将 V2 字段升级为必填（分批次）。  
2. 清理临时兼容逻辑。  
3. 评估是否淘汰历史冗余字段。

---

## 7. 数据回填策略（Backfill）

## 7.1 回填 `speaker_engine_variants`

规则：

1. 每个活跃 `SpeakerProfile` 至少生成 1 条默认 variant。  
2. `engine` 初始按 `referenceAudio` 来源推断（默认 `indextts`）。  
3. `isDefault = true`，`routingWeight = 1.0`。

## 7.2 回填 `synthesis_attempts`

规则：

1. 每条历史 `AudioFile` 生成 1 条 `attemptNo = 1` 的记录。  
2. `status` 从 `audio_files.status` 映射。  
3. `engine` 优先取 `audio_files.provider`，否则回填 `"unknown"`。

## 7.3 回填 `ScriptSentence` 标注字段

规则：

1. `roleType`：`rawSpeaker` 为旁白语义则设为 `narration`，否则 `dialogue`。  
2. `emotionLabel`：从 `tone` 直接映射标准标签（无法映射则 `neutral`）。  
3. `priority` 默认 `normal`。

---

## 8. 回滚策略

1. 迁移失败：只回滚本次新增表与新增字段，不影响旧链路。  
2. 业务异常：切回旧读路径，保留双写。  
3. 严重故障：暂停 V2 worker，仅保留现有 `SCRIPT_GENERATION/AUDIO_GENERATION`。

---

## 9. 验收清单

1. `prisma migrate deploy` 在 staging 可重复执行。  
2. 全链路压测下，`synthesis_attempts` 与 `audio_files` 数量一致率 >= 99.9%。  
3. `quality_check_results` 可支撑按书/章节/句级检索（P95 < 300ms）。  
4. `manual_review_items` 支持分页、状态过滤、按优先级排序。  
5. 回滚脚本可在 30 分钟内恢复旧链路。

---

## 10. 下一步实施建议

1. 先产出 `schema.prisma` 的最小可迁移 PR（仅建表 + 必要索引）。  
2. 紧接着实现双写（`AudioGenerator` 与 QC worker）。  
3. 再做 API 切读与管理后台复核页。  
4. 最后做历史数据回填脚本与灰度切换。

