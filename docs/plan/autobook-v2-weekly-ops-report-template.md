# AutoBook V2 周运营验收模板

> 用途：固定每周验收口径，围绕 `目标值 vs 实际值 vs 异常处置` 做复盘。
> 数据来源：
> - `GET /api/books/[id]/slo/metrics`
> - `POST /api/slo/alerts/scan`
> - `GET /api/books/[id]/qc/dispatch-events?issueType=SLO`
> - 任务中心 / 复核工作台

## 1. 基本信息

- 周期：
- 负责人：
- 样本范围：
- 数据窗口：最近 7 天 / 14 天 / 30 天
- 结论：通过 / 有风险 / 不通过

## 2. 核心 SLO 对照

| 指标 | 目标值 | 实际值 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| `pipeline_success_rate` | `>=95%` |  |  |  |
| `sentence_pass_rate_first_try` |  |  |  |  |
| `avg_retry_per_sentence` |  |  |  |  |
| `manual_review_ratio` |  |  |  |  |
| `chapter_consistency_fail_rate` | `<3%` |  |  |  |

## 3. 事件与告警摘要

- 本周 SLO 告警总数：
- `open`：
- `acked`：
- `resolved`：
- 主要告警代码：
- 是否出现重复噪声：是 / 否

## 4. 质量闭环观察

- 自动返工是否收敛：
- 人工复核 backlog：
- `FINAL_ASSEMBLY` 是否存在失败：
- `MANUAL_REVIEW_SYNC` 是否存在积压：
- 主要 issueType：

## 5. 异常处置记录

| 时间 | 现象 | 根因判断 | 已执行动作 | 当前状态 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## 6. 下周动作

1. 
2. 
3. 

## 7. 发布判断

- 是否满足当前发布条件：是 / 否
- 若否，阻塞项：
- 若是，建议动作：继续灰度 / 全量发布 / 继续观察
