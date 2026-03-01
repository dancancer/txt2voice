# 队列可靠性规则 v1

> 版本：v1
> 
> 日期：2026-03-01

## 范围

- 台本生成任务：`SCRIPT_GENERATION`
- 音频生成任务：`AUDIO_GENERATION`

## 机制清单

1. **持久队列执行**
   - 台本队列：`txt2voice:script-generation`
   - 音频队列：`txt2voice:audio-generation`
2. **失败重试**
   - 默认 `attempts=3`
   - 指数退避（台本 10s、音频 15s）
3. **死信队列（DLQ）**
   - 队列名：`txt2voice:dead-letter`
   - 最终失败任务会写入 DLQ，便于排查与手工补救
4. **任务心跳**
   - worker 执行期间每 10 秒刷新 `heartbeatAt`
   - 心跳写入 `processingTask.taskData.metadata`
5. **卡死恢复（watchdog）**
   - `status=processing` 且超过阈值（默认 5 分钟）会触发恢复检查
   - 队列无可运行 job 时自动重放
6. **手动重放接口**
   - `POST /api/tasks/:taskId/replay`
   - 默认 `force=true`，可通过 body 传 `{"force": false}` 控制复用在跑 job
   - 必须携带重放凭证（`x-txt2voice-replay-token` 或 `Authorization: Bearer <token>`）

## 参数

- `TASK_HEARTBEAT_INTERVAL_MS`：心跳间隔，默认 `10000`
- `TASK_STALLED_THRESHOLD_MS`：卡死判定阈值，默认 `300000`
- `TASK_RECOVERY_COOLDOWN_MS`：自动恢复冷却，默认 `60000`
- `TASK_RECOVERY_BATCH_SIZE`：每次恢复扫描任务数，默认 `20`
- `TASK_REPLAY_API_TOKEN`：手动重放接口鉴权 token（未配置则拒绝重放请求）

## 运维建议

1. 发现任务长期 `processing` 时，先查看任务 `metadata.heartbeatAt`
2. 若自动恢复未生效，调用重放接口触发手动恢复
3. 对多次失败任务，优先查看 DLQ 记录中的 `errorMessage` 与 `payload`
