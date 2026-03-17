# Quote-Safe Segmentation Design

## 背景

Round 10 的 failed-segment refinement 已经证明：

- 失败段二次细分重跑路径是有效的
- 但真实样本里仍有一类失败段，refinement 也救不回来

根因不是 validator 太严，而是更上游的 `smart-text-splitter` 已经把引号对白切坏了。真实样本中可以稳定观察到这类 segment：

- `本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”`
- `但不知道拿到了祸首该如何处置，还望宗主示下。”`

这种 segment 在进入 script generation 之前就已经失真，只剩“半句对白 + 右引号”或“动作语被拆走”的残缺切片。后面的 prompt、validator、refinement 都只能在坏地基上补丁。

## 目标

- 在 text segmentation 阶段避免把引号对白从内部切断。
- 保持现有风险画像（引号密度 / 句子数量 / 对白密度）不变，只补一条“引号安全边界”硬规则。
- 让 Phase 1 closeout 的真实样本失败段数量从当前稳定的 `7/10` 明显下降。

## 方案比较

### 方案 A：继续增强 failed-segment refinement

优点：作用于失败段，改动局部。

缺点：无法修复“父段本身已被切坏”的根因，只能补下游症状。

### 方案 B：给 smart splitter 增加引号安全边界（推荐）

优点：直接修地基；所有后续 LLM/validator/refinement 都建立在更健康的 segment 上。

缺点：需要确保不会过度抑制合理分段，导致段落过长。

### 方案 C：在 text processor 阶段关闭 smart splitter，回退传统切段

优点：实现快。

缺点：会丢掉现有动态规划和长度均衡收益，属于明显回退。

## 选择

采用方案 B。

## 设计

### 1. 句子切分时维护 quote state

在 `smart-text-splitter.ts` 的：

- `splitIntoSentenceInfos()`
- `splitIntoSentences()`

中维护一个简化的 quote stack：

- 如果当前位于未闭合引号内部，则即便遇到 `。！？；.!?…` 也不立刻断句
- 只有当引号闭合后，才允许在该句界断开

### 2. 强制切段时避开引号内部标点

在 `forceSplitLongText()` 向前寻找标点时：

- 只允许选择 quote-safe 的标点作为切点
- 若最近的标点都落在未闭合引号内，则继续向前找，直到找到安全边界

### 3. 不额外改风险画像

`resolveTextSegmentationRiskProfile()` 继续保留：

- `quoteRatio`
- `sentenceCount`
- `dialogueLineCount`

它只负责收紧长度上限，不负责最终断点是否合法。合法性由 quote-safe sentence splitting 负责。

### 4. 验收方式

先用单测证明：

- 对话内部的 `！/？` 不会导致 segment 在引号中间断开
- `createChapterSegmentRecords()` 产出的 segment 不再出现“只剩右引号的残缺对白尾巴”这类坏段

然后再用真实样本 `uploads/sample.txt(limitToSegments=10)` 回归，观察：

- `failed segments`
- `pending SCRIPT_VALIDATION`
- 主 `scriptSubtype`

是否相对当前基线下降。

## 不做的事

- 不修改 validator 规则
- 不删除 refinement
- 不切回传统 splitter
- 不改 review workbench

## 风险

- 如果 quote-safe 规则太保守，可能导致 segment 偏长，影响长度均衡。
- 如果只处理 `“”` 而忽略 `'`/`「」`/`『』`，仍可能漏掉部分文本结构。

## 验证

- `smart-text-splitter` 新增引号安全切段测试
- `text-processor-script-correctness` 新增“不会产出残缺引号段”测试
- 既有 regression / typecheck / build 通过
- 真实样本 closeout 指标更新
