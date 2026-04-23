# LLM Workflow Review Hardening Design

**目标**

把当前 review 暴露出的 LLM 主链问题收敛成一套一致、可验证、可观测的运行时设计，优先修复三类风险：

1. 正确性风险：把合法输入误判为失败，或把运行时隐式规则悄悄改写成业务结果。
2. 状态语义风险：runtime summary、snapshot diagnostics、manual review 统计彼此矛盾。
3. 生命周期风险：manual review item 被覆盖、误关，prompt / skill 元数据无法回放到具体段落。

本次设计不追求重写整条 workflow，而是在现有 `character_discovery -> segment_scripting -> segment_repair -> quality_judgement -> persist -> manual_review_handoff` 主链上，把关键语义收口成统一规则。

## 背景

当前主链已经完成从 legacy 生成链路向 `apps/web/src/lib/agent-runtime` 的迁移，具备：

- workflow 级调度
- stage/agent/tool 级 runtime store
- `skills/*/prompts` + `skill.toml` 驱动的 prompt 资产
- quality / repair / persist 的基础分层

但从这轮 review 看，系统仍然存在稳定的坏模式：

1. 同一个业务概念在多处用不同语义表达
   - 角色发现“空结果”有时代表“没发现角色”，有时又被当成“系统失败”
   - `manualReviewSync.pending` 看起来像“当前待处理数”，实现却是“本次 touched 数”
2. 模型看见的上下文与运行时实际使用的规则不一致
   - prompt 只暴露显式 alias
   - runtime 却注入自动姓名变体并参与强归一化
3. 修复链路缺少“证据保真”
   - `speaker` 缺失被静默补成 `未知`
   - alias 命中被 runtime 纠正后，又被 quality stage 当成必须人审
4. workflow summary 对局部运行缺乏时序可见性
   - `stageSkillMetadata` 被后续段落覆盖
   - 不能回答“哪一段用了哪套 prompt / policy”
5. manual review 生命周期过粗
   - 同段不同失败类型互相覆盖
   - 后续成功会把历史待审项一起自动 resolved

这些问题的共同根因不是单个 if 写错，而是系统没有明确区分：

- 正常空结果 vs 真故障
- 显式证据 vs 运行时启发式
- 当前 touched 数 vs 当前 pending 总量
- 本轮成功 vs 历史问题全部解决

## 设计目标

### 必须达成

1. “无角色可发现”必须是合法业务状态，不得再被误判为 workflow failure。
2. 角色归一化只能基于 prompt 可解释、runtime 可审计的证据工作。
3. alias 命中不能再无差别触发人工审核；只有冲突或低置信度才升级。
4. discovery refresh snapshot 的 `source` 与 `diagnostics` 必须一致。
5. manual review item 的身份必须细化到“同段不同失败签名可共存”。
6. workflow summary 必须保留逐次 stage prompt metadata，而不是只保留最后一条。
7. `speaker` 缺失必须暴露为结构错误，进入 repair，而不是被静默业务化。

### 明确不做

1. 不重写 workflow engine。
2. 不重做 Prisma 业务表结构。
3. 不扩展音频生成链路。
4. 不在本轮引入新的外部状态机框架。

## 设计原则

1. 正常空结果优于伪故障
2. 显式证据优于隐式启发式
3. fail-closed 优于 silent fallback
4. 逐次记录优于最终覆盖
5. 生命周期签名化优于 segment 粗粒度折叠
6. 只有验证通过才允许进入下一步

## 总体方案

本次整改拆成五个设计支柱：

1. 正常化空发现语义
2. 收紧角色归一化证据边界
3. 校准 snapshot / summary / telemetry 语义
4. 重构 manual review item 生命周期
5. 建立真实 runtime/prompt 集成护栏

它们之间的关系是：

`语义统一 -> 证据收口 -> 状态可观测 -> 生命周期可回放 -> 测试可防回归`

---

## 一、正常化空发现语义

### 现状问题

当前 `run-character-discovery-pass.ts` 会把空 `characterMemoryDraft` 视为 `CHARACTER_DISCOVERY_EMPTY_DRAFT`。这会把以下正常情况误报成故障：

- 采样片段本身无角色
- 角色只在后续段落出现
- narration-heavy 文本
- 初始 `characterProfiles` 为空的新书

### 设计决策

把“空发现”定义为 **合法完成但无新增角色**，不是 failure。

### 新语义

`character_discovery` 结果分为三类：

1. `failed`
   - stage 真失败
   - prompt / parse / contract 无法完成
2. `completed + patch 有内容`
   - 成功发现并需要持久化
3. `completed + patch 为空`
   - 成功完成，但本轮无新增角色
   - 这是一种 no-op

### 影响

- workflow 只有在 discovery stage 真失败且没有可用角色基线时才 failed。
- 空发现不再触发 degraded mode。
- 角色刷新计数只在真实持久化发生时增长。

---

## 二、收紧角色归一化证据边界

### 现状问题

当前角色归一化存在两类错位：

1. 自动姓名变体会进入强 alias 链路
2. alias 命中会被无条件升级为人工审核

这导致：

- prompt 看不到的隐式 alias 参与最终决策
- 正常简称/别名把大量段落推入 manual review

### 设计决策

把角色归一化证据拆成两层：

1. 强证据
   - 显式 aliasEvidence
   - 已持久化 canonical name
   - 已知 canonical id
2. 弱证据
   - 自动姓名变体
   - 启发式简称

### 新规则

1. 强证据可参与自动 canonicalize。
2. 弱证据只能作为候选提示，不得直接写入强 alias map。
3. quality stage 只在以下情况进入人工审核：
   - unresolved speaker
   - alias conflict
   - 低分 / 低置信度
   - forceManualReview
4. 唯一且无冲突的显式 alias 命中允许 auto pass。

### 影响

- 自动姓名变体不再直接污染 speaker 强归一化。
- alias 命中从“硬闸门”改成“可解释风险信号”。
- 人工审核压力显著下降。

---

## 三、校准 runtime 状态与观测语义

### 现状问题 A：discovery refresh snapshot 语义错位

workflow 中当前通过“创建 bootstrap snapshot，再强行覆写 `source: "discovery_refresh"`”的方式构造 refresh snapshot。结果是：

- 顶层 `source` 是 refresh
- 但 `diagnostics.discoveryRunCount`、`sampleCoverage.strategy` 仍是 bootstrap 语义

### 设计决策 A

为 refresh snapshot 提供显式构造函数，禁止用 bootstrap helper 伪装。

### 新规则 A

新增专用 helper，例如：

```ts
createDiscoveryRefreshCharacterMemorySnapshot(...)
```

要求：

- `source = "discovery_refresh"`
- `discoveryRunCount >= 1`
- `sampleCoverage.strategy = "incremental"`
- `lastDiscoveryAt` 正确刷新

### 现状问题 B：workflow summary 丢失逐次 prompt metadata

当前 `stageSkillMetadata` 是 `stageId -> metadata` 单值映射，长流程只留下最后一次运行。

### 设计决策 B

把 prompt metadata 记录下沉到“逐次 stage run”，summary 保留聚合但不再丢时间维度。

### 新规则 B

保留两层输出：

1. `stageSkillMetadataLatest`
   - 用于快速读当前每个 stage 的最后状态
2. `stageSkillMetadataIndex`
   - 数组或 `stageRunId -> metadata`
   - 至少包含 `stageRunId`、`stageId`、可选 `segmentId`

### 现状问题 C：缺失 `speaker` 被静默补成 `未知`

这会把模型 schema 错误伪装成业务不确定性。

### 设计决策 C

缺失 `speaker` 必须是结构错误，进入 repair；显式输出 `未知` 才是业务值。

### 影响

- telemetry 与实际执行历史一致
- replay 能回答“哪次 stage 对哪段用了什么 prompt”
- 结构错误和业务不确定性重新分离

---

## 四、重构 manual review item 生命周期

### 现状问题

当前 manual review item 以 `bookId + issueType + segmentId` 粗粒度查重和关闭，导致：

1. 同段不同失败类型互相覆盖
2. 一次后续成功会关闭同段所有待审项
3. `pending` 统计语义错误

### 设计决策

把 review item 从“按 segment 聚合”改成“按失败签名管理”。

### 失败签名

建议最小签名为：

```ts
segmentId + scriptSubtype + errorCode
```

必要时补：

- issueCodes fingerprint
- stage

### 新规则

1. 新失败只更新同签名的 review item，不覆盖不同签名项。
2. 自动关闭只关闭“本次成功明确对应的同签名 review item”。
3. summary 计数拆为：
   - `created`
   - `updated`
   - `resolved`
   - `pendingCount`，表示当前真实待处理总量
   - `touchedCount`，表示本次 touched 数量

### 影响

- review item 不再互相吞证据
- 自动关闭更安全
- dashboard / trace 统计语义一致

---

## 五、建立真实 runtime/prompt 集成护栏

### 现状问题

当前 workflow 主测试大量 mock stage runner，只能验证编排，不能验证：

- 真正的 prompt bundle 是否能加载
- `skill.toml` contract 是否匹配
- budget trimming 是否破坏关键证据
- parser / canonicalize / quality 实际是否联通

### 设计决策

新增真实 runtime 集成测试，只 fake LLM adapter，不 fake stage runner。

### 覆盖目标

至少覆盖以下路径：

1. character discovery 正常跑通真实 bundle
2. segment scripting 正常加载真实 prompt
3. quality stage 在无冲突 alias 命中时 auto pass
4. contract mismatch / prompt variable 缺失会明确 fail

### 影响

- future prompt/skill 修改会被真实测试拦住
- 不再只依赖 mock workflow suite 的“假绿色”

---

## 风险与缓解

### 风险 1：alias 收紧后，旧数据里的简称命中率下降

缓解：

- 先把自动变体降级成弱证据，不是直接删掉
- 用测试覆盖“显式 alias 仍能正常命中”

### 风险 2：manual review item 签名化后，短期内待审项数量上升

缓解：

- 这是把被覆盖的真实问题显式化，不是新引入问题
- summary 中同时输出 touchedCount 和 pendingCount，方便观测变化

### 风险 3：更多结构错误暴露后，repair 流量上升

缓解：

- 这是正确方向，先把 silent fallback 拉回 repair
- 用预算与 quality gate 测试确保不会因为修复而造成新死循环

---

## 验收标准

本轮设计落地后，必须满足：

1. 空 character discovery draft 不再导致 workflow 误失败。
2. `discovery_refresh` snapshot 的 `source` 与 `diagnostics` 一致。
3. 唯一且无冲突的显式 alias 命中不再无条件进入 manual review。
4. 缺失 `speaker` 会触发 repair，而不是自动补 `未知`。
5. 同段不同失败签名可并存，不再互相覆盖。
6. 自动关闭 review item 时不会再按 segment 粗暴全关。
7. workflow summary 能回放逐次 stage prompt metadata。
8. 存在至少一条真实 runtime/prompt 集成测试覆盖主链关键契约。

---

## 最终结论

这次整改的重点不是“补更多 guardrail”，而是把几个一直被混用的概念拆开：

- 空结果 vs 真故障
- 显式 alias vs 启发式变体
- 结构错误 vs 业务值
- 当前 touched 数 vs 当前 pending 总量
- 本轮成功 vs 历史问题全部解决

只要这几个边界重新被写清楚，当前 review 发现的绝大多数问题都会自然收敛，而不是继续在每个 stage 上长出新的特殊分支。
