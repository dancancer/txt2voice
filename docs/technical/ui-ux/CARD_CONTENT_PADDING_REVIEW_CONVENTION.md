# CardContent 顶部内边距审查约定

## 背景

`CardContent` 组件的默认样式定义在 `apps/web/src/components/ui/card.tsx`：

- `p-6 pt-0`

这意味着：即使业务页面在 `className` 里追加了 `p-*`，顶部内边距也可能仍被默认 `pt-0` 压住，导致卡片内容“贴顶”。

## 审查规则（强制）

1. 当 `CardContent` 使用 `p-*` 或 `py-*`（且不是 `0`）时，必须显式声明 `pt-*`（推荐 `!pt-*`）。
2. 当业务意图是“顶部不留白”时，必须显式写 `pt-0`（避免隐式依赖默认值）。
3. `p-0` 场景可豁免，不强制追加 `pt-0`。
4. Code Review 中发现未满足规则的写法，按 UI 缺陷处理，必须修复后合并。

## 推荐写法

### Bad

```tsx
<CardContent className="p-6 space-y-4" />
<CardContent className="py-4 text-sm" />
```

### Good

```tsx
<CardContent className="p-6 !pt-6 space-y-4" />
<CardContent className="py-4 !pt-4 text-sm" />
<CardContent className="p-6 pt-0 text-sm" /> // 明确声明“顶部为 0”
```

## PR 审查清单

- 是否新增或修改了 `CardContent` 的 `className`。
- 只要出现 `p-*` / `py-*`（非 0），是否同步显式设置了 `pt-*`。
- 是否存在“看起来设置了 padding，但顶部仍贴顶”的视觉回归风险。
- 移动端（375px）和桌面端（1280px）是否都验证了卡片顶部留白。

## 自动化检查

项目提供脚本：

```bash
pnpm check:card-content-padding
```

脚本位置：`scripts/check-card-content-padding.js`。

建议在本地提测、PR 自检与 CI 中执行；如失败，按输出的文件与行号直接修复。
