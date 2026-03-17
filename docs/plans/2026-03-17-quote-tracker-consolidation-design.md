# Quote Tracker Consolidation Design

**Goal:** 收敛台本分句与失败段细分中的重复引号栈逻辑，避免 apostrophe 误判再次在多处漂移。

**Problem:**
- `smart-text-splitter.ts`
- `segment-processor.ts`
- `failed-segment-refinement.ts`

这三处都各自维护了一套“进入/退出对白引号”的栈逻辑。当前它们语义本来应该一致，但实现散落，导致某一处修了 ASCII apostrophe，另一处很容易再回归。

**Constraints:**
- 只统一“栈式引号跟踪”这一层。
- 不在本轮强行统一 `findQuotedSpans` 或归属语判断，避免把不同业务语义揉成一个过度抽象。
- 默认不把 ASCII apostrophe `'` 当作对白引号。

**Chosen Approach: Shared quote tracker helper**
- 新建一个共享 helper，提供统一的对白引号对与栈更新函数。
- `smart-text-splitter.ts` 复用 helper 来构建 inside-quote map 与句边界保护。
- `segment-processor.ts` 与 `failed-segment-refinement.ts` 复用 helper 来做句界切分时的引号开闭判定。

**Why this approach:**
- 最小化改动面，只抽出真正重复且语义一致的那一层。
- 直接把这次 review 暴露的 apostrophe 规则固定到共享实现里。
- 保留上层模块各自对白 span、归属语和展示文本的专用策略，不引入额外行为变化。

**Non-goals:**
- 不修改 `segment-script-validator.ts` 的 span 提取策略。
- 不改 `text-segmentation-profile.ts` 中对单引号语义的边界感知统计逻辑。
- 不顺手重写 quote parsing 全部实现。

**Testing Strategy:**
- 先补一个共享 helper 测试，覆盖：
  - ASCII apostrophe 不进入引号态
  - 中文对白引号能正确进入/退出引号态
- 再跑现有回归测试，覆盖：
  - script generation runner 状态机
  - canonicalization
  - failed segment refinement
  - script validator
  - smart text splitter

**Expected Outcome:**
- 引号栈规则只保留一份源实现。
- `I'm / It's / John's` 这类英文缩写不会再次让句界判断漂移。
- 现有 quote-safe segmentation 与 failed refinement 行为保持不变。
