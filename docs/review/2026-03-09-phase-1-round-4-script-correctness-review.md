# Review 2026-03-09 Phase 1 Round 4

## 基本信息

- 日期：2026-03-09
- 分支：`codex/phase-1-script-correctness`
- 对比基线：`main`
- merge base：`7ed32167221197b28fc10d2fa700c042da10ecb4`
- 结论：`patch is incorrect`

## 总体判断

这轮复审里，主干思路仍然是对的：补丁已经把“台本必须可回溯到原文”这条约束真正落到了校验器里，也把 `sourceText` / coverage / 超长台词这类关键护栏补了起来。

但当前版本还有两个作者大概率会愿意立刻修的离散问题：

1. prompt 对“带归属语的对白切片”给出的合同，和 validator 真正接受的格式不一致。
2. `QUOTED_NARRATION` 的启发式过猛，会把一类合法的“带引号的旁白文本”误判成对白混抽。

这两个问题都不是代码风格或抽象偏好，而是会把真实输入打成失败段落，直接影响 script correctness 主链路，所以整体结论仍然是 `patch is incorrect`。

## Findings

### [P1] Make the dialogue-text rule match attributed-speech validation

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts:78`
- 现象：system prompt 的第 6 条现在写的是：`dialogue 的 text 只允许去掉最外层引号，其余文字必须与 sourceText 一致`。这条规则对纯对白切片没问题，比如 `“你好。” -> 你好。`。但对 `张三说：“你好。”` 这种“归属语 + 对白”混在同一个 `sourceText` 里的输入，这条描述会自然诱导模型返回 `张三说：“你好。”` 或 `张三说：你好。` 之类仍然保留归属语的 `text`。
- 本质：校验器并不接受这个合同。`validateSegmentScript()` 对这类 attributed dialogue 现在只接受真正可朗读的对白正文，也就是 `你好。`。于是 prompt 和 validator 出现了结构性分叉：模型按 prompt 输出，validator 却按另一套规则拒绝。
- 为什么这是 bug：这不是“模型偶尔不听话”，而是我们自己在同一条链路里定义了两套互相冲突的规格。只要模型更忠实地执行 prompt，这段就会被误判成 `TEXT_SOURCE_MISMATCH`，从而整段失败。小说里“他说 / 她问 / 他低声道：‘……’”是高频句型，所以这不是边角输入，而是主路径会遇到的常规文本。
- 典型触发输入：`张三说：“你好。”`、`“走吧。”他站起身。`、`张三挥了挥手：“明天见。”`
- 修正方向：要么把 prompt 改成和 validator 一致，明确说明“当 `sourceText` 含归属语时，dialogue 的 `text` 只能保留真正说出口的对白正文”；要么放宽 validator，接受与 prompt 一致的另一种输出。但两边必须只保留一套规则，不能再让 prompt 说 A、validator 执行 B。

### [P2] Allow punctuated quoted narration when no speaker exists

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts:188`
- 现象：`isLikelySpeechQuotedText()` 现在的判断条件非常激进。只要文本是“纯引号包裹”，并且引号内带有常见标点或匹配短回复模式，它就会被视为“明显像对白”。随后一旦 `speaker === "旁白"`，校验器就直接报 `QUOTED_NARRATION`。
- 本质：这里把“像对白”误当成了“必然存在说话人”。但原文里确实存在很多没有说话人的、却必须保留引号形式的旁白文本：标语、牌子上的字、题词、章节引语、被强调的书名或口号，甚至某些 epigraph / 引文块。对这些内容来说，最忠实的映射恰恰就是 `speaker: 旁白` 且 `text === sourceText`。
- 为什么这是 bug：当前实现会把合法输入直接打成失败段落，而不是更保守地放行。这和本轮补丁强调的“100% 原文覆盖”目标是反着来的：原文明明可以被正确朗读，却因为启发式过度自信，被系统拒收。像 `“紧急出口！”`、`“禁止入内。”` 这种带标点的标识文本尤其容易触发。
- 典型触发输入：`“紧急出口！”`、`“禁止入内。”`、`“献给所有清醒的人。”`
- 修正方向：`QUOTED_NARRATION` 不应该只凭“纯引号 + 标点”就判死刑。更稳妥的做法是把“是否存在说话人痕迹”纳入判断，例如是否有归属语、是否在上下文里构成对话轮次、是否出现典型发言动词；只有这些证据同时成立时，再把旁白标注判成可疑。否则应优先允许 faithful narration 通过。

## 审查备注

- 这轮结论聚焦于当前 patch 还剩下的 2 个真实 correctness 问题，不再重复上一轮已经覆盖、且本轮已不再成立的旧问题。
- 本地参考验证包括：`git diff 7ed32167221197b28fc10d2fa700c042da10ecb4`、`pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/script-generator.test.ts`、`pnpm --filter web typecheck`、`pnpm --filter web build`。
- 当前工作树中测试、`typecheck` 和 `build` 可以通过；因此这两个 finding 不是“构建不过”的显性故障，而是输入语义层面的回归，更值得优先处理。
