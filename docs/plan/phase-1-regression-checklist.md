# Phase 1 回归清单（首轮验收）

> 版本：v1
> 
> 执行日期：2026-03-01

## A. 接口与契约

- [x] `GET /api/books/:id` 返回统一 `counts + latestTask + stats` 结构
- [x] `include=audioFiles` 可返回播放页所需字段（含句子文本与角色名）
- [x] 兼容保留 `_count` 字段，不破坏旧页面

## B. 状态机与任务真相

- [x] 台本入口状态收敛到 `processed/script_generated/completed/completed_with_errors`
- [x] 台本失败回退不再写回 `analyzed`，统一回到 `processed`
- [x] 音频生成结果可区分：`completed` / `completed_with_errors` / 全量失败
- [x] 全量失败不再停留在 `generating_audio`

## C. 质量链路

- [x] `tone/strength/pauseAfter/ttsParameters` 落库并参与 TTS 请求映射
- [x] Provider 选择贯通到音频生成器
- [x] 无角色（旁白）句子存在默认声线兜底

## D. 前端关键路径

- [x] 概览页使用统一计数字段，不依赖详情数组长度
- [x] 音频页使用统一计数字段，状态展示与概览一致
- [x] 播放页改为显式请求 `include=audioFiles`，移除占位文案（`111`）
- [x] 导航文案移除测试标记（`角色配置(测试)` -> `角色配置`）

## E. 自动检查结果

- [x] `pnpm --filter web typecheck`
- [x] `pnpm --filter web lint`

## F. 回归基线补充（持续）

- [x] 新增固定回归样本（短篇/长篇/多角色）
- [x] 新增 `test:regression` 回归测试入口
- [x] 新增 nightly 回归 workflow（含手动触发）

## 备注

- lint 仅有 baseline-browser-mapping 数据版本提示，不影响功能正确性。
- 持久队列与 worker 已进入主链路，详细实现见 `docs/plan/state-machine-v2.md` 与队列代码实现。

## G. Phase 1 Closeout 样本清单（待执行）

### G.1 样本来源

- 真实样本书：`uploads/sample.txt`
- 固定回归样本：
  - `apps/web/src/test-fixtures/regression/short-dialogue.txt`
  - `apps/web/src/test-fixtures/regression/multi-role-scene.txt`
  - `apps/web/src/test-fixtures/regression/long-narrative.txt`
- 真实失败片段：`待补充（建议从最近一轮 SCRIPT_VALIDATION issueDetail / failedSegmentDetails 中选 1-2 组）`

### G.2 Closeout 执行记录

| 样本 | 来源 | 目标问题 | 运行次数 | 结果 | 备注 |
|---|---|---|---:|---|---|
| `uploads/sample.txt` | 本地统一测试书 | 漏段 / 重复对白 / 边界漂移 | 3 | `已执行` | `3 次完整运行均为 24 lines / 7 failed segments / 7 pending SCRIPT_VALIDATION；失败模式稳定但尚未通过 closeout` |
| `short-dialogue.txt` | 固定回归样本 | 对白抽取 | 0 | `待执行` | `待填写` |
| `multi-role-scene.txt` | 固定回归样本 | 多角色 / 对白边界 | 0 | `待执行` | `待填写` |
| `long-narrative.txt` | 固定回归样本 | 长段截断 / 覆盖率 | 0 | `待执行` | `待填写` |
| `真实失败片段 A` | 历史 issueDetail | `待填写` | 0 | `待执行` | `待填写` |

### G.3 Closeout 判定规则

- 至少 1 个真实样本书 + 1 组真实失败片段被纳入 Phase 1 closeout。
- 每个样本至少记录一次结果摘要；收敛性样本需在 `docs/plan/2026-03-12-phase-1-convergence-runbook.md` 中按多次运行补全。
- 若样本仍出现明显漏段、重复对白或对白/旁白边界错误，必须先回到 Phase 1 修复，再讨论结项。

