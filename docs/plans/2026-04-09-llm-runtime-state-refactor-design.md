# LLM Runtime State Refactor Design

**目标**

把当前 LLM 主链从“阶段之间靠临时对象、JSON 字符串和隐式约定传递状态”重构为“围绕单一运行时状态对象、统一结构化上下文管道、统一 schema 契约、统一失败语义运行”的稳定系统。修复目标不是继续为现有链路补更多 guardrail，而是消除同类问题反复产生的结构性根因。

## 背景

当前 LLM 主链已经具备较完整的 runtime 框架与阶段拆分：

- workflow 调度位于 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/`
- Mastra stage 桥接位于 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/`
- prompt 资产位于 `/Users/xupeng/mycode/txt2voice/skills/*/prompts/`
- 持久化逻辑位于 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/storage/`

但系统仍保留了几类危险结构：

1. 同一份语义状态以多种形式存在：
   - `characterProfiles`
   - `characterMap`
   - `characterMemorySnapshot`
   - `characterMemorySummary`
   - `draft`
   - `canonicalized.draft`
2. prompt 上下文在多个 stage 内独立拼接、独立裁剪、独立序列化。
3. prompt 契约、parser 契约、持久化契约不是单一来源。
4. 失败语义并不统一：
   - 有的路径 `throw`
   - 有的路径 `status = failed`
   - 有的路径把失败降格成“count = 0”

这些结构导致系统出现的不是单点 bug，而是稳定的错误生成模式。

## 本次要解决的核心问题

### 1. 状态没有单一真相源

角色发现已持久化、speaker 已 canonicalize、quality 已判定通过，但调用方、下游和 summary 读取的未必是同一份状态。

### 2. 结构化上下文在进入 prompt 前退化成字符串

当前很多重要 artifact 会被先 `JSON.stringify()`，再按字符数裁剪，再重新拼回 prompt。这样会天然引入：

- 半截 JSON
- relevance 信息丢失
- stage 间上下文行为不一致

### 3. schema 不是唯一契约源

例如 `gender` 在 prompt 中是开放字符串，在持久化层却只接受英文枚举。类似问题未来还会扩散到更多字段。

### 4. 失败传播不是 fail-closed

持久化失败被吞、manual review 与真正失败混用、repair 不可恢复结果有时仍以“完成”姿态向上游冒泡。

## 设计目标

### 必须达成

1. workflow 在任一时刻只有一份可被信任的运行时状态。
2. scripting、repair、quality、persist 使用同一份角色基线与同一份当前 draft。
3. prompt 预算裁剪不再破坏结构化上下文。
4. prompt、parser、持久化围绕同一组 schema 约束工作。
5. 持久化失败不能再被静默吞掉。
6. 成功返回值必须与落库/trace/artifact 使用的对象一致。

### 明确不做

1. 不重写整套 workflow engine。
2. 不重做数据库业务模型。
3. 不在本轮引入新的外部 orchestration 系统。
4. 不扩展音频生成链路范围。

## 设计原则

1. 单一状态源优于多份弱同步副本。
2. 结构化裁剪优于字符串裁剪。
3. 共享 schema 优于手写自然语言契约。
4. fail-closed 优于 silent fallback。
5. 消除特殊情况优于继续增加局部补丁。

## 总体方案

本次重构拆成四个设计支柱：

1. `WorkflowRuntimeState`
2. `Structured Prompt Context Pipeline`
3. `Shared LLM Contracts`
4. `Unified Terminal Semantics`

它们不是独立优化项，而是一条链：

`共享 schema -> 结构化上下文 -> 单一运行时状态 -> 统一失败语义`

## 一、WorkflowRuntimeState

新增 runtime 一级状态对象，作为 workflow 与 segment 子流程的唯一真相源。

建议新增文件：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/runtime-state.ts`

### 核心结构

```ts
interface WorkflowRuntimeState {
  workflowRunId: string;
  bookId: string;

  characterMemory: CharacterMemorySnapshot;
  characterProfiles: CharacterProfileSnapshot[];
  characterMap: Map<string, string>;

  currentSegment?: {
    segmentId: string;
    chapterId?: string | null;
    orderIndex?: number;
    sourceText: string;
  };

  currentDraft?: SegmentScriptDraft;
  canonicalizedDraft?: SegmentScriptDraft;
  characterResolutionEvidence?: CharacterResolutionEvidence;
  validationReport?: ValidationReport;
  failedArtifact?: unknown;

  degradedMode: boolean;
  workflowIssues: Array<{
    code: string;
    stage: string;
    message: string;
    retryable?: boolean;
  }>;
}
```

### 关键约束

1. 角色相关状态只能从 `state.characterMemory` 读取。
2. 进入 quality 和 persist 的 draft 只能来自 `state.canonicalizedDraft`。
3. `state.failedArtifact` 是 repair 的唯一输入来源。
4. stage 不能再随意从旧 `characterProfiles` rebuild 临时 memory。

### 为什么这一步是核心

因为当前很多问题都来自“同一件事被表示成多份对象”：

- 角色发现 persist 成功，但后续还在读启动时的 `characterProfiles`
- quality / persist 用的是 canonicalized draft，但返回值拿的是原 draft

统一状态后，这两类问题会自然消失。

## 二、Structured Prompt Context Pipeline

新增一条统一的上下文构建链，把“结构化对象”保留到最后一层，再做安全序列化。

建议新增文件：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-context.ts`

并改造：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/context/build-context.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-budget.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/prompt-artifact-summary.ts`

### 现状问题

当前流程大致是：

1. 先把 `characterMemorySummary` 变成 JSON 字符串
2. 再按字符数硬裁剪
3. 某些 stage 又自己构造一份全量 summary 覆盖掉 relevance-aware 结果

这种方式天然脆弱。

### 改造目标

统一变成：

1. 先构建结构化 context object
2. 按字段类型进行预算裁剪
3. 仅在渲染 prompt 时做最终字符串化

### 建议接口

```ts
interface PromptContextArtifact<T> {
  kind: string;
  value: T;
  strategy: "preserve" | "summary" | "edge_excerpt";
}

interface PromptContextBundle {
  variables: Record<string, string>;
  structured: Record<string, unknown>;
  diagnostics: {
    trimmedKeys: string[];
    overBudget: boolean;
  };
}
```

### 设计要求

1. `character_memory_summary` 不再接受任意裸字符串来源。
2. `failed_artifact_json`、`validation_report_json`、`character_resolution_evidence_json` 等字段必须以结构化策略裁剪。
3. 所有 stage 的上下文构建必须通过同一 helper。

### 直接收益

1. 不再出现半截 JSON。
2. relevance-aware 的角色摘要不会被后续全量摘要覆盖。
3. budget 行为在三个 stage 中一致。

## 三、Shared LLM Contracts

把当前分散在 prompt、parser、持久化层里的字段契约收敛成共享 contract。

建议新增文件：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/contracts/character-discovery.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/contracts/segment-script.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/contracts/quality-verdict.ts`

### 第一轮先解决什么

不追求一次性把所有 schema 全部生成化，先把高风险字段和高频结构收口：

1. `gender`
2. `importance`
3. `CharacterFactBucket`
4. `SegmentScriptDraft`
5. `QualityVerdict`

### `gender` 设计

统一枚举：

```ts
type CharacterGender = "male" | "female" | "unknown";
```

允许兼容输入：

- `男` -> `male`
- `男性` -> `male`
- `女` -> `female`
- `女性` -> `female`
- 其它 -> `unknown`

### Prompt 侧要求

prompt 不再写模糊的 `gender: string`，而要明确写：

```text
gender 只能输出 "male"、"female"、"unknown"
```

### Parser / Persist 侧要求

parser 与 persist 都引用同一套归一化函数，而不是各自解释。

### 收益

这会把“模型输出合理值，但被消费端静默抹掉”的问题一次性收口。

## 四、Unified Terminal Semantics

统一 stage 和 workflow 的终态语义。

### 当前问题

同样是失败，不同代码路径的表达完全不同：

- `throw`
- `status = failed`
- `status = completed` 但 `decision = manual_review`
- 直接返回 `persistedCharacterCount: 0`

### 目标

所有阶段都只能落入以下语义之一：

```ts
type RuntimeTerminalStatus =
  | "completed"
  | "failed"
  | "retrying"
  | "repairing"
  | "manual_review_required";
```

### 关键规则

1. 持久化失败只能是 `failed`
2. manual review 只能表示“结果需要人工判定”，不能伪装成功
3. 任何进入下一阶段的 artifact 都必须来自当前唯一有效 state
4. workflow summary 只能从显式 terminal result 推导

### 直接修复的两个问题

1. `runCharacterDiscoveryPass()` 中 persist 失败不再被吞掉
2. `finalizeSegment()` 返回值与落库对象一致

## 关键流程重构

## 1. Workflow 启动

1. 载入 book 与初始 profiles
2. 构造 `WorkflowRuntimeState`
3. 生成 bootstrap `CharacterMemorySnapshot`
4. 记录初始 runtime artifact

## 2. Character Discovery

1. 读取 `state.characterMemory`
2. 运行 discovery
3. 合并 patch
4. persist 成功后更新：
   - `state.characterMemory`
   - `state.characterProfiles`
   - `state.characterMap`
5. persist 失败则显式返回 `failure`

## 3. Segment Scripting

1. `state.currentSegment = segment`
2. 用统一 prompt context helper 构造上下文
3. scripting 生成 `state.currentDraft`
4. canonicalization 生成：
   - `state.canonicalizedDraft`
   - `state.characterResolutionEvidence`

## 4. Validation / Repair / Quality

1. validation 仅读 `state.canonicalizedDraft`
2. repair 读 `state.failedArtifact` 与 `state.characterMemory`
3. repair 成功后回写 `state.currentDraft`，再重新 canonicalize
4. quality 仅读：
   - `state.canonicalizedDraft`
   - `state.validationReport`
   - `state.characterResolutionEvidence`
   - `state.characterMemory`

## 5. Persist

1. 只允许 persist `state.canonicalizedDraft`
2. persist 成功后返回值也必须引用同一份 draft

## 增量刷新策略

本轮不重做新的复杂发现调度器，但要把现有增量发现接到 state 模型上。

### 触发条件

1. 出现 unresolved speaker
2. alias conflict 非空
3. quality 认为角色归属风险较高
4. 章节切换

### 最小可行方案

保留现有 `runIncrementalCharacterDiscoveryRefresh()`，但它的成功结果必须回写 `state.characterMemory / state.characterProfiles / state.characterMap`，不能只写 DB。

## 风险与取舍

### 风险 1：改动横跨 workflow 与多个 stage

应对：

1. 采用串行门禁计划
2. 每一步先写失败测试
3. 优先建立中间兼容层，再切换调用方

### 风险 2：prompt 行为变化可能引起模型输出波动

应对：

1. 保留现有 prompt 资产主体
2. 先改上下文输入方式，再小幅收紧 prompt 文案
3. 用 regression tests 钉住关键行为

### 风险 3：状态重构导致隐藏耦合暴露

应对：

1. 让 `WorkflowRuntimeState` 先作为 wrapper 引入
2. 不要求第一步就移除全部旧字段
3. 在每个 Task 完成后再删兼容分支

## 验证策略

本次重构必须同时覆盖三类验证：

### 1. 单元验证

- memory snapshot merge
- canonicalization
- prompt context budget
- schema normalization

### 2. stage 验证

- scripting stage 使用统一摘要
- repair stage 使用统一角色提示
- quality stage 使用统一证据

### 3. workflow 验证

- character discovery persist 失败会向上游返回明确 failure
- success 返回 draft 与落库/trace 使用同一份对象
- 增量 discovery 后后续 segment 可见新角色

## 成功标准

完成后，系统应满足：

1. 持久化失败不会再被静默吞掉。
2. 成功返回值与 runtime artifact / persist 使用相同 draft。
3. scripting / repair / quality 围绕同一份角色快照工作。
4. prompt budget 不会产出半截 JSON。
5. prompt 契约与持久化契约不再分裂。

## 推荐实施顺序

1. 先落 `WorkflowRuntimeState` 与 memory 核心模块。
2. 再接管 prompt context pipeline。
3. 再切换 scripting / repair / quality 三个 stage。
4. 最后收口失败语义与 schema 契约。

这条顺序的好处是：每一步都在减少特殊情况，而不是制造新的特殊情况。
