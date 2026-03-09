# Handoff 2026-03-08 Phase 1 Round 1

## 基本信息

- 日期：2026-03-08
- 轮次：Phase 1 / Round 1
- 阶段：阶段 1：原文 -> 台本 正确性重建
- 分支：codex/phase-1-script-correctness
- 对应 task：docs/task/2026-03-08-phase-1-round-1-script-correctness.md

## 本轮已完成内容

- 收紧段落级台本生成 prompt，明确要求完整覆盖、禁止改写、禁止重复抽取，并强制返回 `sourceText` 原文切片。
- 新增段落级 Script Validator，在落库前校验原文覆盖率、重复抽取、对白/旁白混抽与改写漂移。
- 台本映射改为优先使用 `sourceText` 回写真实文本，避免把 LLM 改写文本直接落库。
- 增加对白密集段的风险画像，自动缩小分段粒度并把风险参数写入章节/段落 metadata。
- 补齐 Phase 1 首批回归测试，覆盖漏内容、重复对白、对白/旁白混抽、长段高风险切段。
- 根据 review 修复两处离散回归：书名号标题旁白不再误判为对白，英文缩写撇号不再触发对白密度统计。
- 根据 round 2 review 继续修复三处链路问题：归属型对白切片允许通过校验、`maxDialogueLength` 恢复为显式硬上限、纯引号旁白只在“明显像对白”时才拦截。
- 根据 round 3 review 继续修复三处离散问题：短回复型纯引号旁白重新拦截、引号展示文本不再被当成对白正文、英文年代/所有格/`rock 'n' roll` 类 apostrophe 不再触发对白密度统计。

## 变更清单

- 代码变更：
  - `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
  - `apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts`
  - `apps/web/src/lib/text-processor.ts`
  - `apps/web/src/lib/text-segmentation-profile.ts`
  - `apps/web/src/lib/__tests__/segment-script-validator.test.ts`
  - `apps/web/src/lib/__tests__/segment-processor.test.ts`
  - `apps/web/src/lib/__tests__/text-processor-script-correctness.test.ts`
  - `apps/web/src/lib/__tests__/script-generator.test.ts`
- 配置变更：无
- 数据变更：无
- 运行时操作：无

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/segment-script-validator.test.ts src/lib/__tests__/segment-processor.test.ts src/lib/__tests__/text-processor-script-correctness.test.ts src/lib/__tests__/audiobook-regression.test.ts src/lib/__tests__/script-generator.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`
- 针对 review 问题补充新增单测：标题型旁白合法通过、英文 apostrophe 不进入对白密度统计、归属型对白切片合法通过、超长台词显式失败、短回复型纯引号旁白重新拦截、展示型引号文本误抽被拒绝

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck
- 执行命令：见“已执行验证”
- 结果：相关测试全部通过；`typecheck` 通过；`next build` 通过
- 是否通过：是
- 阻塞 / 备注：测试输出里仍有预期内的 `console.warn` / `console.info`，用于暴露台本校验失败与分段统计

## 结果与结论

- Phase 1 第一批改动已经把“JSON 能解析”升级为“台本必须能映射回原文才能落库”。
- 当前链路已经能阻断明显的改写、漏抽和重复抽取，避免错误台本直接污染 `script_sentences`。
- 分段策略虽未完全重写，但已经对对白密集段做了更保守的长度收紧，为后续进一步细化切段规则打下基础。

## 遗留问题

- 目前 validator 仍是段落级顺序匹配，尚未输出独立的 Script QC 结果或 manual review item。
- `apps/web/src/lib/text-processor.ts` 与 `apps/web/src/lib/smart-text-splitter.ts` 文件仍偏大，后续适合继续拆分，降低脆弱性。
- prompt 契约已经收紧，但线上真实模型是否稳定遵守 `sourceText` 还需要实书样本回归。

## 风险判断

- 短期风险：线上模型如果频繁不返回 `sourceText`，失败段数量会先升高；这是“显性失败替代隐性脏数据”，方向正确。
- patch 级别的文件纳入问题不属于代码逻辑缺陷；当前工作树里新增模块已经存在，后续只需确保最终提交/PR 不遗漏这些新增文件。
- 中期风险：对白密集段切得更细，会增加 LLM 调用次数，需要在后续阶段结合成本与耗时观察。

## 下一轮建议目标

- 把 validator 失败结果沉淀为结构化失败原因，接入 task metadata / manual review 队列。
- 继续细化高风险分段策略，增加“对白密度 + 句子数 + 引号边界”联合切段测试样本。
- 用真实问题文本补一轮回归样本，验证多次运行下句子数和失败率是否收敛。
