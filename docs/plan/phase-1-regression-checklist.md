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
