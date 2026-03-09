# Review 2026-03-08 Phase 1 Round 1

## 基本信息

- 日期：2026-03-08
- 分支：`codex/phase-1-script-correctness`
- 对比基线：`main`
- merge base：`7ed32167221197b28fc10d2fa700c042da10ecb4`
- 结论：`patch is incorrect`

## 总体判断

本次改动的主方向是对的：台本生成链路开始从“只要 JSON 能 parse”升级到“必须可映射回原文才能落库”，这能显著减少隐性脏数据。

但当前补丁引入了两个会在真实输入上触发的离散回归：

1. 合法的标题型旁白文本会被误判成“旁白承载对白”，导致整个段落被拦截。
2. 英文普通叙述中的 ASCII 撇号会被当作对白引号计数，错误触发高风险切段，增加不必要的分段、LLM 调用与后续 TTS 成本。

## Findings

### [P1] Don't reject narrator lines that are title-only text

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts:157`
- 问题：`validateSegmentScript()` 现在会把“整个 `sourceText` 被一对引号包裹”的旁白句直接判成 `QUOTED_NARRATION`。但当前 `isPureQuotedText()` 把 `《...》` 也视为引号，因此像 `《三体》`、`《第一章》` 这类合法标题型旁白会被错误拦截。
- 影响：只要段落里存在这类标题型旁白，整段台本都会校验失败并被丢弃，不是边角 case，而是中文书籍里非常常见的输入形态。
- 触发示例：

```text
segmentContent: 《三体》
scriptSentences:
- sourceText: 《三体》
  text: 《三体》
  speaker: 旁白
```

- 建议方向：把 `《》` 从“对白引号”集合里排除，或在 `QUOTED_NARRATION` 判定里只处理真正的对白引号，而不是把书名号/标题标记一起算进去。

### [P2] Stop counting ASCII apostrophes as dialogue quotes

- 文件：`apps/web/src/lib/text-segmentation-profile.ts:47`
- 问题：新的对白密度画像把 ASCII `'` 也计入 quote 统计。结果是英文普通叙述里像 `I'm`、`don't`、`we'll` 这样的缩写会被当成“对白引号”，抬高 `quoteRatio`，甚至跨过 `mixed_dense_scene` 的阈值。
- 影响：没有对白的英文正文也会被误判为高风险章节，导致切段更碎、LLM 调用次数增加、TTS 成本和时延上升，但并没有带来任何正确性收益。
- 触发场景：连续英文叙述，包含大量缩写或所有格，例如：`I'm sure it's fine, don't worry. We'll see...`
- 建议方向：不要把裸 ASCII `'` 作为对白引号统计；如果确实要支持英文引号，至少需要基于词边界或成对引号做更严格的识别，而不是直接字符计数。

## 审查备注

- 已本地验证相关新增测试可以通过，但这两个问题不在现有测试覆盖内。
- 其中第一项属于功能性回归，优先级更高，建议先修。
