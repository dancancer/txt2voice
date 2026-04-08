# LLM Workflow Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前项目中 LLM 工作流“定义层、运行时、预算治理、模型策略、观测链路”脱节的问题，让 `workflow / agent / skill / prompt` 真正成为可执行契约。

**Architecture:** 本次整改按“先消除假象、再收拢真相源、最后补齐治理能力”的顺序推进。先统一 workflow、runtime stage 与 validation substage 的真实边界，去掉当前 fake Mastra / fake shadow 的坏味道；再把 skill/agent 元数据真正接入 stage 运行时；随后补 prompt budget、artifact 裁剪、model policy；最后用回归测试和运行时观测把行为钉死。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Bull-based LLM runtime, OpenAI-compatible provider adapter, authoring files (`workflow.toml` / `agent.toml` / `skill.toml` / prompt bundle)。

**Migration Policy:** 本次整改就是破旧立新，不保留 legacy 处理管线、不保留旧运行时兼容分支、不保留旧数据兼容逻辑。凡是新 contract 已覆盖的旧实现，必须在本次改造中直接删除，而不是先保留、后迁移、再慢慢清理。

## 执行状态（2026-04-08）

当前执行结果：

- 已完成 Task 0 至 Task 8 的代码整改与聚焦回归。
- 已删除 legacy 主链路与假 Mastra 壳层，包括旧 `script-generator.ts`、旧 `script-generator/*` 目录、以及 `run-mastra-*` 四个转发壳文件。
- 已将共享实现迁入 `apps/web/src/lib/agent-runtime/runtime/script-production/*`，包括 `types / options / summary / workflow-source / storage / helpers / manual-review-processor`。
- 已把 `promptBundle / modelPolicy / repairPolicy / successCriteria / telemetryTags` 接入 runtime metadata / trace / summary。
- 已把 `characterProfiles` 稳定接入 runtime `CharacterMemory` 与 script-generation prompt 上下文。
- 已把 fake executor 语义收口为 `native / mastra-disabled / mastra-shadow / mastra-primary`，其中未启用真实 Mastra runtime 时不再伪装成 `mastra`。

当前保留项：

- `apps/web/src/lib/manual-review-service.ts` 仍保留，因为 API 路由仍直接调用它；但其内部已经切到 runtime `manual-review-processor`，不再依赖旧 `segment-processor`。
- 历史 handoff / 旧计划 / 旧 review 文档中的旧路径引用保留，用于还原当时语境；当前真相源以运行时代码与技术手册为准。

回归结果：

- 已通过 14 个 suite / 139 个测试的聚焦回归，覆盖 workflow runtime、各 stage、script generate route、task replay、manual review、旁白持久化与注释归一化。
- 代码扫描确认 `apps/web/src` 已不存在 `script-generator` 旧路径引用。

---

## 范围与原则

### 这次整改覆盖的核心问题

1. `workflow.toml` 与 runtime DAG 不一致
2. Mastra executor / shadow 模式只有“名义支持”，没有真实独立执行路径
3. skill 定义中的 `promptBundle / contextRequirements / toolAllowlist / modelPolicy / repairPolicy / successCriteria / telemetryTags` 只有部分接入运行时，且 native runtime / Mastra compiler 的接入深度不一致
4. `character-discovery` 与 `quality` 阶段的预算治理仍不完整：
   - `character-discovery` 已有 reference memory 裁剪，但缺少显式 input over budget gate
   - `quality` 仍会把大体积 artifact 原样灌入 prompt
5. quality 阶段缺少 artifact summary 层，提示词里还没有按字段价值做裁剪与摘要
6. 模型选择仍依赖隐式默认值，无法根据 skill policy 路由
7. `agent.toml` 中的 `compatibleWorkflowStages / allowedSkills / allowedTools` 仍未成为 native runtime 契约
8. `promptBundle` 已经在 skill authoring 中广泛声明，但 authoring 校验仍允许缺省或坏配置拖到运行时才失败
9. 预算治理只覆盖上下文片段，没有覆盖最终渲染后的 prompt 大小
10. `toolAllowlist`、`allowedTools`、runtime 已注册工具三者之间缺少统一求交规则
11. 当前 runtime 虽然已加载历史 `characterProfiles / characterMap`，但这份信息尚未稳定转换成 script-generation 可消费的 prompt 上下文；`character-discovery` 已支持 `characterMemorySummary` 注入，workflow 侧仍缺少统一接线
12. 仓库中仍存在旧处理管线、旧兼容代码和旧数据兼容假设，会持续稀释单一真相源
13. 当前计划若只重构新 contract 而不顺手清理存量 legacy 代码，最终仍会留下“新老两套逻辑并存”的维护陷阱

### 执行总原则

1. 先修“定义可信度”，再修“模型能力”。
2. 任何配置项只要暴露出来，就必须有真实运行时行为与测试覆盖。
3. 任何 shadow / executor / policy，只要不能产生可验证差异，就不应继续伪装成能力。
4. 优先消除特殊情况，不继续增加并行的隐式逻辑。
5. 每个任务必须包含明确产出、验证命令、预期结果。
6. 先定义“顶层 workflow stage”和“运行时 substage”的边界，再做对齐；不要把两层概念混成一个列表。
7. `validation` 在本次整改中定义为 runtime-owned substage。要把它提升为 authoring stage 时，必须删除旧 substage 实现并按新 contract 直接重写。
8. 工具暴露必须遵守单一规则：`agent.allowedTools ∩ skill.toolAllowlist ∩ runtimeRegisteredTools`。
9. 旧处理管线、旧兼容逻辑、旧数据兼容分支不是资产而是负债；一旦新 contract 落地，对应 legacy 实现必须直接删除。
10. 每个任务除了“让新逻辑工作”，还必须包含“删除哪些旧文件、旧分支、旧测试基线、旧兼容路径”的显式产出。

---

## 改进规划

### 一、收拢单一真相源

目标是让 workflow、stage、skill contract 不再各说各话。`workflow.toml`、`agent.toml`、`skill.toml` 应该决定 runtime 能做什么，而不是仅做文档说明；同时要明确哪些能力属于 framework-owned substage，避免把 runtime 内建流程伪装成 authoring contract。凡是与此冲突的 legacy 管线、兼容封装、旧测试桥接层，都应在本次整改里直接移除。

这一步优先级最高，因为如果执行图和 authoring 定义不一致，后续所有优化都建立在漂移的基础上。

### 二、去掉假的执行分支

当前 Mastra executor 和 shadow 对比并没有独立执行能力，只是 `compile` 之后回落到 native 路径。这会污染对比结果，也会误导后续开发者。

本次整改执行方案 A：直接关闭 fake Mastra/shadow，保留 authoring compiler，但不再宣称“独立执行”。真实 Mastra stage runtime 不在本轮范围内，也不通过兼容壳假装存在。

### 三、把 skill/agent 元数据真正接入运行时

`promptBundle` 要成为 prompt 加载真相源，而且 native runtime 与 Mastra compiler 必须共用同一套 loader / fail-fast 规则；`contextRequirements` 要决定可注入上下文，`toolAllowlist` 要决定工具暴露，`modelPolicy` 要决定 provider / model / requestOptions。

这一步完成后，skill 才不是“写给人看”的配置文件，而是运行时契约。

### 四、建立 prompt budget 治理

预算治理不应该只是“算一下字符数”，而应该真的决定：
- 哪些上下文能进 prompt
- 哪些字段必须裁剪
- 超预算时如何降级
- 哪些失败应该进入 input refinement / manual review
并且要区分“输入上下文预算”“reference memory 预算”和“最终 render 后 prompt 预算”，不要把三者混成一个数字。

### 五、建立可验证的运行时观测

修完后必须能回答这几个问题：
- 当前每个 stage 实际用了哪套 prompt / skill / model
- 为什么进入 repair / manual review
- budget 触发了什么裁剪
- deterministic fail 和 semantic fail 的比例是多少

---

## 实施前清单

本次整改在落地前先把存量代码分成两类，避免执行时出现“嘴上说删，最后只是绕开”的情况。

### A. 纯 legacy 入口，完成切换后直接删除

这些模块本身代表旧台本生成主链路或旧兼容入口。一旦新 runtime contract 覆盖对应职责，应直接删除文件、调用方和测试，不保留空壳。

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/manual-review-service.ts`
  说明：这里仍直接依赖旧 `segment-processor` 的结构化结果重建与持久化逻辑，必须切到新 runtime contract 后再删旧分支。
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
  说明：这四个文件当前只是 compile + 转发 native 的壳层，整改完成后不应继续存在。

### B. 旧目录中的共享实现，先迁入 agent-runtime 再删除旧路径

这些代码虽然仍放在旧 `script-generator/*` 目录下，但已经被新 runtime 直接依赖。它们不能继续挂在 legacy 目录名下；本次整改应先搬迁到 `agent-runtime` 的稳定位置，再删除旧模块路径和导出。

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/persistence.ts`
  当前被：
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/persist-tools.ts`
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
  直接依赖
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/storage/character-utils.ts`
  当前被：
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/persist-tools.ts`
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
  - `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-persist-stage.ts`
  直接依赖
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/summary.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/segment-script-validator.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/dialogue-attribution-heuristics.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/pipeline/refinement/failed-segment-refinement.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/types.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generator/options.ts`

要求：
- 迁移后不保留旧文件中的 re-export
- 迁移后统一改 import 路径
- 迁移后同步删除旧目录下对应测试或把测试迁到新目录

### C. 旧测试基线，跟随代码一起删除或迁移

以下测试明显围绕旧管线对象、旧目录布局或旧行为基线构建。不能在新 runtime contract 落地后继续充当历史包袱。

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generator.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-generator-parallel.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/script-workflow.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/segment-processor.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/segment-processor-refinement.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/segment-processor-canonicalization.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/failed-segment-refinement.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/segment-script-validator.test.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/manual-review-service.test.ts`

处理规则：
- 若测试验证的是“旧入口/旧对象/旧目录”，直接删除
- 若测试验证的是“仍然需要保留的业务规则”，迁移到 `agent-runtime` 新目录并改写为新 contract 下的断言

### D. 现有调用方清理目标

这些调用方或间接调用方仍把旧模块当作真相源，需要在整改过程中一起切换，否则删除 legacy 代码后会留下悬空引用。

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/script-generation-runner.ts`
  说明：已经切到 `runScriptProductionWorkflow(...)`，但仍引用旧 `script-generator/types`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/script/generate/route.ts`
  说明：仍以旧 `ScriptGenerationOptions` 类型作为 API 入参真相源
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/manual-review-service.ts`
  说明：仍直接依赖旧 `segment-processor`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/task-queue/core/types.ts`
  说明：仍引用旧 `ScriptGenerationOptions`

### E. 执行要求

- 每完成一个任务，都要同步更新这份清单：标记“已删除”“已迁移”“仍阻塞”
- 不允许出现“新实现已落地，但 legacy 文件先留着”的中间状态
- 若某个旧模块仍被新 runtime 依赖，任务目标必须先写清“迁到哪里”，再允许删除旧路径
- 验收时不仅看测试通过，还要看这份清单中的文件是否真的消失或迁移完成

---

## 可执行任务清单

### Task 0: 先定义 contract 边界与 authoring 升级规则

**目标：**
- 明确 `workflow.toml` 描述的是“顶层协调阶段”还是“所有持久化 stage run”
- 明确 `validation` 属于顶层 stage 还是 runtime substage
- 明确工具暴露规则为：
  - `agent.allowedTools ∩ skill.toolAllowlist ∩ runtimeRegisteredTools`
- 明确本轮策略：
  - `validation` 定义为 runtime-owned substage
  - 旧 workflow/stage 列表和旧运行时分层语义不再保留兼容壳
- 对现有 `workflow / agent / skill` authoring 做一轮清点，识别所有需要删除的 legacy 定义与兼容路径
- 产出一份明确的删除清单：
  - 要删掉的 legacy 文件
  - 要删掉的兼容 helper / fallback 分支
  - 要更新或删除的旧测试 fixture

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/validate-definition.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`

**Step 1: 写失败测试，固定 contract 边界定义**

目标产出：
- 新增测试覆盖：
  - workflow 顶层 stages 与 runtime substages 的定义边界
  - `promptBundle` 对 runtime skill 是否为强制字段
  - agent/skill/tool 三方工具求交规则
  - `validation` 作为 runtime-owned substage 时的合法 shape

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`
- Expected: FAIL

**Step 2: 升级 protocol 与 registry 校验**

目标产出：
- 在协议层明确：
  - workflow 顶层 stage shape
  - runtime substage shape
  - `validation` 这类 framework-owned substage 的边界
  - LLM runtime skill 的 `promptBundle` authoring 约束
- definition loader 能在 authoring 阶段就拦下坏配置
- 标记并移除与新 schema 冲突的旧定义/旧 fixture，而不是继续做 schema 兼容
- 删除只为旧 schema / 旧路径存在的定义解析分支

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`
- Expected: PASS

---

### Task 1: 统一 workflow 声明与 runtime 执行图

**目标：**
- `workflow.toml` 与 runtime 顶层 stage 顺序一致
- `validation` 作为 runtime-owned substage 单独建模，不再混入顶层 workflow stage 列表
- workflow 编译结果、执行结果、测试断言三者一致
- 删除旧的顶层 stage 手写数组、旧的执行图假象，以及与新边界冲突的 legacy 断言
- 删除旧 workflow 执行入口、旧 stage 映射别名和旧 trace 对齐补丁

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/workflows/script-production/workflow.toml`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-workflow.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`

**Step 1: 写失败测试，固定 workflow 声明和 runtime DAG 必须一致**

目标产出：
- 新增测试比较：
  - `workflow.toml` 中的顶层 `stages`
  - `run-script-production-workflow.ts` 实际提交给 `runWorkflow(...)` 的顶层 `stages`
  - `compile-workflow.ts` 输出的 `stageOrder`
  - 单独比较 runtime substage map 中的 `validation`
  - 明确哪些旧测试基线应当删除，而不是继续保留双重语义

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Expected: FAIL，明确指出 `validation` 阶段不一致

**Step 2: 选定 workflow 的单一真相源**

目标产出：
- 决定由 `workflow.toml` 驱动 runtime 顶层 stage 列表
- `run-script-production-workflow.ts` 不再内联手写一套顶层 stage 数组
- `validation` 改为通过显式 substage map / metadata 挂接，而不是混入顶层数组
- 删除旧列表、旧别名、旧断言桥接层
- 删除仍引用旧 stage 顺序假设的运行时代码，而不是继续维持适配层

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Expected: PASS

**Step 3: 更新 workflow 编译器与现有测试预期**

目标产出：
- `compile-workflow.ts` 与 runtime 顺序一致
- `mastra-compiler.test.ts` 不再依赖过期的 stage 顺序

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Expected: PASS

**Step 4: 验证主流程未被阶段收拢破坏**

目标产出：
- script production 主流程仍可跑通
- runtime store / trace / summary 不受阶段对齐影响
- 不再为旧消费者保留兼容字段；调用方与测试一并更新到新真相源

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

---

### Task 2: 让 skill prompt bundle 成为真实加载入口

**目标：**
- 所有 stage 统一通过 skill 定义加载 prompt
- 删除 stage 内部对 `prompts/system.md` 和 `prompts/user.md` 的路径硬编码
- prompt 文件缺失时 fail-fast
- `promptBundle` 从“松散元数据”升级为受 authoring 约束的 runtime contract
- native runtime 与 Mastra compiler 共用同一个 runtime bundle loader，而不是各自维护一套 prompt 解析逻辑
- 删除旧的本地 prompt 读取辅助函数和任何“bundle 缺失则回退默认路径”的兼容行为
- 删除仓库中所有仍直接读取 legacy prompt 路径的代码与测试

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/load-skill-runtime-bundle.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/load-prompt-bundle.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/definitions.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/registry/validate-definition.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`

**Step 1: 写失败测试，固定 prompt 必须来自 `promptBundle`**

目标产出：
- 测试覆盖：
  - 缺少 `promptBundle` 的 runtime skill 在 definition loader 阶段直接失败
  - `promptBundle` 声明缺文件时直接失败
  - stage 不再假设固定的 `prompts/system.md`

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Expected: FAIL

**Step 2: 提取统一的 skill runtime bundle loader**

目标产出：
- 新增 `load-skill-runtime-bundle.ts`
- 返回最少字段：
  - `definition`
  - `instructions`
  - `systemPrompt`
  - `userPrompt`
- Mastra compiler 复用同一 loader 或复用同一底层解析函数

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Expected: PASS

**Step 3: 替换四个 stage 的 prompt 读取逻辑**

目标产出：
- 四个 stage 全部删除本地 `readRequiredFile(...prompts/system.md)` 分支
- prompt 统一从 runtime bundle 获取
- 不允许 native runtime 与 Mastra compiler 对缺失 bundle 产生不同行为

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Expected: PASS

**Step 4: 验证 stage 行为未回归**

目标产出：
- prompt 内容与此前 guardrail 断言一致
- 无路径回归

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

---

### Task 3: 统一 agent/skill contract 校验逻辑

**目标：**
- `compatibleWorkflowStages / allowedSkills / allowedTools` 在 agent 入口统一校验
- `compatibleAgents / contextRequirements / toolAllowlist / outputSchemaRef` 在 stage 入口统一校验
- `character-discovery` 不再成为 contract 校验特例
- native runtime 与 Mastra runtime 使用同一套工具求交规则
- `validation` 不纳入本任务；它继续作为 framework-owned substage，由 Task 0 / Task 1 单独治理
- 删除旧的本地断言函数、特殊分支和兼容性豁免，而不是保留 helper 外挂壳
- 清理所有已经被统一 contract helper 取代的存量校验代码

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agent-contract.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/skill-contract.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/tools/contracts.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts`

**Step 1: 写失败测试，固定 character-discovery 也必须校验 contract**

目标产出：
- 新增用例覆盖：
  - agent 不允许当前 stage 时 fail-fast
  - skill 不在 agent `allowedSkills` 中时 fail-fast
  - `contextRequirements` 与 stage 输入不符时 fail-fast
  - `toolAllowlist` 与 `allowedTools` 求交后为空或越权时 fail-fast

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: FAIL

**Step 2: 提取统一 contract 校验 helper**

目标产出：
- 新增 `agent-contract.ts`
- 新增 `skill-contract.ts`
- helper 能校验：
  - stage compatibility
  - allowed skill set
  - agent compatibility
  - required context set
  - tool allowlist / allowedTools / registeredTools intersection
  - optional output schema

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**Step 3: 接入四个 stage**

目标产出：
- 删除四个 stage 中重复的本地断言函数
- `character-discovery` 与其他 stage 使用同一套 contract helper

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

---

### Task 3.5: 把已有角色信息真正接入台本生成与重生成 prompt

**目标：**
- full / partial / regenerate 三种台本生成模式都能把已有角色信息带入 prompt
- workflow 已加载的 `characterProfiles / characterMap` 能稳定转换成 runtime `characterMemory`
- `segment-scripting` 能消费已有角色资料或角色记忆摘要，而不是只看 `segmentText`
- 角色信息进入 prompt 后，仍保持当前的角色归一化与持久化链路不回归
- 不保留旧 prompt 变量名、旧上下文字段或旧数据结构兼容映射
- 删除所有仍围绕旧角色上下文结构做兜底转换的代码

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/memory-types.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/system.md`
- Modify: `/Users/xupeng/mycode/txt2voice/skills/script-generation/prompts/user.md`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`

**Step 1: 写失败测试，固定已有角色信息必须进入 prompt**

目标产出：
- 新增用例覆盖：
  - workflow 已加载 `characterProfiles` 时，能构建出可注入的 runtime `characterMemory`
  - 已有 `characterProfiles` 存在时，`segment-scripting` prompt 包含角色信息或角色记忆摘要
  - regenerate 模式与 full / partial 模式行为一致

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: FAIL

**Step 2: 统一把历史角色资料转换为 runtime 可注入记忆**

目标产出：
- 从已有 `characterProfiles` 构建统一的 `characterMemory`
- `run-character-discovery-pass.ts` 调用 stage 时带上已有角色记忆
- 不再出现 workflow 已加载角色资料但 script-generation prompt 侧丢失的断裂
- 不重复改造已经支持 `characterMemorySummary` 注入的 character-discovery stage

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS

**Step 3: 扩展 segment-scripting 的 prompt 输入**

目标产出：
- `build-context.ts` 为 script generation 暴露角色记忆摘要或角色信息摘要
- `script-generation-agent.ts` 在渲染 user prompt 时注入角色信息
- `skills/script-generation/prompts/*` 明确要求优先使用已知角色名、别名和角色特征辅助 speaker 判断

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

**Step 4: 验证主流程三种模式一致生效**

目标产出：
- full / partial / regenerate 三种模式都把已有角色信息传到 prompt
- 角色带入不破坏现有归一化、repair、quality、persist 行为

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

---

### Task 4: 补齐 character-discovery 与 quality 的 budget 治理

**目标：**
- `character-discovery` 不再在超预算时裸发 prompt
- `quality` 阶段引入正式 budget gate
- 大 artifact 进入 prompt 前必须被裁剪或摘要
- budget 判断覆盖“最终渲染后的 prompt”，而不是只看输入片段字符数
- 角色记忆/角色信息进入 prompt 后，仍有稳定的预算裁剪与降级策略
- 沿用当前 `segment-scripting` 已有的 input over budget fail-fast 行为，只补齐缺口而不是重写整套预算链路
- 删除旧的静默降级、隐式回退和“先跑再说”的 legacy budget 路径
- 删除所有已经被新 budget gate 取代的 legacy 裁剪逻辑和静默容错逻辑

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/budget-policy.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/character-discovery-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/script-generation-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/repair-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/agents/quality-judge-agent.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-budget.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-artifact-summary.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定 character-discovery 超预算时不能继续原样发给模型**

目标产出：
- 测试覆盖：
  - 长 segment 输入时，stage 必须显式裁剪、降级或失败
  - 角色记忆摘要很长时，必须显式裁剪、降级或失败
  - 不能像现在这样在没有 input over budget gate 的情况下继续执行

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: FAIL

**Step 2: 实现 character-discovery 的 budget gate**

目标产出：
- 超预算时先裁剪文本样本
- 仍超预算时直接返回明确错误或显式降级结果

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Expected: PASS

**Step 3: 写失败测试，固定 quality prompt 不能直接灌原始大 artifact**

目标产出：
- 新增用例覆盖：
  - `failedArtifact.rawResponse` 很长时只保留截断片段
  - `structuredResult` 只保留必要字段
  - 最终 prompt 长度可控

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: FAIL

**Step 4: 引入 artifact summary 层**

目标产出：
- 新增 `prompt-artifact-summary.ts`
- 至少支持：
  - 输出 `kind`
  - 输出 `provider / model`
  - 截断 `rawResponse`
  - 裁剪 `structuredResult`

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 5: 给 quality stage 接入统一 budget gate**

目标产出：
- quality stage 也走 context/budget 逻辑
- budget 触发时有清晰降级行为
- adapter 调用前有最终 prompt render gate
- 超预算 trace 中能看见：
  - 原始长度
  - 裁剪后长度
  - 被裁掉的字段

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 6: 验证角色信息注入后的预算行为**

目标产出：
- 当已有角色很多、别名很多时：
  - `character-discovery`
  - `segment-scripting`
  两个阶段都能稳定裁剪角色上下文
- 降级策略优先保留 canonical name、关键 alias、重要角色，再裁剪低价值描述

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Expected: PASS

---

### Task 5: 落地 model policy 到 provider / model / requestOptions

**目标：**
- `modelPolicy` 不再是摆设
- 不同 skill 能按 policy 选择不同 provider / model / requestOptions
- 去掉“所有阶段吃同一个默认模型”的隐式行为
- 删除旧的默认模型硬编码和任何兼容 fallback
- 删除所有绕过 policy resolver 的存量 provider/model 选择逻辑

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/model-policy.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/adapters/llm-adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/llm-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/helpers/adapter.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/compiler/compile-agent.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/llm-service.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`

**Step 1: 写失败测试，固定 policy 到请求参数的映射**

目标产出：
- 测试覆盖：
  - `balanced`
  - `cheap-repair`
  - `quality`
  - 未声明 policy 或未知 policy 直接失败
- 断言 provider / model / temperature / maxTokens 映射正确

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Expected: FAIL

**Step 2: 提取统一 model policy resolver**

目标产出：
- 新增 `model-policy.ts`
- 提供 `resolveLLMExecutionPolicy(modelPolicy, env?)`
- 只接受显式受支持的 policy 值，不做隐式 default fallback

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Expected: PASS

**Step 3: 让 stage 把 skill 的 `modelPolicy` 传给 adapter**

目标产出：
- 四个 stage 在调用 adapter 前都先解析 policy
- adapter 请求中能看到 policy 解析结果
- workflow coordinator 不再预绑定整条流程共用的 provider，避免 stage policy 被上层覆盖

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts`
- Expected: PASS

**Step 4: 修正 Mastra 编译器的硬编码模型**

目标产出：
- `compile-agent.ts` 不再永远写死 `openai:gpt-4.1-mini`
- 严格与 skill 上声明的 policy resolver 一致

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Expected: PASS

---

### Task 6: 让 Mastra executor / shadow 行为恢复诚实

**目标：**
- 短期内移除 fake executor 语义
- shadow diff 只在真正存在独立执行路径时启用
- 删除所有“先 compile 再回落 native”的伪独立执行实现，不保留兼容入口
- 删除现有 Mastra runtime 包装中只起到 compile+转发作用的 legacy 壳层

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: 写失败测试，固定 shadow 只能在独立执行路径存在时启用**

目标产出：
- 新增测试断言：
  - 当前只要 Mastra 只是回落到 native，就不能产出 shadow diff
  - executor 切到 `mastra` 时，不得和 native 共享完全相同的实现入口

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: FAIL

**Step 2: 短期整改，关闭 fake shadow / fake executor**

目标产出：
- stage 层仅在 Mastra runtime 真实可用时启用 shadow
- Mastra 不可用时直接标记 `mastra-disabled`，不再伪装成 `mastra` 执行

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**Step 3: 统一对外语义**

目标产出：
- runtime metadata / trace / summary 中能区分：
  - `native`
  - `mastra-disabled`
  - `mastra-shadow`
  - `mastra-primary`

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Expected: PASS

---

### Task 7: 把 repair / success / telemetry 字段接入运行时观测

**目标：**
- `promptBundle` 身份信息、`modelPolicy / repairPolicy / successCriteria / telemetryTags` 至少进入 trace / summary / runtime metadata
- 让这些字段先“有记录”，再考虑更复杂的自动行为
- 观测字段以新 runtime contract 为准，不保留 legacy 字段镜像
- 删除所有只为兼容旧 trace 消费者而存在的观测字段映射

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-helpers.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/write-trace.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-character-discovery-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-scripting-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-segment-repair-stage.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/stages/run-quality-stage.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/write-trace.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`

**Step 1: 写失败测试，固定 skill 元数据会进入 trace**

目标产出：
- 新增测试断言 trace / stage summary 中包含：
  - `promptBundle` 或 `promptFingerprint`
  - `modelPolicy`
  - `repairPolicy`
  - `successCriteria`
  - `telemetryTags`

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/write-trace.test.ts`
- Expected: FAIL

**Step 2: 在 stage output / trace payload 中挂上 skill 元数据**

目标产出：
- stage summary 和 runtime metadata 中可见 skill 元数据快照
- 能回答：
  - 当前 stage 用了哪一个 skill
  - 哪个 prompt bundle / prompt fingerprint
  - 为什么进入 repair / manual review

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/write-trace.test.ts`
- Expected: PASS

**Step 3: 验证主流程 summary 不回归**

目标产出：
- workflow summary 仍稳定输出
- 新增字段不破坏原有消费方

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

---

### Task 8: 做一轮端到端回归，确认整改后的闭环成立

**目标：**
- workflow、skill、prompt、budget、repair、quality、trace 形成闭环
- 不再存在“配置可写但运行时不生效”的显著断裂
- 不再存在“旧管线仍可运行”“旧数据结构仍被特殊兼容”的旁路
- 确认仓库中已经没有与新 runtime contract 重叠的 legacy 实现残留

**Files:**
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/workflow-runtime.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/definition-loader.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/protocol-definitions.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/tool-contracts.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/context-builder.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/repair-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/__tests__/llm-adapter.test.ts`

**Step 1: 跑 authoring / compiler / workflow 相关测试**

目标产出：
- workflow 与 authoring 契约侧回归通过

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/definition-loader.test.ts src/lib/agent-runtime/__tests__/protocol-definitions.test.ts src/lib/agent-runtime/__tests__/runtime-schema-shape.test.ts src/lib/agent-runtime/__tests__/workflow-runtime.test.ts src/lib/agent-runtime/__tests__/mastra-compiler.test.ts`
- Expected: PASS

**Step 2: 跑 stage 与 prompt 相关测试**

目标产出：
- prompt guardrail、contract 校验、budget 行为回归通过

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/prompt-guardrails.test.ts src/lib/agent-runtime/__tests__/tool-contracts.test.ts src/lib/agent-runtime/__tests__/context-builder.test.ts src/lib/agent-runtime/__tests__/character-discovery-stage.test.ts src/lib/agent-runtime/__tests__/segment-scripting-stage.test.ts src/lib/agent-runtime/__tests__/repair-stage.test.ts src/lib/agent-runtime/__tests__/quality-stage.test.ts`
- Expected: PASS

**Step 3: 跑 adapter / runtime 主链路回归**

目标产出：
- model policy、角色信息注入、主工作流、summary/trace 一起通过

验证方法：
- Run: `pnpm --filter web test -- --runInBand src/lib/agent-runtime/__tests__/llm-adapter.test.ts src/lib/agent-runtime/__tests__/run-script-production-workflow.test.ts`
- Expected: PASS

**Step 4: 形成整改验收结论**

目标产出：
- 一份简短验收记录，说明：
  - 已消除的断裂点
  - 已删除的 legacy 管线 / 兼容代码 / 兼容数据假设
  - 下一阶段做真实 Mastra runtime 时，应从哪里继续
  - 仓库中还剩哪些非 LLM runtime 相关的历史代码，以及为什么本轮未触达

验证方法：
- Run: 人工审查测试报告与变更清单
- Expected: 可以明确回答“哪些配置真的生效了，哪些还没接”
