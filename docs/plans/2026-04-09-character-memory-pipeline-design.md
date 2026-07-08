# Character Memory Pipeline Design

**目标**

把当前 LLM 主链路里分散在 `character_discovery`、`segment_scripting`、`segment_repair`、`quality_judgement` 各处的角色知识逻辑，收敛成一套统一、版本化、可追踪的 `Character Memory Pipeline`。修复目标不是“让更多 prompt 拿到更多文本”，而是让整条 workflow 在任何时刻都围绕同一份角色事实基线工作，消除 discovery 失败被吞、repair 失忆、quality 无据可判、长文本角色召回不足这四类系统性问题。

## 背景

当前实现已经具备了较完整的 runtime 框架：

- workflow 定义位于 `/Users/xupeng/mycode/txt2voice/workflows/script-production/`
- stage 执行桥位于 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/`
- Mastra stage 实现位于 `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/`
- prompt 资产位于 `/Users/xupeng/mycode/txt2voice/skills/*/prompts/`

但角色知识仍然不是一等公民，而是散落在多个位置的“半隐式上下文”：

1. `character_discovery` 只在 workflow 开头做一次小样本扫描。
2. `segment_scripting` 能拿到 `character_memory_summary`，但 speaker canonicalization 只在本 stage 内做局部后处理。
3. `segment_repair` 看不到角色记忆，修复结果可能回退成别名或错误 speaker。
4. `quality_judgement` 被要求审角色归属，却没有 canonical / alias 基线可核对。
5. workflow 在 `character_discovery` 失败时不会传播书级错误，导致整次运行进入静默劣化。

这导致角色知识在系统里既重要，又没有统一状态承载体。方案 3 的核心，就是把这个隐形概念显式化。

## 问题定义

本次设计明确要解决四类问题：

### 1. 失败传播失真

`runCharacterDiscoveryPass()` 已能返回 `failure`，但 `run-script-production-workflow.ts` 没有消费它，导致 discovery 故障既不阻断，也不入 summary，也不进入 manual review。

### 2. 角色知识跨阶段断裂

`segment_scripting`、`segment_repair`、`quality_judgement` 对角色知识的访问能力不一致，结果是：

- 生成时能识别 canonical
- 修复时又退回 alias
- 质检时又无法判断这种退化是否错误

### 3. 角色召回天然不足

当前 discovery 只看固定小样本，且只跑一次。长书后半段新角色、晚出现别名、章节内关系变化，天然进不了角色记忆。

### 4. 规则实现分叉

speaker 归一化、alias 合并、角色事实 reconciliation 分别写在 discovery stage、本地 helper、persist 逻辑中，容易继续分叉。

## 设计目标

### 必须达成

1. 角色知识成为 workflow 内的一等状态，而不是 stage 的副产物。
2. 所有与角色相关的 stage 都围绕同一份版本化 snapshot 工作。
3. repair 和 quality 拿到与 scripting 一致的角色基线。
4. discovery 从“一次性样本”升级成“bootstrap + incremental refresh”。
5. discovery failure 和 memory degradation 变成可见的 workflow 级事件。
6. 同一角色在一次 workflow 里不再出现 canonical / alias 语义漂移。

### 明确不做

1. 不重做数据库业务模型。
2. 不引入通用 DAG 编排。
3. 不把所有 LLM 能力一次性抽成通用 memory service 对外开放。
4. 不在本轮改造里直接改变音频生成链路。

## 设计原则

1. 单一真相源优于局部缓存。
2. 规则统一优于 prompt 反复强调。
3. 结构化证据优于文本暗示。
4. degraded mode 必须显式，而不是 silent fallback。
5. bootstrap 与 incremental 共享同一套 memory merge 逻辑。

## 总体架构

新增一个 runtime 一级模块：

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/`

建议文件布局：

- `types.ts`
- `store.ts`
- `summary.ts`
- `merge.ts`
- `canonicalize.ts`
- `refresh.ts`
- `diagnostics.ts`

### 核心对象

#### `CharacterMemorySnapshot`

```ts
interface CharacterMemorySnapshot {
  version: number;
  source: "bootstrap" | "discovery_refresh" | "persist_sync";
  status: "ready" | "degraded" | "failed";
  canonicalIdentities: Array<{ id: string; name: string }>;
  aliasEvidence: Array<{ alias: string; canonicalId: string; source: string }>;
  assertedFacts: Record<string, unknown>;
  inferredHints: Record<string, unknown>;
  derivedMaps: {
    canonicalNameById: Record<string, string>;
    canonicalNameByAlias: Record<string, string>;
    aliasSetByCanonicalId: Record<string, string[]>;
  };
  diagnostics: {
    lastDiscoveryAt?: string;
    discoveryRunCount: number;
    sampleCoverage: {
      sampledSegments: number;
      sampledChars: number;
      strategy: "bootstrap" | "incremental";
    };
    unknownSpeakerHits: number;
    aliasConflictCount: number;
    issues: string[];
  };
}
```

这个对象不是替代数据库，而是 workflow 内的角色语义快照。

### `CharacterResolutionEvidence`

用于 quality 和 trace：

```ts
interface CharacterResolutionEvidence {
  memoryVersion: number;
  rawSpeakers: string[];
  resolvedSpeakers: Array<{
    raw: string;
    canonical: string;
    reason: "direct_match" | "alias_match" | "unchanged" | "unknown";
  }>;
  unresolvedSpeakers: string[];
  aliasConflicts: Array<{
    speaker: string;
    candidateCanonicals: string[];
  }>;
}
```

这会把“quality judge 想判角色归属”变成有证据可判，而不是靠猜。

## 运行时数据流

### 1. Bootstrap

workflow 启动时：

1. 从现有 `CharacterProfile` 构造 `CharacterMemorySnapshot v1`
2. 将 `v1` 写入 runtime store
3. 运行 bootstrap discovery
4. 合并 patch，得到 `v2`

如果 bootstrap discovery 失败：

- 若 `v1` 非空：workflow 进入 `degraded`
- 若 `v1` 为空：workflow 直接 `failed`

### 2. Segment Execution

每个 segment 在进入 scripting 前：

1. 从 `CharacterMemoryStore` 取当前最新 snapshot
2. 生成 prompt summary
3. 将 `memoryVersion` 记入 stage input summary

每个 segment 在 scripting / repair 之后：

1. 跑统一的 `canonicalizeDraftSpeakers()`
2. 生成 `CharacterResolutionEvidence`
3. 再进入 validation / quality

### 3. Incremental Refresh

满足以下任一条件时，触发 `incremental discovery refresh`：

1. 出现未知 speaker
2. canonicalization 发现 alias conflict
3. quality stage 报角色归属风险
4. 进入新章节
5. 每处理固定窗口数量的 segment

refresh 不直接扫描全书，而是基于触发信号选取局部样本：

- 当前 segment
- 最近窗口段落
- 本章首尾片段
- 发生 unresolved speaker 的片段

refresh 结果统一合并进 snapshot，形成新版本。

## 统一规则层

### 1. Speaker Canonicalization

把当前散落的 canonicalization 收敛成统一函数：

- 输入：`SegmentScriptDraft + CharacterMemorySnapshot`
- 输出：`normalizedDraft + CharacterResolutionEvidence`

规则：

1. speaker 精确命中 canonical name，保持不变
2. speaker 命中 alias，回写 canonical
3. speaker 未命中任何映射，保留原值并记为 unresolved
4. 多 canonical 冲突时不擅自替换，记入 `aliasConflicts`

这样 scripting 和 repair 的 speaker 语义就一致了。

### 2. Discovery Merge

把当前 discovery stage 里的 reconcile 逻辑抽到 `merge.ts`。

统一负责：

1. 复用已有 canonical id
2. 合并 alias evidence
3. remap asserted / inferred bucket key
4. 处理 alias -> canonical 冲突

### 3. Prompt Summary

统一由 `summary.ts` 生成三类摘要：

1. `character_memory_summary`
2. `character_resolution_hints`
3. `character_resolution_evidence`

stage 不再自己拼“只够当前阶段看”的局部格式。

## Stage 契约改造

### 1. Scripting

保留现有 `character_memory_summary`，但输入扩充为：

- `character_memory_summary`
- `character_resolution_hints`
- `memory_version`

### 2. Repair

修改 `/Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml`

从：

```toml
contextRequirements = ["segment", "failed_artifact"]
```

改成：

```toml
contextRequirements = [
  "segment",
  "failed_artifact",
  "character_memory_summary",
  "character_resolution_hints"
]
```

并在 repair prompt 中明确：

1. 已知别名必须回写 canonical
2. 未知 speaker 不要自作主张改名
3. 修复后仍需满足 sourceText 对齐

### 3. Quality

修改 `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml`

从：

```toml
contextRequirements = ["segment_script_draft", "validation_report", "quality_signals", "failed_artifact"]
```

改成：

```toml
contextRequirements = [
  "segment_script_draft",
  "validation_report",
  "quality_signals",
  "failed_artifact",
  "character_memory_summary",
  "character_resolution_evidence"
]
```

quality prompt 的“角色归属是否正确、一致”必须绑定到结构化证据：

1. raw speaker 是否应映射到某 canonical
2. 是否错误保留 alias
3. 是否出现 unresolved speaker
4. 是否与当前 memory snapshot 冲突

## Workflow 语义改造

### 1. 新的 runtime 状态

在 `run-script-production-workflow.ts` 内增加：

- `characterMemorySnapshot`
- `workflowIssues`
- `degradedMode`

### 2. Discovery Failure 规则

#### Bootstrap discovery failure

- `snapshot` 为空：workflow `failed`
- `snapshot` 非空：workflow `completed_with_issues` 的等价内部状态，外部仍可落到 `failed` 或 `completed`，但 summary 必须明确 `degradedMode = true`

#### Incremental discovery failure

- 不终止当前 segment
- 记录 `workflowIssues`
- 更新 `diagnostics.issues`
- 写 trace `character_memory_refresh_failed`

### 3. Manual Review

manual review handoff 需要支持 workflow 级问题，不只支持 segment 级失败。

新增书级 issue 类型，例如：

- `CHARACTER_MEMORY_DEGRADED`
- `CHARACTER_DISCOVERY_FAILED`
- `CHARACTER_ALIAS_CONFLICT`

## Runtime Store 与 Trace

### 新增 artifact 类型

在 runtime artifacts 中新增：

1. `character-memory-snapshot`
2. `character-resolution-evidence`

### 新增 trace 事件

1. `character_memory_bootstrapped`
2. `character_memory_refreshed`
3. `character_memory_refresh_failed`
4. `speaker_canonicalized`
5. `speaker_unresolved_detected`

## 文件级改动范围

### 新增

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/types.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/summary.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/merge.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/canonicalize.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/refresh.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/character-memory/diagnostics.ts`

### 修改

- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/run-script-production-workflow.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/run-character-discovery-pass.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-character-discovery-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-scripting-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-segment-repair-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/mastra/runtime/run-mastra-quality-stage.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production/finalize-segment.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/runtime/script-production-runtime-store.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/artifacts.ts`
- `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/agent-runtime/protocol/events.ts`
- `/Users/xupeng/mycode/txt2voice/skills/json-repair/skill.toml`
- `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/system.md`
- `/Users/xupeng/mycode/txt2voice/skills/json-repair/prompts/user.md`
- `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/skill.toml`
- `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/system.md`
- `/Users/xupeng/mycode/txt2voice/skills/quality-judgement/prompts/user.md`

## 风险与取舍

### 1. 复杂度上升

这是方案 3 的代价。我们用一个正式的 memory pipeline 换掉多个局部 if/patch，复杂度会增加，但这是“显式复杂度替代隐式复杂度”，值。

### 2. prompt 成本增加

repair 和 quality 会多拿到 memory 摘要与 resolution evidence。必须通过统一 summary 层控住字符预算，不能直接传原始 snapshot。

### 3. 增量 discovery 的触发频率

触发过于频繁会放大成本。第一版采用受控触发器，不做每段必刷。

## 验收标准

方案完成后，必须满足：

1. discovery 失败不会再被吞掉。
2. repair 产物会经过统一 canonicalization，不再回退 alias。
3. quality judge 能基于结构化角色证据判断归属一致性。
4. 长书后半段新角色能通过 incremental refresh 进入 memory。
5. workflow summary 能明确反映 memory 版本、degraded mode、discovery failures。

## 实施建议

按以下顺序实施风险最低：

1. 建 `CharacterMemorySnapshot` 与 store
2. 统一 canonicalization 与 summary
3. 接入 repair / quality 契约
4. 重写 workflow failure semantics
5. 最后接 incremental refresh

这个顺序的核心是先统一“事实基线”，再扩展“动态刷新”。不然 refresh 只是把更多不一致推给更多 stage。
