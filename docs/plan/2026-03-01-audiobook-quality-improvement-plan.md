# txt2voice 改造执行计划（面向高质量有声书）

> 版本：v1.0  
> 日期：2026-03-01  
> 范围：业务流程、代码组织、UI 交互、质量与可观测性  
> 说明：本计划仅包含实施方案与验收标准，不包含代码变更。

---

## 1. 目标与成功标准

### 1.1 业务目标（North Star）

围绕“用户上传小说后，流畅、便捷地生成带感情的高质量有声书”，将系统能力从“可生成”升级为“稳定可交付 + 可感知质量”。

### 1.2 成功标准（12 周）

1. **流程成功率**：整书生成任务成功完成率（无卡死）≥ 95%  
2. **质量完成率**：完成任务中“无缺段台词 + 无旁白失败”比例 ≥ 98%  
3. **交互流畅性**：关键路径（上传→试听→全量生成）平均点击步数降低 30%  
4. **感情表达命中率**：抽样质检中“情绪与文本一致”主观评分 ≥ 4/5  
5. **可恢复性**：服务重启后可自动续跑任务，任务丢失率为 0

---

## 2. 当前关键问题（按优先级）

## P0（必须优先）

1. **数据契约不一致，导致页面状态与数据展示失真**  
   - 典型位置：`/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/route.ts`、`/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/audio/page.tsx`、`/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/play/page.tsx`
2. **情感参数链路断裂，LLM 情绪标注未有效传到 TTS**  
   - 典型位置：`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`、`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`、`/Users/xupeng/mycode/txt2voice/apps/web/prisma/schema.prisma`
3. **无旁白默认声线兜底，整书任务容易部分失败**  
   - 典型位置：`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`、`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/audio-generator.ts`
4. **长任务非持久队列，fire-and-forget 易丢失任务**  
   - 典型位置：`/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/script/generate/route.ts`、`/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/audio/generate/route.ts`
5. **台本分段失败被吞掉，任务“完成”不等于“完整”**  
   - 典型位置：`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`

## P1（应尽快）

1. 状态机仍混有历史状态（`analyzing/analyzed`），与 LLM-only 路径冲突  
2. `/script` 与 `/scripts` 双接口并存，协议漂移风险高  
3. 前端选择 provider 未完整贯通后端  
4. 分段参数在多处不一致，影响节奏与情感效果  
5. UI 使用 `alert/confirm` + 占位文案，体验不统一

## P2（中期）

1. 核心文件超大（维护成本高，回归风险高）  
2. 文档中的“Redis 队列架构”与真实实现不一致  
3. 自动化测试覆盖主链路不足，当前存在已知失败用例

---

## 3. 交付策略与架构原则

1. **先修真相，再修体验**：先统一数据契约与状态机，再优化交互。  
2. **先保可靠，再提质量**：先保证任务不丢、可恢复，再做情感质量增强。  
3. **单一事实来源（Single Source of Truth）**：状态、DTO、参数映射全部单源。  
4. **可观测先行**：每个阶段都必须绑定指标与告警。  
5. **可回滚发布**：每个里程碑支持灰度与回退。

---

## 4. 分阶段执行计划

## Phase 1（第 1-2 周）：快速收益与链路纠偏

### 目标

解决“用户能看到、能操作、结果可信”的基础问题。

### 核心任务

1. 统一书籍详情 DTO（页面只消费一种结构）  
2. 收敛书籍状态机，移除历史阶段回退路径  
3. 贯通 provider 参数到音频生成后端  
4. 建立“旁白默认声线”兜底策略  
5. 统一通知交互（toast + dialog），移除关键页面占位/测试文案  
6. 将“部分成功”从 completed 中区分出来（例如 `completed_with_errors`）

### 验收标准

1. 音频页、播放页、概览页状态展示一致  
2. 同一本书重复刷新后状态不抖动、不回退  
3. 旁白句子不再因无角色绑定而失败  
4. 用户端不再出现“长期生成中但已结束”的假状态  
5. 关键操作不再依赖 `alert/confirm`

### 交付物

1. 状态机说明文档（v2）  
2. 统一 DTO 契约文档  
3. Phase 1 回归测试清单

---

## Phase 2（第 3-6 周）：任务可靠性与可恢复性

### 目标

将长任务从“尽力执行”升级为“可靠执行”。

### 核心任务

1. 引入持久队列（Redis + worker）替代 API 内 fire-and-forget  
2. 任务幂等（bookId + taskType + scope + hash）  
3. 断点续跑与失败重试（指数退避 + 最大重试 + 死信）  
4. 任务心跳与超时判定，卡死自动恢复  
5. 清理策略：DB 记录与磁盘文件一致性治理  
6. 接口收敛：`/script` 与 `/scripts` 统一

### 验收标准

1. 重启服务后，进行中任务可恢复并继续推进  
2. 重复点击“生成”不会创建重复执行任务  
3. 失败任务可一键重跑失败分片  
4. 文件清理后 DB 与磁盘一致，无孤儿文件

### 交付物

1. 队列任务模型与状态流转图  
2. 任务恢复/重试规则文档  
3. 生产巡检 runbook（任务积压、失败率、恢复操作）

---

## Phase 3（第 7-12 周）：质量闭环与情感效果提升

### 目标

让“有感情、高质量”从主观感受变成可持续优化的产品能力。

### 核心任务

1. 建立情感参数映射标准层（tone/strength/pause/ttsHints → provider 参数）  
2. 上线“30 秒试听环节”（旁白 + 主角 + 高情绪句）  
3. 引入质量评分：情绪一致性、停顿自然度、音量稳定性  
4. 建立“失败段列表 + 一键补全”闭环  
5. 增加内容级指标：缺段率、情绪分布偏差、句子失败热区  
6. 形成角色-语音推荐策略（按性别/语气/体裁）

### 验收标准

1. 情感一致性评分达到目标阈值  
2. 试听后全量生成转化率提升  
3. 失败段补全完成时间显著下降  
4. 用户投诉项（情感平、断句差）下降

### 交付物

1. 情感映射规范文档（跨 provider）  
2. 质量仪表盘（产品 + 技术双视角）  
3. 质量回归基线（样例集 + 评估脚本规范）

---

## 5. 任务分解（WBS）

| Workstream | 优先级 | 预计工期 | 负责人建议 | 依赖 |
|---|---:|---:|---|---|
| 状态机与 DTO 统一 | P0 | 4-6 天 | 后端 + 前端 | 无 |
| Provider 贯通与旁白兜底 | P0 | 3-5 天 | 音频后端 | DTO 统一 |
| 任务结果真实性（部分成功状态） | P0 | 2-3 天 | 后端 | 状态机统一 |
| 队列化与 Worker | P0 | 8-12 天 | 后端基础设施 | Redis 可用 |
| 幂等/重试/恢复 | P0 | 5-8 天 | 后端基础设施 | 队列化 |
| 接口收敛（script/scripts） | P1 | 3-5 天 | 后端 + 前端 | DTO 统一 |
| UI 交互统一与占位清理 | P1 | 4-6 天 | 前端 | 状态机统一 |
| 情感映射标准层 | P1 | 6-10 天 | 音频后端 + 算法 | Provider 贯通 |
| 试听闭环 | P2 | 5-8 天 | 前端 + 产品 | 情感映射 |
| 质量指标与看板 | P2 | 5-7 天 | 后端 + 数据 | 可观测基础 |

---

## 6. 指标与可观测性计划

## 6.1 核心业务指标

1. `book_pipeline_success_rate`：整书任务最终成功率  
2. `book_pipeline_duration_p50/p90`：总耗时  
3. `audio_generation_failure_rate`：句子级失败率  
4. `script_gap_ratio`：台本缺段比例  
5. `emotion_consistency_score`：情感一致性评分

## 6.2 技术指标

1. `queue_backlog_size`：队列积压  
2. `task_recovery_count`：任务恢复次数  
3. `retry_attempt_distribution`：重试分布  
4. `orphan_file_count`：孤儿文件数  
5. `api_contract_error_count`：契约不匹配错误数

## 6.3 告警阈值（初版）

1. 整书失败率 > 10%（5 分钟窗口）报警  
2. 队列积压 > 500 持续 10 分钟报警  
3. 任务平均恢复时长 > 15 分钟报警  
4. 情感一致性评分 < 3.5/5 报警

---

## 7. 测试与发布策略

### 7.1 测试分层

1. 单元测试：参数映射、状态机流转、幂等键生成  
2. 集成测试：上传→台本→音频全链路（含失败重试）  
3. 回归测试：典型小说样本（短篇/长篇/多角色）  
4. 体验测试：关键 UI 路径（试听、补全失败段、播放）

### 7.2 发布节奏

1. 每阶段以 feature flag 控制  
2. 先灰度（10% 任务）再全量  
3. 保留回滚路径（旧执行器 + 旧接口兼容期）

---

## 8. 里程碑（建议）

1. **M1（第 2 周末）**：状态机/DTO/provider/旁白兜底全部上线  
2. **M2（第 6 周末）**：队列可靠执行体系上线，任务可恢复  
3. **M3（第 10 周末）**：试听闭环与质量评分上线  
4. **M4（第 12 周末）**：稳定运营阶段，进入持续优化

---

## 9. 当前已知技术债（纳入计划）

1. 文本分段测试存在失败用例：`/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/text-splitter.test.ts`  
2. 文档与配置端口不一致：`/Users/xupeng/mycode/txt2voice/README.md` 与 `/Users/xupeng/mycode/txt2voice/docker-compose.yml`  
3. 依赖声明与实际使用脱节（队列相关依赖尚未落地主链路）：`/Users/xupeng/mycode/txt2voice/apps/web/package.json`

---

## 10. 第一个迭代（未来 7 天）建议执行清单

1. 冻结统一 DTO 与状态机（产出协议文档 + 字段清单）  
2. 修复前端书籍详情消费路径（概览/音频/播放三页统一）  
3. 打通 provider 参数贯通与旁白默认声线  
4. 新增“部分成功”状态与前端展示  
5. 建立 Phase 1 回归清单并跑首轮验收

---

## 11. 风险与应对

1. **风险**：队列改造期间引入双执行路径复杂度  
   - **应对**：feature flag + 双写日志 + 小流量灰度
2. **风险**：情感参数映射在不同 provider 行为不一致  
   - **应对**：建立 provider capability matrix 与降级策略
3. **风险**：长篇小说回归测试成本高  
   - **应对**：固定基准样本集 + 夜间回归任务

---

## 12. 结语

本计划的核心不是“增加功能”，而是把现有链路做成**可信、可恢复、可持续优化**的产品系统。  
执行优先级应严格遵循：**P0 可靠性与真相一致 > P1 体验统一 > P2 质量增强**。

