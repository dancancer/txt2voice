# Phase 2 Runtime Validation

## 基本信息

- 日期：2026-03-20
- baseUrl：`http://192.168.88.9:3001`
- provider：`voxcpm`
- type：`book`
- bookId：`77c9e754-90a4-4164-8fb8-b26700ee8cba`
- chapterId：`N/A`
- batchSize：`1`
- repeatCount：`1`
- overallVerdict：`completed`

## 运行记录

| Run ID | Probe | Task ID | Status | Verdict | firstPassSuccessRate | retryRounds | averageDurationMs | providerFailures | 备注 |
|---|---|---|---|---|---:|---:|---:|---|---|
| `run-1` | `pass` | `c6383581-e72c-4d9f-861d-d653b93d5061` | `completed` | `completed` | 1 | 0 | 5431 | `[]` | 真实合成可用 |

## 结论

- 本轮结论：`completed`
- 说明：当前脚本以 provider probe + AUDIO_GENERATION task metadata.audioReliability 作为 Phase 2 验收事实源。
