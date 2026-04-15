# Technical Debt Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用最小风险、可持续的方式收敛 txt2voice 当前最危险的技术债，先恢复质量门可信度，再逐步消除双轨架构、超大编排器和类型契约漂移。

**Architecture:** 本次治理不推翻现有 LLM-only 主链，而是在现有 `apps/web/src/lib/agent-runtime` 主链上做“边界收口 + 编排拆分 + 契约加固”。治理顺序遵循先止血、后减重、再固化治理机制：先修质量门和工具链，再拆高风险编排器，最后补 ADR 和长期指标。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Prisma, Mastra runtime, PNPM monorepo, ESLint.

---

## 执行总原则

1. 先恢复工程信号可信度，再谈深度重构。
2. 不在一个任务里同时做“行为修改 + 架构迁移 + UI 重写”。
3. 每个任务都必须有明确验证命令，不能靠肉眼判断“应该没问题”。
4. 优先消除特殊情况和重复源头，不给旧层继续打补丁。
5. 任何超过 400 行且持续承载新需求的文件，都视为待拆编排器。

### Task 1: 收紧 lint 边界，隔离生成产物噪声

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/eslint.config.mjs`
- Verify: `/Users/xupeng/mycode/txt2voice/apps/web/.mastra/output`

**Step 1: 确认当前 lint 边界缺口**

Run: `pnpm lint`
Expected: 根 lint 会扫描 `.mastra/output`，输出 baseline / Babel deoptimised 噪声，质量门信号变脏。

**Step 2: 写最小配置修复**

实现要点：
- 在 `ignores` 中加入 `.mastra`
- 保持现有 `node_modules`、`.next`、`dist`、`coverage` 忽略策略不变

**Step 3: 仅对 src 运行 eslint 验证行为没有被误伤**

Run: `pnpm --filter web exec eslint src --ext .js,.ts,.jsx,.tsx`
Expected: PASS

**Step 4: 回归根 lint**

Run: `pnpm lint`
Expected: 不再被 `.mastra/output` 生成物污染；若仍失败，失败必须来自真实源码。

**Step 5: Commit**

```bash
git add apps/web/eslint.config.mjs
git commit -m "chore: ignore mastra build output in lint"
```

### Task 2: 修复 Prisma bridge 与测试桩契约漂移

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/prisma-module.test.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/quality-check-runner-signal-sync.test.ts`
- Reference: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/prisma.ts`
- Reference: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/quality-check-runner.ts`

**Step 1: 写清楚桥接契约**

要求：
- 应用层统一从 `@/lib/prisma` 拿 `default prisma` 与 `Decimal`
- 测试 mock 必须 mock `Decimal` 顶层导出，而不是只 mock `Prisma.Decimal`

**Step 2: 修复 typecheck 失败**

Run: `pnpm typecheck`
Expected: 当前失败点集中在 `prisma-module.test.ts`

**Step 3: 修复两组 quality-check 测试桩**

实现要点：
- `jest.mock("@/lib/prisma", ...)` 里显式导出 `Decimal`
- 保持现有 `default` mock 结构不变，避免扩大回归面

**Step 4: 定点回归**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/quality-check-runner-signal-sync.test.ts src/lib/__tests__/prisma-module.test.ts`
Expected: PASS

**Step 5: 全量质量门回归**

Run: `pnpm typecheck && pnpm test -- --runInBand`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/lib/__tests__/prisma-module.test.ts apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts apps/web/src/lib/__tests__/quality-check-runner-signal-sync.test.ts
git commit -m "test: align prisma bridge mocks with runtime exports"
```

### Task 3: 拆分 `quality-check-runner`，把高风险决策从巨型文件中抽离

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/quality-check-runner.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/quality-check/persistence.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/quality-check/reprocessing-dispatch.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/quality-check/task-context.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/quality-check-runner-reprocessing.test.ts`
- Test: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/__tests__/quality-check-runner-signal-sync.test.ts`

**Step 1: 先抽上下文解析，不改行为**

目标：
- 把 `taskData.metadata` 解析逻辑迁到 `task-context.ts`
- `quality-check-runner.ts` 只保留 orchestrator

**Step 2: 抽持久化写库**

目标：
- 把 `qualityCheckResult.create`、`audioFile.update`、`chapterQualityAudit.create` 聚合到 `persistence.ts`

**Step 3: 抽人工复核/二次派单策略**

目标：
- 把 `manualReviewItem.findMany/findFirst/create/update` 相关策略迁到 `reprocessing-dispatch.ts`

**Step 4: 每次抽一块就跑定点测试**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/quality-check-runner-reprocessing.test.ts src/lib/__tests__/quality-check-runner-signal-sync.test.ts`
Expected: PASS

**Step 5: 完成后控制主文件规模**

Expected:
- `quality-check-runner.ts` 降到 800 行以内
- 新文件职责清晰，不制造循环依赖

**Step 6: Commit**

```bash
git add apps/web/src/lib/quality-check-runner.ts apps/web/src/lib/quality-check/persistence.ts apps/web/src/lib/quality-check/reprocessing-dispatch.ts apps/web/src/lib/quality-check/task-context.ts
git commit -m "refactor: split quality check orchestration boundaries"
```

### Task 4: 收口双轨台本页面，消除重复组件树

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/script/page.tsx`
- Delete or Move: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/script/components/*`
- Reference: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/components/*`
- Reference: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/books/[id]/studio/script/page.tsx`

**Step 1: 固定目标架构**

决定：
- `/books/[id]/script` 仅作为兼容入口
- 真正工作台只保留 `/books/[id]/studio/script`

**Step 2: 确认重复组件没有外部引用**

Run: `rg -n "books/\\[id\\]/script/components" apps/web/src`
Expected: 没有必须保留的独立引用

**Step 3: 删除重复目录或改成单点 re-export**

原则：
- 优先删除重复副本
- 如果要保留兼容层，只允许薄包装，不允许第二份真源码

**Step 4: 回归页面**

Run: `pnpm --filter web test -- --runInBand src/components/__tests__/Navigation.test.tsx src/app/__tests__/script-studio-model-switching.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/books/[id]/script apps/web/src/app/books/[id]/studio/script
git commit -m "refactor: collapse duplicate script workspace components"
```

### Task 5: 收紧高风险边界类型，优先清理角色与 TTS 输入输出

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/books/[id]/characters/[characterId]/route.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/app/api/tts/voices/route.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/book-api.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/tts-service.ts`
- Modify: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/indextts-service.ts`
- Create: `/Users/xupeng/mycode/txt2voice/apps/web/src/lib/tts-contract.ts`

**Step 1: 先定义 contract，再替换 `any`**

目标：
- 为 voice/provider/synthesis payload 建显式接口
- 为 character route request/response 建显式接口

**Step 2: 从 API 边界往内替换**

原则：
- 先 route，再 service，再 UI
- 不从内部实现反推类型泥团

**Step 3: 定点回归**

Run: `pnpm --filter web test -- --runInBand src/lib/__tests__/llm-provider-client.test.ts src/lib/__tests__/script-generate-route.test.ts`
Expected: PASS

**Step 4: 质量阈值**

Expected:
- 当前热点文件 `any` 数量明显下降
- 不为清掉 `any` 引入过度抽象

**Step 5: Commit**

```bash
git add apps/web/src/app/api/books/[id]/characters/[characterId]/route.ts apps/web/src/app/api/tts/voices/route.ts apps/web/src/lib/book-api.ts apps/web/src/lib/tts-service.ts apps/web/src/lib/indextts-service.ts apps/web/src/lib/tts-contract.ts
git commit -m "refactor: tighten character and tts boundary contracts"
```

### Task 6: 建立架构治理机制，把治理成果固化下来

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/docs/adr/README.md`
- Create: `/Users/xupeng/mycode/txt2voice/docs/adr/0001-agent-runtime-boundary.md`
- Create: `/Users/xupeng/mycode/txt2voice/docs/adr/0002-script-workspace-source-of-truth.md`
- Modify: `/Users/xupeng/mycode/txt2voice/ARCHITECTURE.md`

**Step 1: 建 ADR 目录和模板**

要求：
- 每个 ADR 含 Context / Options / Decision / Consequences
- 明确 superseded 机制

**Step 2: 先补两份欠账最大的 ADR**

内容：
- `agent-runtime` 与 `runner/service/route` 的职责边界
- `/script` 与 `/studio/script` 的单一真相源

**Step 3: 在总架构文档挂入口**

Run: `rg -n "docs/adr|ADR" ARCHITECTURE.md README.md docs`
Expected: 新入口可发现

**Step 4: Commit**

```bash
git add docs/adr ARCHITECTURE.md
git commit -m "docs: establish adr governance for runtime boundaries"
```

## 里程碑与优先级

### Immediate Sprint
- Task 1
- Task 2

### Next Sprint
- Task 3
- Task 4

### Next Quarter
- Task 5
- Task 6

## 质量门

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test -- --runInBand`

## 退出条件

- 根质量门恢复可信且可重复
- 活跃契约漂移消失
- 至少一个超大编排器完成职责拆分
- 台本工作台只有一个真源
- ADR 机制落地并开始使用
