# Failed Segment Refinement Design

## 背景

Phase 1 closeout 已证明 `uploads/sample.txt` 在 `limitToSegments=10` 条件下，3 次真实样本回归都稳定收敛到：

- 24 条 script lines
- 7 个 failed segments
- 7 个 pending `SCRIPT_VALIDATION`

这意味着问题不是随机波动，而是结构性失败。失败主因主要集中在：

- `TEXT_SOURCE_MISMATCH`
- `NON_WHITESPACE_GAP`
- 少量 `SOURCE_NOT_FOUND`

这些失败段的共同特征是：单段里混有旁白、对白、归属语、动作语和多句切换，现有 risk profile 虽然会收紧长度，但还不够细，无法把高风险混合段拆到 LLM 足够稳定的粒度。

## 目标

- 只对真实失败段做更细粒度重试，而不是把整本都切得更碎。
- 保持现有 prompt / validator / manual review 语义不变。
- 把 closeout 样本当前稳定的 `7/10 failed segments` 明显压下去。

## 方案比较

### 方案 A：全局更激进切段

在 `text-processor` 阶段就把高风险段统一切得更小。

优点：实现位置单纯。

缺点：所有书都要承担额外调用成本和段数膨胀，副作用大。

### 方案 B：失败段二次细分重跑（推荐）

首轮仍按当前分段策略跑，只有当 validator 命中高风险错误时，才对该段做细分并重跑子段。

优点：只打真实失败段，副作用最小；更符合 closeout 需要的“精准收口”。

缺点：流程更复杂，需要处理子段结果如何映射回父段。

### 方案 C：放宽 validator

优点：短期通过率可能提升。

缺点：会直接破坏 Phase 1 的“确定性守门员”目标，属于错误方向。

## 选择

采用方案 B。

## 设计

### 1. 新增失败段细分 helper

新增一个纯 helper，输入：

- 父段 `content`
- 父段 `id/chapterId/orderIndex`
- 失败原因（issue codes / coverage）

输出：

- 若干子段切片，每个子段保留：
  - `id`（临时 synthetic id）
  - `content`
  - `offsetStart`
  - `offsetEnd`
  - `parentSegmentId`

切分优先级：

1. 引号边界
2. 句子边界（`。！？；.!?…`）
3. 归属语切口（如 `某某说：` / `他道：` / `她问：`）

### 2. 触发条件严格收边界

只有满足以下条件时才触发二次细分：

- 首轮失败是 `TTSError`
- `error.details.errorCode === SCRIPT_VALIDATION_FAILED`
- `issueCodes` 命中：
  - `TEXT_SOURCE_MISMATCH`
  - `NON_WHITESPACE_GAP`
  - `SOURCE_NOT_FOUND`
- 且当前段还没有做过 refinement

### 3. 子段仍走原有 `processSegment`

子段不使用另一套逻辑，不开后门：

- 仍然调用现有 LLM prompt
- 仍然走现有 validator
- 只有通过 validator 的子段才合并
- 仍失败则回退原始错误，继续 manual review

### 4. 子段结果回写到父段

子段成功后：

- 所有 `dialogueLines` 的 `segmentId` 回写为父段 `segmentId`
- `orderInSegment` 重新按合并顺序编号
- `sourceStart/sourceEnd` 加上子段 `offsetStart`，恢复为相对父段的位置

然后仅对父段执行一次 `saveSegmentScriptToDatabase()`，避免产生不存在的子段 ID 污染数据库。

### 5. closeout 验收方式

目标不是零失败，而是：

- `uploads/sample.txt(limitToSegments=10)` 的 3 次运行仍然收敛
- 但 `failed segments` 从当前 7 明显下降
- 同时不引入新的错误落库

## 不做的事

- 不修改 Prompt 契约
- 不放宽 validator
- 不改变 manual review item 的分类语义
- 不在 text processor 阶段全局改切段策略

## 风险

- 子段 synthetic id 若泄漏进数据库，会污染 `scriptSentence.segmentId` 关系，因此必须只在内存里使用。
- 子段切分过碎会让 prompt 丢失上下文，因此必须只用于已失败段，且优先使用句界与引号界而不是字符硬切。

## 验证

- 新增 refinement helper 单测
- 新增 `processSegmentAndSave` 或 workflow 级回归，证明失败段可被二次细分后转绿
- 既有 `segment-processor` / `script-workflow` / `script-generation-runner` 回归通过
- `pnpm --filter web typecheck`
- `pnpm --filter web build`
