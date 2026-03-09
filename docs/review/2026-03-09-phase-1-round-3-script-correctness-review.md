# Review 2026-03-09 Phase 1 Round 3

## 基本信息

- 日期：2026-03-09
- 分支：`codex/phase-1-script-correctness`
- 对比基线：`main`
- merge base：`7ed32167221197b28fc10d2fa700c042da10ecb4`
- 结论：`patch is incorrect`

## 总体判断

这轮补丁已经把上一轮几个明显回归补上了：归属型对白切片可以通过、`maxDialogueLength` 重新成为硬上限，`build` / `typecheck` / 相关单测在当前工作树也都能跑通。

但从本轮 patch 本身看，仍然有 3 个离散问题会让作者大概率愿意继续修：

1. 纯引号短回复如果没有标点，会绕过 `QUOTED_NARRATION` 守门并被当成旁白落库。
2. 只要原文里恰好出现一组引号，校验器就会把引号内文本一律当成真正朗读内容，导致“叙述 + 引号展示文本”可被误收成对白。
3. 英文省略、所有格与年代写法里的 apostrophe 仍会被计入对白密度，继续错误收紧切段策略。

## Findings

### [P1] Reject bare quoted replies without punctuation

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts:155`
- 问题：`isLikelySpeechQuotedText()` 现在只在引号内容带有标点时，才把“纯引号文本 + 旁白”视为可疑对白。结果像 `“嗯”`、`“好”`、`“走”` 这种极短回应，如果 LLM 标成 `speaker: 旁白`，当前校验会直接放行。
- 影响：这类短回应在小说里非常常见，而 prompt 又明确要求“极短语气词、短回答也必须保留”，所以这不是边角 case。当前实现会让一类高频对白/旁白混抽静默漏检，并把错误句子直接落库。
- 建议方向：`QUOTED_NARRATION` 的判定不要只依赖标点；至少要把常见短回复、语气词、单字回答也纳入“明显像对白”的检测范围。

### [P2] Don't treat any single quoted body as spoken dialogue

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts:134`
- 问题：`resolveDialogueText()` 现在只要发现 `sourceText` 里恰好有一组引号，就直接返回引号内部文本。于是像 `广告牌上写着“营业中”。`、`门上贴着“禁止入内”。` 这样的旁白句，只要 LLM 把 `speaker` 误标成某个角色，校验器就会接受 `text: 营业中` / `禁止入内`。
- 影响：校验阶段仍然按整段 `sourceText` 计算 coverage，但真正落库时只保存引号内短语，外围叙述被静默丢失。这直接破坏了本轮补丁试图建立的“100% 原文覆盖”保证。
- 建议方向：不要把“存在一组引号”直接等价成“引号内就是朗读正文”；至少要区分“归属型对白切片”和“叙述句内嵌展示文本”这两类结构，再决定是否允许只读引号体。

### [P2] Stop counting non-dialogue apostrophes as quote density

- 文件：`apps/web/src/lib/text-segmentation-profile.ts:42`
- 问题：当前 apostrophe 过滤只跳过“两侧都为 ASCII 单词字符”的场景，因此 `boys'`、`'90s`、`rock 'n' roll` 这类并非对白引号的写法仍会增加 `quoteCount`。例如 `rock 'n' roll isn't dead.` 已经会把 `quoteRatio` 顶到 `0.08`，直接触发 `dialogue_dense`。
- 影响：没有对白的英文叙述也会被误判成高风险章节，导致切段更碎、LLM 调用次数增加、TTS 成本变高，而且不会带来任何正确性收益。
- 建议方向：不要把这类非成对、非对白语义的 apostrophe 计入对白密度；如果确实要支持英文引号，至少需要基于更严格的成对边界或上下文规则，而不是按单字符近邻直接计数。

## 审查备注

- 本地验证命令：`pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts`、`pnpm --filter web typecheck`、`pnpm --filter web build`。
- 上述命令在当前工作树可以通过；`build` 期间仍会打印既有的 TTS provider 初始化失败日志，但不影响这 3 个 patch 级问题的判断。
- 其中第 1、2 项都属于 script correctness 主链路的真实输入回归，建议优先处理；第 3 项偏成本与切段策略回归，但同样是可以稳定复现的离散问题。
