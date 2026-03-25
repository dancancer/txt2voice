# Subagent Runtime Session Handoff

## 基本信息

- 最近更新：2026-03-25
- 当前阶段：Subagent Runtime Phase 2 深化
- 当前分支：`codex/subagent-runtime`
- 当前工作目录：`/Users/xupeng/mycode/txt2voice`
- 设计文档：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime-design.md`
- 原始实施计划：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-23-subagent-skills-runtime.md`
- Phase 2 收口计划：
  - `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-25-subagent-runtime-phase-2.md`
- 说明：
  - 不再使用 `.worktrees/subagent-runtime`
  - 直接在仓库根目录和当前分支上迭代

## 当前总体结论

当前可以安全声称：

1. `script generation` 主链路已经由新的 `subagent + skills + workflow` runtime 接管
2. 旧 `script-generation-runner.ts` 仍负责任务状态回写与外层队列集成，但不再拥有台本生成主流程的 orchestration 权
3. runtime 已经具备：
   - 显式阶段机
   - runtime-owned manual review handoff
   - runtime-owned review sync summary
   - canonical tool/trace normalization
   - artifact-centric sidecar 持久化
4. 真实流程已经验证：
   - 成功样本能通
   - 失败样本能通到 `manual_review_pending`
   - `WorkflowRun / StageRun / AgentRun / ToolCall / TraceEvent / RuntimeArtifact` 都能真实落库

## 已完成范围

### Task 1 到 Task 13

- 已完成
- 包含：
  - protocol / schema / registry / context / tools / workflow skeleton / llm adapter
  - character discovery / segment scripting / repair / quality / persist

### Task 14：runtime bridge

- 已完成
- `script-generation-runner.ts` 已切到 `runScriptProductionWorkflow()`
- full / partial / regenerate 选段语义已保留

### Task 15：runtime replay / summary / metadata

- 已完成
- `WorkflowRun.summary`
- `runtimeMetadata`
- `loadWorkflowReplay(workflowRunId)`

### Phase 2 已完成项

以下均已完成并提交：

1. `character_discovery` 接入 script-production workflow
2. `manual_review_handoff` 变成显式 runtime stage
3. `runWorkflow()` 状态集扩展到 `manual_review_required / blocked`
4. 补齐 `script-generation-agent / repair-agent / quality-judge-agent / coordinator-agent` 的 authoring 定义
5. skill metadata 扩展为：
   - `promptBundle`
   - `modelPolicy`
   - `repairPolicy`
   - `successCriteria`
   - `telemetryTags`
6. 缺失的 runtime tool contracts 已补齐：
   - `load-segment-batch`
   - `load-character-memory`
   - `save-script-draft`
   - `create-manual-review-item`
   - `estimate-token-budget`
7. runtime trace 已补首批高价值事件：
   - `skill_selected`
   - `context_built`
   - `llm_requested`
   - `structured_output_received`
   - `repair_started`
   - `artifact_committed`
   - `manual_review_escalated`
8. canonical 名称收口已完成：
   - tool name normalization
   - trace kind normalization
9. `prepare / complete` 已接入 script-production workflow
10. runner 内部 local manual review sync fallback 已删除
11. `RuntimeArtifact` 已落地，且已有最小查询接口与 bundle 读取面
12. Prisma client 已按最新 schema 重新生成

## 关键提交

从旧到新，当前最关键的提交序列：

- `565d094` `feat: complete agent runtime orchestration`
- `bd70cea` `feat: wire character discovery into runtime workflow`
- `d688883` `refactor: split script production runtime helpers`
- `4bfe367` `refactor: split script production segment runtime`
- `600eab0` `feat: move manual review sync into runtime`
- `79a76a9` `feat: add runtime manual review workflow stage`
- `f712cdd` `feat: expand runtime authoring definitions`
- `dd12fd6` `refactor: remove runner review sync fallback`
- `060123b` `feat: add runtime tool contracts and trace events`
- `579b944` `refactor: normalize runtime trace and tool names`
- `0a2fa8d` `feat: trace runtime llm adapter events`
- `2794ccc` `feat: add prepare and complete runtime stages`
- `135579c` `feat: persist runtime artifacts for script production`
- `c0fac1e` `feat: add runtime artifact query interface`
- `acee051` `test: cover runtime trace normalization`
- `2b96296` `feat: trace selected skills in runtime`
- `bd4da84` `refactor: separate validation and output trace events`
- `ae7dfff` `chore: regenerate prisma client`

## 当前代码结构要点

### 主入口

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`

### 运行时核心

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`

### script-production 拆分结果

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/shared-types.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-single-segment.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-validation-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/manual-review-sync.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-helpers.ts`

### 阶段实现

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-manual-review-handoff-stage.ts`

### 工具与协议

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/io-tools.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/task-tools.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/review-tools.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/persist-tools.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/artifacts.ts`

### 文件化 authoring 层

- `/Users/xupeng/mycode/txt2voice/agents/character-discovery`
- `/Users/xupeng/mycode/txt2voice/agents/script-generation`
- `/Users/xupeng/mycode/txt2voice/agents/repair`
- `/Users/xupeng/mycode/txt2voice/agents/quality-judge`
- `/Users/xupeng/mycode/txt2voice/agents/coordinator`
- `/Users/xupeng/mycode/txt2voice/skills/character-extraction`
- `/Users/xupeng/mycode/txt2voice/skills/script-generation`
- `/Users/xupeng/mycode/txt2voice/skills/json-repair`
- `/Users/xupeng/mycode/txt2voice/skills/quality-judgement`
- `/Users/xupeng/mycode/txt2voice/workflows/script-production`

## 真实流程验证结果

### 真实最小成功样本

book:

- `book-runtime-e2e-2`

输入段落：

- `你好。`

结果：

- `ProcessingTask.status = completed`
- `Book.status = processed`
- `WorkflowRun.status = completed`
- `ScriptSentence` 成功落了 `1` 条
- `RuntimeArtifact` 成功落了 `4` 条

这是当前最硬的“真实成功路径已跑通”的证据。

### 真实失败样本

book:

- `book-runtime-e2e-1`

输入段落：

- `张三说：你好。`

结果：

- `ProcessingTask.status = failed`
- `Book.status = manual_review_pending`
- `WorkflowRun.status = failed`
- `sentenceCount = 0`
- `artifactCount = 6`

说明失败路径也已经通到 runtime handoff 和 manual review。

### `uploads/sample.txt` 真实场景验证

真实 book:

- `e0957096-f9ad-444a-82ee-fca422bb33b7`

已验证的真实步骤：

1. `POST /api/books`
2. `POST /api/books/:id/upload` 上传 `uploads/sample.txt`
3. `POST /api/books/:id/process`
4. `POST /api/books/:id/script/generate` 且 `limitToSegments = 1`

当前结果：

- 文本处理成功
  - `totalSegments = 408`
- 脚本生成真实进入 runtime
- 只选中首段，不是整本全跑
- 最终结果：
  - `ProcessingTask.status = failed`
  - `Book.status = manual_review_pending`
  - `WorkflowRun.status = failed`
  - `stageCount = 37`
  - `artifactCount = 27`
  - `sentenceCount = 0`
  - `semanticRetryCount = 6`

关键事实：

- 这不是环境没起来
- 这不是旧架构没迁完
- 是首段在真实长文本场景下，经过 `semantic_retry + input_refinement` 后仍然没收敛，最终进入 manual review

### auto pipeline 真实路径

真实 book:

- `0f8b04b0-88eb-4ee8-bd3c-e56ed9406e13`

已验证：

- 上传 `sample.txt` 时自动触发了 `AUTO_PIPELINE`
- 文本处理成功
- 自动进入 `script_generation` 阶段

说明：

- 真正的 `upload -> queue -> worker -> auto pipeline -> runtime script generation`
  这条路径已打通

## 已执行验证

除了前期单测和 typecheck，这一轮新增的关键验证有：

- `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm prisma generate`
- `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm prisma db push`
- 真实 API 路径：
  - `POST /api/books`
  - `POST /api/books/:id/upload`
  - `POST /api/books/:id/process`
  - `POST /api/books/:id/script/generate`
- 当前稳定通过的测试集：
  - `runtime-schema-shape.test.ts`
  - `script-production-runtime-store.test.ts`
  - `run-script-production-workflow.test.ts`
  - `workflow-runtime.test.ts`
  - `manual-review-handoff-stage.test.ts`
  - `persist-stage.test.ts`
  - `character-discovery-stage.test.ts`
  - `tool-contracts.test.ts`
  - `definition-loader.test.ts`
  - `protocol-definitions.test.ts`
  - `write-trace.test.ts`
  - `script-generation-runner.test.ts`
- `cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm run typecheck`
  - 结果：通过

## 当前剩余缺口

### 架构层面

主链路迁移本身已经基本完成，剩余更像增强项：

1. `RuntimeArtifact` 已能写、查、按 workflow/segment 组织，但还没有更好的消费接口暴露到上层 API 或调试工具
2. trace taxonomy 已有高价值事件，但 legacy kind 还没有完全清零
3. `prepare / complete` 还是最小实现，暂未进一步工具化

### 真实业务收敛层面

当前最重要的真实阻断已经不是“旧架构残留”，而是：

- 长段落、叙述密集、夹杂标题/引号的真实文本
- 在 `segment_scripting -> validation -> semantic_retry -> input_refinement`
  这条链路上仍可能无法稳定收敛

`sample.txt` 的手动样本已经证明这一点。

## 新会话建议起手顺序

1. 直接读取 `sample.txt` 失败样本的 runtime artifacts
   - 目标 book：`e0957096-f9ad-444a-82ee-fca422bb33b7`
   - 重点 segment：`0150bbfa-344a-42bd-842d-dd5507905e71`
   - 先看每一轮：
     - `validation-report`
     - `repair-decision`
     - `segment-script-draft`
     - `quality-verdict`

2. 针对真实失败样本优化收敛逻辑
   - 优先盯：
     - `TEXT_SOURCE_MISMATCH`
     - `NON_WHITESPACE_GAP`
     - `LOW_COVERAGE`
   - 重点文件：
     - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
     - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
     - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/validation-and-refinement.ts`

3. 如需更好调试，再补 artifact 消费接口
   - 优先给 runtime artifact 增加更好用的 bundle / timeline 读取面
   - 再决定是否暴露 API

## 新会话建议直接读取的文件

- `/Users/xupeng/mycode/txt2voice/docs/handoff/2026-03-24-subagent-runtime-session-handoff.md`
- `/Users/xupeng/mycode/txt2voice/docs/plans/2026-03-25-subagent-runtime-phase-2.md`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-segment-validation-cycle.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/resolve-segment-draft.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/validation-and-refinement.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/script-production-runtime-store.test.ts`

## 分支建议

- 继续在：
  - `/Users/xupeng/mycode/txt2voice`
  - `codex/subagent-runtime`

当前工作区状态：

- 干净
