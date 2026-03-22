# Handoff 2026-03-18 Phase 2 Round 2

## 基本信息

- 日期：2026-03-18
- 轮次：Phase 2 / Round 2
- 阶段：阶段 2：台本 -> 音频 生成稳定性收敛
- 分支：codex/phase-2-audio-reliability
- 对应 task：`docs/task/2026-03-18-phase-2-round-2-runtime-validation.md`

## 本轮已完成内容

- 新增远端 Phase 2 验收脚本：
  - `scripts/phase2-audio-validation.js`
  - 支持参数解析、`probe=true` 门禁、音频生成触发、轮询结果、`audioReliability` 提取与 review markdown 输出
- 新增脚本回归测试：
  - `apps/web/src/lib/__tests__/phase2-audio-validation-script.test.ts`
  - 覆盖参数解析、probe 失败短路、stale deployment 诊断、成功运行的 reliability 提取
- 更新远端运行手册：
  - `docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md` 已新增脚本命令模板、结果解释与阻塞判定
  - 同时补入“部署前检查清单”和“最小验证样本准备命令”，让远端从 `0 books` 状态也能拉起最小验收样本
- `2026-03-19` 已把当前分支真实部署到远端：
  - 先备份远端代码目录中将被覆盖的 `apps/web/src` 与 `apps/web/prisma`
  - 再整体同步本地 `apps/web/src`
  - 随后同步 `apps/web/prisma/schema.prisma`
  - 最后执行 `pnpm prisma db push`，补齐远端数据库列缺失
- `2026-03-19` 已准备最小验证样本：
  - 创建书籍：`a956ec48-d743-428a-a53e-357138ad4f89`
  - 创建章节：`66b8395f-38a5-408c-8980-53028790d8eb`
  - 由于远端台本任务处理较慢，本轮为 Phase 2 最小样本直接手工写入 3 句旁白台本，并将书籍状态置为 `script_generated`
- 已完成真实远端验收：
  - 目标地址：`http://192.168.88.9:3001`
  - provider：`voxcpm`
  - 结果：`completed`
  - task：`0893d3be-b0bb-4b15-a48e-6948aace478f`
  - review 已写入 `docs/review/2026-03-18-phase-2-runtime-validation.md`
- `2026-03-19` 补充修复并再次验证真实脚本生成章节：
  - 修复 `SCRIPT_GENERATION(sample run)` 完成后书籍状态停留在 `generating_script` 的问题
  - 修复报表连续引语在 refinement 中上下文丢失的问题
  - 真实书籍：`77c9e754-90a4-4164-8fb8-b26700ee8cba`
  - 真实章节：`ca5bc04f-53a0-4ce8-ad3f-91ab7da04b7e`
  - 脚本生成任务：`ebc18a9e-291a-47d3-8b76-fd92cf93752e`（最终 `bookStatus=script_generated`）
  - 音频验收任务：`0dc52c34-3ac8-4f5f-bd56-3e51d9f5bbe4`
  - Phase 2 章节级验收结果：`completed`
- `2026-03-20` 已完成同一本真实书的整书级 Phase 2 验收：
  - 整书音频任务：`c6383581-e72c-4d9f-861d-d653b93d5061`
  - 结果：`completed`
  - 指标：
    - `firstPassSuccessRate = 1`
    - `retryRounds = 0`
    - `averageDurationMs = 5431`
    - `providerFailures = []`

## 变更清单

- 代码变更：
  - `scripts/phase2-audio-validation.js`
  - `apps/web/src/lib/__tests__/phase2-audio-validation-script.test.ts`
- 文档变更：
  - `docs/plans/2026-03-18-phase-2-runtime-validation-design.md`
  - `docs/plans/2026-03-18-phase-2-runtime-validation.md`
  - `docs/task/2026-03-18-phase-2-round-2-runtime-validation.md`
  - `docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`
  - `docs/review/2026-03-18-phase-2-runtime-validation.md`
  - `docs/handoff/2026-03-18-phase-2-round-2-runtime-validation.md`

## 已执行验证

- `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/phase2-audio-validation-script.test.ts src/lib/__tests__/audio-runtime-policy.test.ts src/lib/__tests__/audio-retry-plan.test.ts src/lib/__tests__/tts-runtime-probe.test.ts src/lib/__tests__/tts-provider-status-route.test.ts src/lib/__tests__/audio-generation-runner-reliability.test.ts`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`
- `node scripts/phase2-audio-validation.js --base-url http://192.168.88.9:3001 --provider voxcpm --type book --book-id probe-gate-blocked-book --batch-size 1 --repeat-count 1 --review-path docs/review/2026-03-18-phase-2-runtime-validation.md`
- `curl -fsS http://192.168.88.9:3001/api/tts/providers/status?probe=true`
- `curl -fsS http://192.168.88.9:3001/api/books`
- `rsync -av apps/web/src/ 192.168.88.9:/root/code/txt2voice/apps/web/src/`
- `rsync -av apps/web/prisma/ 192.168.88.9:/root/code/txt2voice/apps/web/prisma/`
- `ssh 192.168.88.9 'docker exec txt2voice-web sh -lc "cd /app/apps/web && pnpm prisma db push"'`
- `node scripts/phase2-audio-validation.js --base-url http://192.168.88.9:3001 --provider voxcpm --type chapter --book-id a956ec48-d743-428a-a53e-357138ad4f89 --chapter-id 66b8395f-38a5-408c-8980-53028790d8eb --batch-size 1 --repeat-count 1 --review-path docs/review/2026-03-18-phase-2-runtime-validation.md`
- `pnpm --filter web test -- --runInBand src/lib/__tests__/failed-segment-refinement.test.ts src/lib/__tests__/segment-processor-refinement.test.ts src/lib/__tests__/script-generation-runner.test.ts`
- `rsync -av --relative apps/web/src/app/api/books/[id]/script/generate/route.ts apps/web/src/lib/script-generation-runner.ts 192.168.88.9:/root/code/txt2voice/`
- `rsync -av --relative apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts 192.168.88.9:/root/code/txt2voice/`
- `node scripts/phase2-audio-validation.js --base-url http://192.168.88.9:3001 --provider voxcpm --type chapter --book-id 77c9e754-90a4-4164-8fb8-b26700ee8cba --chapter-id ca5bc04f-53a0-4ce8-ad3f-91ab7da04b7e --batch-size 1 --repeat-count 1 --review-path docs/review/2026-03-18-phase-2-runtime-validation.md`
- `node scripts/phase2-audio-validation.js --base-url http://192.168.88.9:3001 --provider voxcpm --type book --book-id 77c9e754-90a4-4164-8fb8-b26700ee8cba --batch-size 1 --repeat-count 1 --review-path docs/review/2026-03-18-phase-2-runtime-validation.md`

## 代码质检结果

- 使用工具：Jest、TypeScript typecheck、Next build、真实远端 HTTP 验证
- 执行命令：见“已执行验证”
- 结果：
  - 脚本相关目标测试通过
  - broader verification 共 `6` 个 suite、`13` 个测试通过
  - `typecheck` 通过
  - `build` 通过
  - 首次真实远端验证正确拦下了旧部署
  - 远端完成部署 + schema push 后，章节级 Phase 2 验收成功完成
  - 修复 sample run 状态回写和报表连续引语 refinement 后，真实脚本生成章节也已通过章节级 Phase 2 音频验收
  - 同一本真实书的整书级 Phase 2 验收已通过，且 `voxcpm` 首轮全量成功、无需补跑
- 是否通过：是
- 阻塞 / 备注：
  - 远端最初的 `probe=true` 响应缺少 `probeHealthy` 字段，已通过源码同步解决
  - 远端数据库最初缺少 `script_sentences.roleType` 等列，已通过 `pnpm prisma db push` 补齐
  - 远端原始样本书列表为空，当前已通过最小手工样本补齐章节级验证路径
  - `baseline-browser-mapping` 仍是非阻塞告警

## 结果与结论

- 这轮已经把 Phase 2 的“真实运行验证”从人工口头步骤推进成了可脚本化、可文档化、可留证据的验收入口。
- 首次脚本执行正确暴露了两个真实阻塞：远端旧部署缺 probe 字段、数据库 schema 落后于当前源码。
- 在完成源码同步、schema push 与最小样本准备后，`voxcpm` 章节级验证已成功：
  - `firstPassSuccessRate=1`
  - `retryRounds=0`
  - `averageDurationMs=3973`
  - `providerFailures=[]`
- 因此当前远端已经具备 Phase 2 的最小可验证闭环，不再停留在“只能本地自证”的状态。

## 遗留问题

- 早期成功样本是“手工 3 句旁白台本”的最小章节样本，但当前已经补齐真实脚本生成章节和整书级验收。
- 两个先前触发的 `SCRIPT_GENERATION` 任务仍在远端队列中处理，后续需要观察是否自然完成，或在确认无价值后清理。
- 目前 review 仍停在 markdown 文档，尚未接入 metrics / review workbench。

## 风险判断

- 远端 repo 仍有大量历史脏改动；本轮通过“备份 + 覆盖 app 源码/Prisma schema”完成部署，但后续若继续手工改远端代码，环境会再次漂移。
- 当前这次整书级验证虽然 `voxcpm` 首轮成功，但仍只有单次记录；如果未来输入规模或 GPU 争用变化，仍可能回到历史 `500` / 低并发补跑场景，需要继续用脚本沉淀多轮 `audioReliability`。
- 真实章节验证虽然已经打通，但当前 review 文档只保留最新一次成功记录；若要做阶段 closeout，仍需把多轮对比记录补成表格。

## 下一轮建议目标

- 在当前远端基础上继续做整书级多轮验证，把 `firstPassSuccessRate / retryRounds / providerFailures / averageDurationMs` 形成对比记录。
- 若整书样本暴露 `voxcpm` 失败分布，再回头调 `audio-runtime-policy` 的并发档位，而不是提高全局 batchSize。
