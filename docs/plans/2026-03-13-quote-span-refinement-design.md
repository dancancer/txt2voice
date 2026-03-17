# Quote-Span Refinement Design

## 背景

Round 11 已经把上游 `smart-text-splitter` 的普通引号断句做成 quote-safe，但基于最新代码的真实样本日志表明，剩余失败仍集中在两类结构：

1. `动作语/旁白 + 引号对白 + 后续旁白` 的混排段
2. `同一组引号内部跨多句` 的长 quoted span

这些段进入 `failed-segment refinement` 后仍会被拆得不够聪明：

- 有时 narration 片段被切得过碎，增加无意义 LLM 调用
- 有时整块 quoted span 过长，仍然带着多个句界一起失败

## 目标

- 让 refinement 更接近语义切片，而不是机械切碎。
- 对 attributed dialogue / narration 混排段，优先切成“动作语 / quoted span / narration”三类块。
- 对跨多句的长 quoted span，再进一步按内部句界拆小，降低单块失败概率。

## 方案比较

### 方案 A：继续把 refinement 当成简单 sentence split

优点：实现简单。

缺点：对真实失败段不够聪明，仍会出现长 quoted span 整块失败或 narration 过碎。

### 方案 B：给 refinement 增加 quote-span aware 语义切分（推荐）

优点：只作用于失败段，副作用最小；同时能显著提升 attributed dialogue 的可重试性。

缺点：逻辑更复杂，需要更多针对性测试。

### 方案 C：回退去改 Prompt/Validator

优点：看似直接。

缺点：当前失败模式已经很明确地落在“切片形态不佳”，不是 prompt/validator 主合同先天错误。

## 选择

采用方案 B。

## 设计

### 1. attributed dialogue 语义切片

对这类结构：

- `她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”闵弘芳又一拍手……`

优先切成：

1. 动作语 / 归属语前缀
2. quoted span
3. 后续 narration

### 2. 长 quoted span 内部继续拆小

对这类结构：

- `“本宫昨夜……遗诏。本宫继位已逾百年……两杯。”`

若单个 quoted span 内部包含多个句界，则继续按内部句界拆成：

- `“本宫昨夜……遗诏。`
- `本宫继位已逾百年……两杯。”`

要求保持：

- 子段仍是原文真实子串
- 不凭空补写字符
- 即便引号不平衡也允许，因为 refinement 是为 validator 服务的重试切片，不是最终落库 segment

### 3. 连续 narration 合并

对于连续且不含引号的 narration 子段，允许合并成更大的语义块，避免把纯 narration 切成太多零碎调用。

## 不做的事

- 不改 `smart-text-splitter`
- 不放宽 validator
- 不引入新的手工修复 UI

## 验证

- `failed-segment-refinement` 单测覆盖 attributed dialogue / long quoted span 两类结构
- `segment-processor-refinement` 证明 refinement 后结果仍能安全映射回父段落库
- broader regression / typecheck / build 全过
