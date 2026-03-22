# Handoff 2026-03-17 Phase 2 Round 1

## 基本信息

- 日期：2026-03-17
- 轮次：Phase 2 / Round 1
- 阶段：阶段 2：台本 -> 音频 生成稳定性收敛
- 分支：codex/phase-2-audio-reliability
- 对应 task：`docs/task/2026-03-17-phase-2-round-1-audio-runtime-policy.md`

## 本轮已完成内容

- 新增 provider 级 runtime policy：
  - `indextts / cosyvoice / voxcpm / mixed` 现在都有独立的 `firstPassConcurrency / retryPassConcurrency / rescuePassConcurrency / cooldownMs / synthProbe`
- 新增 retry pass 规划：
  - 批量音频生成统一为 `pass-1 / pass-2 / pass-3`
  - `pass-2` 与 `pass-3` 只针对失败句继续补跑
- 新增真实 synth probe：
  - `tts-runtime-probe` 能对 `indextts / cosyvoice / voxcpm` 执行最小真实合成探针
  - `/api/tts/providers/status` 默认仍走轻量 health check，显式 `probe=true` 时才追加 synth probe 结果
- `audio-generator` 已支持 `generateBatchAudioWithReliability()`：
  - 保持最终结果顺序不变
  - 输出 `firstPassSuccessRate / retryRounds / averageDurationMs / providerFailures / passSummaries`
- `audio-generation-runner` 已把 reliability 摘要写入 `processingTask.taskData.metadata.audioReliability`
- 本轮 build 阶段顺手修复了一个现存的 Next 16 构建阻塞：
  - 首页 `/` 使用 `useSearchParams()` 但没有 Suspense boundary
  - 已通过 `apps/web/src/app/page.tsx` 的最小包装修复，不涉及业务逻辑调整

## 变更清单

- 代码变更：
  - `apps/web/src/lib/audio-runtime-policy.ts`
  - `apps/web/src/lib/audio-retry-plan.ts`
  - `apps/web/src/lib/tts-runtime-probe.ts`
  - `apps/web/src/lib/audio-generator.ts`
  - `apps/web/src/lib/audio-generation-runner.ts`
  - `apps/web/src/app/api/tts/providers/status/route.ts`
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/lib/__tests__/audio-runtime-policy.test.ts`
  - `apps/web/src/lib/__tests__/audio-retry-plan.test.ts`
  - `apps/web/src/lib/__tests__/tts-runtime-probe.test.ts`
  - `apps/web/src/lib/__tests__/tts-provider-status-route.test.ts`
  - `apps/web/src/lib/__tests__/audio-generator-reliability.test.ts`
  - `apps/web/src/lib/__tests__/audio-generation-runner-reliability.test.ts`
- 文档变更：
  - `docs/plans/2026-03-17-phase-2-audio-reliability-round-1-design.md`
  - `docs/plans/2026-03-17-phase-2-audio-reliability-round-1.md`
  - `docs/task/2026-03-17-phase-2-round-1-audio-runtime-policy.md`
  - `docs/handoff/2026-03-17-phase-2-round-1-audio-runtime-policy.md`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-generator-reliability.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts src/lib/__tests__/audio-generation-runner-manual-review.test.ts src/lib/__tests__/audio-engine-router.test.ts src/lib/__tests__/task-replay-payload-audio.test.ts src/lib/__tests__/auto-pipeline-runner.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build
- 执行命令：见“已执行验证”
- 结果：
  - Phase 2 Round 1 新增策略、探针、runner reliability 回归全部通过
  - broader verification 共 `9` 个 suite、`25` 个测试通过
  - `typecheck` 通过
  - `build` 通过
- 是否通过：是
- 阻塞 / 备注：`baseline-browser-mapping` 版本提示仍为非阻塞告警

## 结果与结论

- 这一轮把 Phase 2 从“只有全局 batchSize 的单轮批跑”推进成了“provider runtime policy + 三阶段补跑 + 真实 synth probe + reliability telemetry”的可验证框架。
- 当前实现已经能把 provider 承载能力显式化，并把首轮成功率、补跑轮次和 provider 失败分布沉淀到任务 metadata，为下一轮真实书籍收敛验证提供数据地基。
- 用户已明确“开发不用考虑兼容历史数据”，因此本轮实现默认面向新策略和新 metadata 结构，不额外为旧历史任务数据做迁就设计。

## 遗留问题

- 当前 runtime policy 仍是静态保守值，尚未结合真实远端运行数据做二次调参。
- provider status route 的 synth probe 目前是显式触发模式，尚未沉淀成 runbook 或验收脚本。
- reliability metadata 已入 taskData，但还没有配套 review / metrics 页面消费这份数据。

## 风险判断

- `audio-generator.ts` 与 `audio-generation-runner.ts` 仍然偏大；虽然这轮已抽出 `audio-runtime-policy`、`audio-retry-plan`、`tts-runtime-probe`，但后续若继续往里堆逻辑，会重新回到复杂度泥团。
- 当前 `providerFailures` 统计的是所有尝试中的失败次数，而不是仅最终失败；这对 Phase 2 稳定性分析是有价值的，但后续消费端需要明确这个语义，避免误读。

## 下一轮建议目标

- 用真实 provider 跑一次整书或章节级正式验证，把 `firstPassSuccessRate / retryRounds / providerFailures / averageDurationMs` 写入 Phase 2 review。
- 若 `voxcpm` 仍明显低于其他 provider，优先把 runtime policy 与实际 provider 绑定，而不是继续提高全局 `batchSize`。
- 视验证结果决定是否在下一轮把 reliability 指标接入 review workbench / dispatch metrics。
