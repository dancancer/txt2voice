# Remote TTS Runtime Runbook

适用范围：`192.168.88.9` 上的 `txt2voice` Web/API，以及远端 TTS 三件套（IndexTTS / CosyVoice / VoxCPM）。

## 目标

这份文档只解决两类真实问题：

1. 为什么远端会出现“健康检查看起来正常，但真实台本/音频任务卡死、超时、失败”。
2. 当环境再次失稳时，如何用最短路径恢复到“可以直接从 Web/API 跑通”的状态。

## 当前稳定基线

- 远端应用目录：`/root/code/txt2voice`
- 远端 TTS 目录：
  - `IndexTTS`: `/root/work/index-tts`
  - `CosyVoice + VoxCPM`: `/root/code/tts-openstack`
- 应用入口：`http://192.168.88.9:3001`
- TTS 入口：
  - `http://192.168.88.9:8001` -> IndexTTS
  - `http://192.168.88.9:8011` -> CosyVoice
  - `http://192.168.88.9:8012` -> VoxCPM
- 队列命名空间：`txt2voice:3001`
- Worker 运行方式：由 `txt2voice-web` 进程内联启动，不再保留独立 `txt2voice-worker`
- 宿主机端口避让：
  - PostgreSQL: `15432`
  - Redis: `16379`

## 关键配置

远端 `/root/code/txt2voice/.env` 当前需要至少包含：

```bash
TASK_QUEUE_NAMESPACE=txt2voice:3001
LLM_API_KEY=<有效值>
LLM_MODEL=deepseek-chat
INDEXTTS_TIMEOUT=300000
COSYVOICE_TIMEOUT=300000
VOXCPM_TIMEOUT=300000
INDEXTTS_API_URL=http://192.168.88.9:8001
COSYVOICE_API_URL=http://192.168.88.9:8011
VOXCPM_API_URL=http://192.168.88.9:8012
```

## 最重要的运行约束

### 1. qwen35 不能和 TTS 长期共机抢 GPU

这次的根因不是路由逻辑，而是显存争用。

当 `qwen35-api.service` 常驻运行时，会直接导致：

- IndexTTS 启动 OOM
- CosyVoice 首次推理抛 `CUDA-capable device(s) is/are busy or unavailable`
- VoxCPM 表面在线，但真实 synth 大量超时

因此当前稳定策略是：

```bash
ssh 192.168.88.9 'systemctl disable --now qwen35-api.service'
```

检查命令：

```bash
ssh 192.168.88.9 'systemctl is-enabled qwen35-api.service || true'
ssh 192.168.88.9 'systemctl is-active qwen35-api.service || true'
ssh 192.168.88.9 'ps -ef | grep qwen35 | grep -v grep || true'
```

### 2. 不要再额外起历史 `txt2voice-worker`

当前代码路径中，`web` 会在请求触发时自动执行 `ensureTaskWorkerStarted()`。

如果同时保留旧 `txt2voice-worker`，容易出现：

- 不同代码版本同时消费队列
- 旧环境变量和新 Web 配置不一致
- 任务落到错误 worker 上，看起来像“接口成功、结果异常”

清理命令：

```bash
ssh 192.168.88.9 'docker rm -f txt2voice-worker >/dev/null 2>&1 || true'
```

## 恢复步骤

### Step 1: 先释放 GPU

```bash
ssh 192.168.88.9 'systemctl disable --now qwen35-api.service'
ssh 192.168.88.9 'nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory,gpu_uuid --format=csv,noheader || true'
```

### Step 2: 拉起 TTS 三件套

```bash
ssh 192.168.88.9 'cd /root/work/index-tts && docker compose -f docker-compose.fastapi.yml up -d'
ssh 192.168.88.9 'cd /root/code/tts-openstack && docker compose up -d cosyvoice-api voxcpm-api'
```

### Step 3: 拉起 txt2voice Web

```bash
ssh 192.168.88.9 'cd /root/code/txt2voice && docker compose up -d postgres redis web'
```

注意：当前 compose 已避开宿主机默认数据库端口，不要再改回 `5432/6379`。

### Step 4: 清理旧队列脏状态（仅在确认没有有效任务时）

```bash
ssh 192.168.88.9 <<'EOS'
docker exec txt2voice-web sh -lc 'cd /app/apps/web && node - <<"NODE"
const Bull = require("bull");
const redisUrl = process.env.REDIS_URL;
const queues = ["txt2voice:3001:script-generation", "txt2voice:3001:dead-letter"];
(async () => {
  for (const name of queues) {
    const q = new Bull(name, redisUrl);
    await q.pause(true).catch(() => {});
    await q.obliterate({ force: true }).catch(() => {});
    await q.close();
  }
})();
NODE'
EOS
```

## 健康检查

### 基础健康

```bash
curl -sS http://192.168.88.9:3001/api/health | jq .
curl -sS http://192.168.88.9:3001/api/tts/providers/status | jq .
```

期望：

- `database.status = healthy`
- `queue.status = healthy`
- `indextts/cosyvoice/voxcpm` 全部 `healthy: true`

### 真正可用性检查

只看 `/api/health` 不够，必须补一轮真实 synth：

```bash
python3 - <<'PY'
import requests
for name, url, payload in [
    ('voxcpm', 'http://192.168.88.9:8012/api/tts/synthesize', {'text': '你好，世界。'}),
    ('cosyvoice', 'http://192.168.88.9:8011/api/tts/synthesize', {'text': '你好，世界。', 'mode': 'cross_lingual', 'reference_audio': 'cross_lingual_prompt.wav'}),
]:
    r = requests.post(url, json=payload, timeout=180)
    print(name, r.status_code, r.text[:200])
PY
```

如果这里卡住，说明服务只是“看起来在线”。

## 推荐验收顺序

完整链路不要一上来就点全自动，先按下面顺序走：

1. `POST /api/books`
2. `POST /api/books/[id]/upload`
3. `POST /api/books/[id]/process`
   - 推荐参数：`{"options":{"useSmartSplitter":false,"maxSegmentLength":1800,"minSegmentLength":600}}`
4. `POST /api/books/[id]/script/generate`
5. 轮询 `GET /api/books/[id]/script/generate?includePreview=true&previewLines=10`
6. `POST /api/books/[id]/audio/generate`
   - 小批量验证：`type=batch`
   - 全量验收：`type=book`，`provider=voxcpm`
7. 轮询 `GET /api/books/[id]/audio/generate?includeProgress=true`

## 这次已经固定下来的代码修复

本地仓库提交：`0939f4a Improve script generation stability`

包含三处和稳定性直接相关的修复：

1. `apps/web/src/lib/llm-service.ts`
   - `max_tokens` 从 `4000` 提高到 `8000`
2. `apps/web/src/lib/script-generator/options.ts`
   - `maxDialogueLength` 从 `200` 提高到 `800`
3. `apps/web/src/lib/script-generator/pipeline/segment-processor.ts`
   - 日志从整段原文改成长度摘要，避免日志淹没关键信息

## 当前结论

- 远端 `/api/tts/providers/status` 已恢复三家全绿
- 远端 `/api/books/[id]/script/generate` 已验证可成功完成增量台本生成
- 远端 `/api/books/[id]/audio/generate` 已验证可成功完成批量音频生成
- 远端现在具备“真实请求可跑通”的条件

## 2026-03-08 全量验收记录

使用文件：`/Users/xupeng/mybase/qwen35_eval/test.txt`

远端全量验收书籍：`f70a50be-6b7d-42e2-a1bd-92d84b8cd649`

最终结果：

- 书籍状态：`completed`
- 章节数：`4`
- 段落数：`5`
- 台本句数：`80`
- 角色数：`6`
- 句级音频：`80`
- 合并音频：`1`
- 合计音频文件：`81`
- 合并文件：`/app/apps/web/uploads/audio/f70a50be-6b7d-42e2-a1bd-92d84b8cd649/merged/remote_full_verify_2026-03-08_10_45_full_1772942249478.mp3`
- 合并结果时长：约 `400s`

验收过程摘要：

1. 上传成功。
2. 文本处理成功，参数为 `useSmartSplitter=false, maxSegmentLength=1800, minSegmentLength=600`。
3. 台本生成成功，`failedSegments=0`。
4. 第 1 次全量音频生成（`batchSize=4`）出现 `VoxCPM 500`，成功 `54/80`。
5. 第 2 次重跑（`batchSize=2`）收敛到 `75/80`。
6. 第 3 次重跑（`batchSize=1`）完成 `80/80`。
7. 最终整书合并成功。

结论：

- 远端 `txt2voice` 已可通过 Web/API 跑完整书籍流程。
- 远端 TTS 服务在真实负载下可工作，但 `VoxCPM` 在更高并发下仍有瞬时 `500`，当前推荐全量音频生成使用“先较小批量跑，再对失败项做低并发重试”的策略。

## 未决风险

1. 远端代码目录仍有未提交修改，后续部署要避免把旧逻辑重新带回。
2. 三套 TTS 仍然共机，若再启动其他大模型服务，仍可能重新触发显存争抢。
3. 全书级远端验收耗时较长，建议在低峰期执行，并把真实 synth 作为准入门槛，而不是只看 `/api/health`。
