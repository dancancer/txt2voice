# Review 2026-03-08 Phase 1 Round 2

## 基本信息

- 日期：2026-03-08
- 分支：`codex/phase-1-script-correctness`
- 对比基线：`main`
- merge base：`7ed32167221197b28fc10d2fa700c042da10ecb4`
- 结论：`patch is incorrect`

## 总体判断

这次改动把“台本必须可回溯到原文”正式拉进了生成链路，方向没有问题，而且本地 `jest` / `typecheck` / `next build` 在当前工作树里也能跑通。

但从补丁本身看，仍有 4 个作者大概率会愿意立即修掉的问题：

1. 补丁引用了多个新的本地模块，但这些文件没有进入被审查的 patch，导致 clean checkout/CI 无法还原这次改动。
2. 校验器把“叙述动词 + 引号对白”这种常见中文写法整体判成改写，真实小说段落会被整段拦截。
3. 原先由调用方传入的 `maxDialogueLength` 上限被移除，长句会直接落库并一路进入 TTS。
4. 旁白中的纯引号文本会被一刀切判成对白混抽，标题或强调文本会被误杀。

## Findings

### [P0] Add the newly imported local modules to the patch

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts:9`
- 问题：当前补丁新增了 `./segment-script-validator`、`./text-segmentation-profile`、`./components` 等本地依赖，但这些文件没有出现在审查 patch 里。对 reviewer/CI 来说，这不是“风格问题”，而是补丁不自洽：干净检出后这些 import 无法解析。
- 影响：在只应用本次 patch 的环境里，`next build` 会直接因为模块缺失而失败，新的 script correctness 逻辑根本没有机会执行。
- 建议方向：把所有新增本地模块显式纳入同一个提交/补丁；如果是重命名或拆文件，也要保证 diff 中包含 rename/add，而不是只留下引用方修改。

### [P1] Accept attributed dialogue spans before hard-failing a segment

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts:177`
- 问题：现在 `validateSegmentScript()` 一旦发现 `text !== normalized(sourceText)` 就会直接抛错。但中文小说里非常常见的结构是：`张三说：“你好。”`。LLM 若输出 `sourceText: 张三说：“你好。”`、`text: 你好。`、`speaker: 张三`，其实仍然是忠于原文的抽取，只是把“归属说明”和“真正朗读内容”放在了同一连续切片里。
- 影响：这类段落会被整个判失败，而不是只损失一条句子。对白归属写法在中文网文和出版文本里都很高频，所以这不是边缘 case。
- 建议方向：在严格校验前，先允许“带归属前后缀的连续对白切片”这种合法形态，例如把连续原文中的引号正文提取出来再比对，或给 attributed span 单独放宽规则。

### [P2] Preserve the caller's max dialogue length cap

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts:301`
- 问题：这里把旧逻辑里基于 `minDialogueLength` / `maxDialogueLength` 的过滤，改成了仅保留 `trim().length > 0`。但前端工作台仍然在请求里显式传 `maxDialogueLength: 200`，这说明调用方仍然依赖这个上限来约束单句尺寸。
- 影响：只要模型返回了未拆开的长句，这次补丁就会原样持久化，并在后续 `/api/books/[id]/script/[sentenceId]/audio` 中作为单条 TTS 输入发送。这样等于静默废掉了调用方唯一还在传递的长度约束。
- 建议方向：至少保留 `maxDialogueLength` 的硬上限；如果为了“保真”不想直接丢弃长句，也应该把它转成显式错误或重切分，而不是无条件放行。

### [P2] Don't reject quoted narrator lines that are not speech

- 文件：`apps/web/src/lib/script-generator/pipeline/segment-processor.ts:177`
- 问题：新的校验流程会把“旁白 + 整段被引号包裹的文本”统一判成 `QUOTED_NARRATION`。这会误杀很多并不是对白的内容，比如 `"三体"`、强调词、章节标题或引用式展示文本；这些句子明明和原文一一对应，却仍然会被整段拦截。
- 影响：一旦正文里有这种标题型/强调型引号文本，段落就会失败，属于真实输入下会触发的功能回归。
- 建议方向：`QUOTED_NARRATION` 只该拦截“明显是对白却被标成旁白”的情况，而不是把所有纯引号文本一概视为对白；至少需要区分对白引号与标题/强调用法。

## 审查备注

- 本地验证命令：`pnpm --filter web test -- --runInBand src/lib/__tests__/script-generator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts`、`pnpm --filter web typecheck`、`pnpm --filter web build`。
- `build` 在当前工作树可通过，但这不抵消 “patch 未包含新增依赖文件” 这个补丁级问题；review 关注的是相对 `main` 的可还原性。
