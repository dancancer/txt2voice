# txt2voice 全自动有声书 V2 详细改造计划

> 版本：v1.0  
> 日期：2026-03-05  
> 范围：Speaker 预配置、多引擎路由、自动质检、人工复核闭环、章节合成一致性  
> 关联基线：`docs/plan/2026-03-01-audiobook-quality-improvement-plan.md`

---

## 1. 文档定位与改造原则

本计划基于现有 P0/P1/P2 路线，进一步落地“上传即自动生成”的全链路能力。重点从“能生成”升级到“可交付、可审计、可复核、可持续优化”。

### 1.1 核心原则

1. **先稳定，再智能**：先保证任务可恢复、可重试，再做复杂策略优化。  
2. **消除特殊分支**：通过统一标注契约与规则引擎，减少流程硬编码 `if/else`。  
3. **最小可运行闭环**：优先打通 Fast Gate + 人工复核，再逐步引入 Deep Gate。  
4. **引擎能力抽象**：不把情绪、韵律参数直接写死到某个 TTS 提供商。  
5. **质检驱动返工**：返工策略由错误类型决定，不允许盲目无限重试。

---

## 2. 目标与非目标

## 2.1 目标（12 周）

1. 上传后自动跑完整链路：文本处理 -> 角色抽取 -> 自动绑定 -> 台本标注 -> 合成 -> 质检 -> 复核 -> 合成。  
2. 支持“说话人预配置 + 情绪子声线 + 多引擎策略路由”。  
3. 建立句级与章节级质量门控，输出可追踪的质检日志。  
4. 建立人工复核工作台，支持失败条目快速定点返工。  
5. 建立质量与成本指标看板，支持阈值调参与灰度策略。

## 2.2 非目标（本期不做）

1. 不做完全自动情绪生成配音导演系统（仅做规则 + LLM 混合策略）。  
2. 不引入月级大规模训练平台改造（保留现有外部训练服务接入能力）。  
3. 不一次性替换所有旧接口；采用兼容期渐进迁移。

---

## 3. 当前能力基线（与 03-01 计划衔接）

当前系统已具备：

- 文本处理、角色抽取、台本生成、音频生成的基础链路；
- `ProcessingTask` + Redis Worker 的异步执行框架；
- 角色-声音绑定（`CharacterVoiceBinding`）与说话人档案（`SpeakerProfile`）；
- `completed_with_errors` 状态语义。

当前主要缺口：

1. 缺少统一的“多角色标注契约”；  
2. 缺少标准化质检流水线（CER/声纹/情绪/章节一致性）；  
3. 多引擎协同时缺少路由与回退规则；  
4. 缺少“自动返工 + 人工复核”闭环。

---

## 4. 目标架构（V2）

## 4.1 逻辑组件

1. **Speaker Studio（预配置中心）**  
   - 管理说话人画像（性别、年龄、风格、角色标签）  
   - 管理情绪子声线（怒/喜/悲/冷/春情萌动等）  
   - 管理引擎可用性与偏好（IndexTTS、QwenTTS、KokoClone 等）

2. **Auto Pipeline Orchestrator（流程编排）**  
   - 上传触发自动流水线  
   - 每阶段写入 `ProcessingTask` 进度与结构化元数据  
   - 失败按错误类型进入返工或复核队列

3. **Engine Router（引擎路由层）**  
   - 按 `role_type + emotion + priority + engine_health` 选择引擎  
   - 支持主引擎、备引擎、降级策略

4. **QC Engine（双层质检）**  
   - Fast Gate：每句必跑，低延迟  
   - Deep Gate：高价值句/返工句触发，精检  
   - Chapter Audit：章节一致性审计

5. **Review Workbench（人工复核）**  
   - 聚合 `manual_review` 项目  
   - 支持“试听、修改参数、重生、通过、驳回”

---

## 5. 标注契约（Multi-role Annotation v2）

## 5.1 设计要求

1. 兼容现有 `ScriptSentence` 数据落库；  
2. 允许跨引擎调度（`engine_hint` 仅提示，不强绑定）；  
3. 支持句级优先级与返工参数继承；  
4. 支持情绪标准化映射，避免标签漂移。

## 5.2 统一字段（建议）

- `role_type`: `narration | dialogue | monologue | effect`  
- `emotion.label`: 使用标准情绪本体（如 `calm/joy/angry/sad/cold/romantic_arousal`）  
- `emotion.raw_label`: 保留原始标签（如“春情萌动”）  
- `voice_profile`: 对应统一 Speaker 资产 ID  
- `engine_hint`: `qwen3_tts | indextts | kokoclone | cosyvoice | voxcpm`  
- `priority`: `high | normal | low`

## 5.3 示例（与现有设计兼容）

```json
{
  "book_id": "book_001",
  "lang": "zh-CN",
  "sample_rate": 24000,
  "chapters": [
    {
      "chapter_id": "ch01",
      "segments": [
        {
          "seg_id": "ch01_s0002",
          "text": "你终于来了？我等你很久了。",
          "speaker": "villain",
          "role_type": "dialogue",
          "emotion": { "label": "cold", "raw_label": "冷笑", "intensity": 0.62 },
          "prosody": { "pace": 0.93, "pitch": -0.12, "energy": 0.55, "pause_ms_after": 140 },
          "voice_profile": "villain_male_clone_v2",
          "engine_hint": "kokoclone",
          "priority": "high"
        }
      ]
    }
  ]
}
```

---

## 6. 自动质检与返工闭环（QC v2）

## 6.1 质检流水线（6 步）

1. **Q0 预检查**：句长约束、数字/时间/专名规范化。  
2. **Q1 音频快检**：削波、静音、噪声、语速异常。  
3. **Q2 文本准确率**：ASR 回听 CER（中文优先）。  
4. **Q3 说话人一致性**：embedding 相似度防串角。  
5. **Q4 情绪匹配**：分类器 + 韵律代理特征双校验。  
6. **Q5 章节审计**：角色漂移、响度统一、旁白风格一致性。

## 6.2 判定机制

- `hard_fail`: `cer > 0.12` 或 `speaker_sim < 0.70` 或 `clipping = true`  
- 综合评分：

```text
score = 100 * (
  0.35 * text_score +
  0.30 * speaker_score +
  0.20 * emotion_score +
  0.10 * audio_score +
  0.05 * continuity_score
)
```

- `pass`: `score >= 85`  
- `repair`: `70 <= score < 85`  
- `manual_review`: `score < 70` 或重试耗尽

## 6.3 默认阈值（可配置模板）

1. Q1：`peak < -1 dBTP`、前静音 `<120ms`、尾静音 `<250ms`、章节 `-19 LUFS ±1`  
2. Q2：旁白 `CER <= 0.05`，对白 `<= 0.08`，高情绪对白 `<= 0.10`  
3. Q3：主角 `>=0.82`，配角 `>=0.76`，`<0.70` 硬失败  
4. Q4：目标情绪得分 `>=0.70`，且目标情绪在 Top-2  
5. Q5：同角色跨章节声纹中心漂移 `<0.06`

## 6.4 自动返工策略

1. **文本错（CER 高）**：降语速 `-0.05` -> 强制二次切分 -> 切模型。  
2. **角色错（speaker 低）**：锁定 voice_profile + 固定 seed -> 增参考音权重 -> 切 KokoClone。  
3. **情绪弱**：强度 `+0.10~0.20` + 显式语气标签注入。  
4. **音频问题**：重采样 + 响度归一 -> 仍失败则降低能量重生。  
5. **重试上限**：每句最多 3 次，第 3 次失败必入人工复核。

---

## 7. 数据模型与接口改造计划

## 7.1 数据模型（新增）

建议新增表：

1. `speaker_engine_variant`：同一 Speaker 在不同引擎的可用变体  
2. `speaker_emotion_preset`：情绪参数模板（label/intensity/prosody）  
3. `synthesis_attempt`：每次合成尝试日志（输入参数 + 引擎 + 耗时）  
4. `quality_check_result`：Q0-Q5 指标、得分、判定、失败原因  
5. `manual_review_item`：人工复核队列项与处理结果  
6. `chapter_quality_audit`：章节一致性结果

## 7.2 现有模型扩展（建议）

1. `ScriptSentence` 增加：`roleType`、`emotionLabel`、`emotionIntensity`、`engineHint`、`priority`  
2. `AudioFile` 增加：`attemptNo`、`qualityStatus`、`qualityScore`、`qualityVerdict`  
3. `ProcessingTask.taskData` 统一结构化字段：`stage`、`metrics`、`repairPlan`、`reviewQueueCount`

## 7.3 API 改造（新增/扩展）

1. `POST /api/books/[id]/pipeline/auto`：触发全自动链路  
2. `GET /api/books/[id]/pipeline/status`：返回阶段进度 + 质检摘要  
3. `POST /api/books/[id]/qc/retry`：按错误类型批量返工  
4. `GET /api/books/[id]/review/items`：待人工复核清单  
5. `POST /api/books/[id]/review/items/[itemId]/resolve`：复核通过/驳回/重生

---

## 8. 任务编排与状态机（V3）

## 8.1 任务类型新增

- `AUTO_PIPELINE`  
- `QUALITY_CHECK`  
- `MANUAL_REVIEW_SYNC`  
- `FINAL_ASSEMBLY`

## 8.2 书籍状态扩展建议

在 `script_generated` 与 `completed` 之间引入：

- `quality_checking`  
- `manual_review_pending`  
- `assembling_audio`

最终流转：

`uploaded -> processing -> processed -> generating_script -> script_generated -> quality_checking -> manual_review_pending? -> assembling_audio -> completed | completed_with_errors`

---

## 9. 分阶段实施（12 周）

## Phase A（第 1-2 周）标注与路由基线

1. 落地 Annotation v2（存储 + 序列化 + 兼容旧字段）  
2. 落地 Engine Router v1（旁白/对白分流 + 兜底）  
3. 落地 `AUTO_PIPELINE` 编排入口与进度回传  
4. 验收：可一键从上传跑到句级音频输出

## Phase B（第 3-5 周）Fast Gate 与自动返工

1. 接入 Q0-Q3 快检（先不阻塞深度情绪模型）  
2. 落地错误分型与返工策略  
3. 接入 `synthesis_attempt` 与 `quality_check_result` 日志  
4. 验收：失败句自动收敛，返工后通过率显著提升

## Phase C（第 6-8 周）Deep Gate 与人工复核

1. 接入 Q4 情绪匹配、Q5 章节一致性  
2. 上线人工复核工作台（试听、调参、重生）  
3. 接入章节导出前审计  
4. 验收：人工复核路径闭环可用

## Phase D（第 9-12 周）生产化与优化

1. 指标看板、告警、阈值配置中心  
2. 灰度开关（按书籍/租户/引擎）  
3. 成本与时延优化（批处理策略、缓存、并发上限）  
4. 验收：达到 SLO，支持稳定运营

---

## 10. 指标、SLO 与告警

## 10.1 核心指标

1. `pipeline_success_rate`（整书完成率）  
2. `sentence_pass_rate_first_try`（首轮通过率）  
3. `avg_retry_per_sentence`（句均返工次数）  
4. `manual_review_ratio`（人工复核占比）  
5. `chapter_consistency_fail_rate`（章节审计失败率）

## 10.2 建议 SLO

1. 整书自动流程成功率 `>=95%`  
2. Fast Gate 平均单句开销 `<1.2s`  
3. 人工复核积压 `P95 < 24h`  
4. 同角色跨章节漂移超标率 `<3%`

## 10.3 告警

1. `hard_fail_rate > 8%`（10 分钟窗口）  
2. `manual_review_backlog > 500`  
3. `engine_fallback_rate > 30%`（单引擎异常预警）  
4. `chapter_loudness_outlier_rate > 5%`

---

## 11. 风险与应对

1. **多引擎音色割裂**  
   - 应对：章节级 loudness + timbre drift 审计；必要时旁白/对白分轨后统一母带处理。

2. **情绪标签不可控（业务词过多）**  
   - 应对：情绪本体映射层（标准标签 + 原始标签双存储）。

3. **返工成本失控**  
   - 应对：错误分型优先、最多 3 次重试、超限自动人工复核。

4. **模型能力差异导致阈值失真**  
   - 应对：阈值模板按引擎和角色分层，不使用全局单阈值。

---

## 12. 与现有代码落点映射（首批）

1. 编排入口：`apps/web/src/app/api/books/[id]/process/route.ts`（新增自动流程触发）  
2. 台本标注：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts`  
3. 音频路由：`apps/web/src/lib/audio-generator.ts`、`apps/web/src/lib/tts-service.ts`  
4. 队列执行：`apps/web/src/lib/task-queue/ops/worker.ts`  
5. 数据模型：`apps/web/prisma/schema.prisma`

---

## 13. 里程碑交付物

1. **M1**：Annotation v2 + Router v1 + Auto Pipeline（可跑通）  
2. **M2**：Fast Gate + 自动返工 + 日志闭环  
3. **M3**：Deep Gate + 人工复核工作台  
4. **M4**：SLO 达标 + 灰度/告警/运维手册

---

## 14. 执行快照与缺口（2026-03-06 11:40 CST）

### 14.1 已完成（S0-S26 实施层）

1. Annotation v2、Prisma V2 增量表、`AUTO_PIPELINE` 编排入口与状态查询已落地。  
2. Fast/Deep Gate、`qc/retry`、二次派单、阈值配置中心、告警事件生命周期（open/acked/resolved）已落地。  
3. 人工复核工作台（单条 + 批量处置）、告警事件处置入口、复核日志 CSV 导出已落地。  
4. Deep Gate 模型运行时已支持“模型优先 + 启发式回退”，并输出 `deepGateCalibration` 阈值建议快照。

### 14.2 现存 gap（对齐“上传即自动生成 + 可运营”目标）

| Gap | 当前现状 | 影响 | 建议任务 |
| --- | --- | --- | --- |
| G1 上传自动触发缺失 | 上传接口仅更新书籍状态，不自动创建 `AUTO_PIPELINE` | “上传即自动生成”目标未闭环 | S28 |
| G2 主流程入口偏手动 | 书籍页仍以“手动触发台本生成”为主 | 用户路径割裂，运营误操作成本高 | S28 |
| G3 引擎路由未运行时接入 | 已有 `speaker_engine_variants/speaker_emotion_presets` 模型，但未进入音频生成决策主链路 | 多引擎策略收益无法兑现 | S29 |
| G4 Q0-Q3 指标化不足 | Fast Gate 仍以时长/语速等启发式为主，缺 CER/声纹等关键信号 | 误报漏报风险偏高，返工策略不稳定 | S30 |
| G5 编排任务类型不完整 | 计划中的 `MANUAL_REVIEW_SYNC/FINAL_ASSEMBLY` 尚未落地为独立任务类型 | 状态机语义与交付阶段可追溯性不足 | S31 |
| G6 核心 SLO 指标未产品化 | 已有 dispatch 侧指标与告警，但 `pipeline_success_rate` 等核心指标未形成统一 API/告警闭环 | 难以按计划验收 SLO | S32 |

### 14.3 剩余任务优先级（2026-03-06 重排）

| 优先级 | 任务编号 | 目标 | 验收标准 |
| --- | --- | --- | --- |
| P0 | S27 | Deep Gate 阈值发布治理闭环 | 阈值建议可离线回放评估、审批发布、版本审计与回滚 |
| P1 | S28 | 上传自动触发 Auto Pipeline + 前端主入口统一 | 上传后自动建链路任务，页面可一键查看阶段进度 |
| P1 | S29 | Engine Router v1 运行时接入 | 按 `role_type + emotion + priority + engine_health` 决策并记录命中策略 |
| P1 | S30 | Q0-Q3 指标化升级（CER/声纹优先） | 关键指标可回放、可追溯，返工命中率提升 |
| P2 | S31 | `FINAL_ASSEMBLY`/复核同步任务化 | 合并交付阶段可重放、可恢复、可审计 |
| P2 | S32 | 核心 SLO 指标与告警产品化 | `pipeline_success_rate` 等指标具备 API、看板与阈值告警 |

### 14.4 推荐执行顺序

1. **先做 S27（P0）**：先把“阈值建议 -> 发布”治理闭环补齐，避免模型策略漂移。  
2. **并行做 S28 + S29（P1）**：先闭环用户主链路，再把引擎策略接入运行时。  
3. **执行 S30（P1）**：补 Q0-Q3 关键指标，提升质量门控可信度。  
4. **最后做 S31 + S32（P2）**：完善交付任务化与 SLO 运营验收能力。

### 14.5 S27-S32 实施卡（输入/输出/API/验收/风险）

1. 实施卡文档：`docs/epic/2026-03-05-autobook-v2/2026-03-06-autobook-v2-s27-s32-execution-cards.md`。  
2. 使用方式：每个任务按“输入 -> 输出 -> API -> 验收 -> 风险”逐项打勾推进，避免里程碑口径漂移。  
3. 约束：如执行中新增任务，需先补实施卡再进入开发，保持 handoff 可接手性。  
