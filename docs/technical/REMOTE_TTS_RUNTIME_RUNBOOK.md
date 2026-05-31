# Remote TTS Runtime Runbook

适用范围：`192.168.88.9` 上的 `txt2voice` Web/API，以及远端 TTS 三件套（IndexTTS / CosyVoice / VoxCPM）。

## 目标

这份文档只解决两类真实问题：

1. 为什么远端会出现“健康检查看起来正常，但真实台本/音频任务卡死、超时、失败”。
2. 当环境再次失稳时，如何用最短路径恢复到“可以直接从 Web/API 跑通”的状态。

## 当前稳定基线

- 远端开发目录：`/root/code/txt2voice`
- 远端 deploy 目录：`/root/deploy/txt2voice-web`
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
- 异步能力约束：LLM / TTS / 质检 / 后续新增异步链路，统一走 Bull job 模型，禁止再新增“函数内直接长耗时出网 + 手写重试”的旁路实现
- 子队列约束：音频父任务仍走 `audio-generation`，句子级 TTS 执行改走 `audio-synthesis`
- 宿主机端口避让：
  - PostgreSQL: `15432`
  - Redis: `16379`

## 关键配置

远端 `/root/code/txt2voice/.env` 当前需要至少包含：

```bash
TASK_QUEUE_NAMESPACE=txt2voice:3001
LLM_DEFAULT_MODEL_ID=remote-qwen
LLM_MODELS_JSON='[{"id":"remote-qwen","label":"Remote Qwen","provider":"custom","apiKey":"","baseURL":"http://192.168.88.9:8028/v1","model":"Qwen3.5-9B-GGUF-Q4_K_M"}]'
LLM_MAX_CONCURRENCY=8
AUDIO_SYNTHESIS_MAX_CONCURRENCY=6
INDEXTTS_TIMEOUT=300000
COSYVOICE_TIMEOUT=300000
VOXCPM_TIMEOUT=300000
INDEXTTS_API_URL=http://192.168.88.9:8001
COSYVOICE_API_URL=http://192.168.88.9:8011
VOXCPM_API_URL=http://192.168.88.9:8012
```

发布专用目录 `/root/deploy/txt2voice-web` 默认通过符号链接复用这份 `.env`：

```bash
/root/deploy/txt2voice-web/.env -> /root/code/txt2voice/.env
```

## 发布原则

### 1. 开发目录和发布目录必须分离

- `/root/code/txt2voice`：允许做排障、查看历史遗留改动、保留运行时配置来源
- `/root/deploy/txt2voice-web`：只用于发布，必须保持 `git status` 干净
- 本地当前工作分支必须和远端 deploy clone 当前分支一致；默认只允许发布当前本地分支

默认发布路径：

```bash
cd /Users/xupeng/mycode/txt2voice
bash scripts/deploy-remote-web.sh --branch <branch>
```

更推荐直接省略 `--branch`，让脚本自动使用当前本地分支：

```bash
cd /Users/xupeng/mycode/txt2voice
bash scripts/deploy-remote-web.sh
```

这条脚本负责：

- 远端 bootstrap deploy clone
- `git fetch + git pull --ff-only`
- `.env` 链接校验
- `docker compose -p txt2voice up -d postgres redis`
- 仅在依赖层文件变化时执行 `docker compose -p txt2voice build web`
- `docker compose -p txt2voice up -d --no-deps web`
- 健康检查

当前远端 `web` 默认使用开发态容器：

- 源码整仓挂载到 `/app`
- 容器内运行 `next dev --webpack`
- 普通代码改动不需要重建镜像
- 只有 `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `apps/web/package.json` / `apps/web/Dockerfile.dev` 变化时才需要 build
- 脚本默认把远端宿主机端口映射改成 PostgreSQL `15432`、Redis `16379`，避免和宿主机已有服务冲突

这条脚本还会额外做两层护栏：

- 如果你显式传入的 `--branch` 和当前本地分支不一致，直接拒绝执行
- 如果远端 deploy clone 已存在，但当前分支和本地分支不一致，也直接拒绝执行

### 2. 手工 rsync 不再是日常发布路径

只有在以下情况，才允许把 `rsync` 当作应急方案：

- GitHub / 远端 SSH 拉取链路临时不可用
- 需要验证一个尚未 push 的热修复
- 已明确接受“不可复现、不可回滚、可追溯性差”的代价

除此之外，默认都走 deploy clone。

## 最重要的运行约束

### 0. 所有重耗时异步能力统一走 job 模型

从这一版开始，以下能力都必须遵守同一套约束：

- 进入共享 Bull 队列
- 并发由 worker concurrency 控制
- 失败重试由 job options 控制
- 超限任务进入 waiting 队列，而不是业务层直接报错

当前已经在这条路上的能力包括：

- 台本生成
- 音频生成
- 句子级 TTS 子 job
- 质检/信号同步
- LLM 调用

后续如果新增远端推理、批量转换、模型评测之类的异步链路，也必须复用这套 job 模型，避免出现第二套不可观测、不可重试、不可限流的执行路径。

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
- `audio-generation` 父任务和 `audio-synthesis` 子 job 由不同版本代码混合消费

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
ssh 192.168.88.9 'cd /root/deploy/txt2voice-web && docker compose up -d postgres redis'
ssh 192.168.88.9 'cd /root/deploy/txt2voice-web && docker compose up -d --no-deps web'
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
   - 推荐参数：`{"options":{"maxSegmentLength":1800,"minSegmentLength":600}}`
4. `POST /api/books/[id]/script/generate`
5. 轮询 `GET /api/books/[id]/script/generate?includePreview=true&previewLines=10`
6. `POST /api/books/[id]/audio/generate`
   - 小批量验证：`type=batch`
   - 全量验收：`type=book`，`provider=voxcpm`
7. 轮询 `GET /api/books/[id]/audio/generate?includeProgress=true`

## Phase 2 脚本化验收

从 `2026-03-18` 起，Phase 2 推荐优先使用脚本化验收，而不是手工拷接口。

脚本位置：

```bash
node scripts/phase2-audio-validation.js
```

### 推荐命令

章节级验证：

```bash
node scripts/phase2-audio-validation.js \
  --base-url http://192.168.88.9:3001 \
  --provider voxcpm \
  --type chapter \
  --book-id <book-id> \
  --chapter-id <chapter-id> \
  --batch-size 1 \
  --repeat-count 1 \
  --review-path docs/review/2026-03-18-phase-2-runtime-validation.md
```

整书级验证：

```bash
node scripts/phase2-audio-validation.js \
  --base-url http://192.168.88.9:3001 \
  --provider voxcpm \
  --type book \
  --book-id <book-id> \
  --batch-size 1 \
  --repeat-count 1 \
  --review-path docs/review/2026-03-18-phase-2-runtime-validation.md
```

### 脚本执行顺序

脚本内部固定执行以下步骤：

1. 先请求 `/api/tts/providers/status?probe=true`
2. 若 provider `healthy != true` 或 `probeHealthy != true`，直接中止
3. probe 通过后，再触发 `/api/books/[id]/audio/generate`
4. 轮询 `/api/books/[id]/audio/generate?includeProgress=true`
5. 从 `taskDetails.metadata.audioReliability` 抽取验收数据
6. 把本轮结果写入 review markdown

### 结果解释

- `completed`
  - probe 通过，音频任务完成，`failedCount=0`
- `partial_failure`
  - probe 通过，任务完成，但 `failedCount>0`
- `failed`
  - probe 通过，但任务状态为 `failed` 或轮询超时
- `probe_failed`
  - provider probe 未通过，或者目标接口没有返回 `probeHealthy`

### 关键提醒

- 如果 `probe=true` 请求返回里没有 `probeHealthy` 字段，优先判定为“远端还没部署 Phase 2 Round 1 代码”，而不是误判成 TTS 本身故障。
- 如果 `/api/books` 返回空列表，说明当前远端没有可直接验证的样本书，先准备验证样本，再跑章节/整书验证。

## 部署前检查清单

在把任意分支部署到远端之前，先按下面顺序检查。

### 1. 本地确认待部署提交

```bash
cd /Users/xupeng/mycode/txt2voice
git branch --show-current
git rev-parse --short HEAD
git status --short
```

期望：

- 当前分支是 `codex/phase-2-audio-reliability`
- 工作区没有意外脏改动

### 2. 远端确认 deploy clone 状态

```bash
ssh 192.168.88.9 '
  cd /root/deploy/txt2voice-web &&
  echo "branch=$(git branch --show-current)" &&
  echo "commit=$(git rev-parse --short HEAD)" &&
  git status --short
'
```

期望：

- 能看清远端当前分支、提交和脏改动
- deploy clone 必须保持干净；一旦有脏改动，优先判定为有人绕过流程手改了发布目录
- deploy clone 当前分支必须和本地当前分支一致；不一致时先手动对齐分支，再发布

### 3. 远端运行约束复核

```bash
ssh 192.168.88.9 'systemctl is-active qwen35-api.service || true'
ssh 192.168.88.9 'docker ps --format "{{.Names}}" | grep txt2voice-worker || true'
ssh 192.168.88.9 'cd /root/deploy/txt2voice-web && docker compose ps'
```

期望：

- `qwen35-api.service` 不是 `active`
- 不存在历史 `txt2voice-worker`
- `postgres / redis / web` 进程状态明确

### 4. 使用标准发布命令

```bash
cd /Users/xupeng/mycode/txt2voice
bash scripts/deploy-remote-web.sh --branch <branch>
```

期望：

- 远端 deploy clone 能完成 `git pull --ff-only`
- `.env` 链接仍指向 `/root/code/txt2voice/.env`
- 普通代码变更只需重启 `txt2voice-web` 即可恢复健康
- 依赖层文件变更时，脚本会先 build 再拉起 `txt2voice-web`

### 5. 部署后最小门禁

部署完成后，第一时间执行：

```bash
curl -sS 'http://192.168.88.9:3001/api/tts/providers/status?probe=true' | jq .
```

期望：

- 目标 provider 返回 `probeHealthy`
- 不再是只有 `healthy/message` 的旧结构

如果这里仍然没有 `probeHealthy`，优先判定为“部署未生效或远端仍在跑旧代码”。

## 最小验证样本准备命令

如果远端 `/api/books` 为空，按下面步骤创建一个最小 Phase 2 验证样本。

### 1. 创建书籍

```bash
BASE_URL='http://192.168.88.9:3001'

BOOK_ID=$(
  curl -sS -X POST "$BASE_URL/api/books" \
    -H 'Content-Type: application/json' \
    -d '{"title":"Phase2 Validation Sample","author":"Codex"}' \
  | jq -r '.data.id'
)

echo "$BOOK_ID"
```

### 2. 上传样本文本

```bash
curl -sS -X POST "$BASE_URL/api/books/$BOOK_ID/upload" \
  -F "file=@/Users/xupeng/mycode/txt2voice/uploads/sample.txt" \
  -F "autoPipelineEnabled=false" \
  | jq .
```

### 3. 执行文本处理

```bash
curl -sS -X POST "$BASE_URL/api/books/$BOOK_ID/process" \
  -H 'Content-Type: application/json' \
  -d '{"options":{"maxSegmentLength":1800,"minSegmentLength":600}}' \
  | jq .
```

### 4. 生成台本

```bash
curl -sS -X POST "$BASE_URL/api/books/$BOOK_ID/script/generate" \
  -H 'Content-Type: application/json' \
  -d '{"limitToSegments":10}' \
  | jq .
```

### 5. 取第一章作为最小验证目标

```bash
CHAPTER_ID=$(
  curl -sS "$BASE_URL/api/books/$BOOK_ID/chapters" \
  | jq -r '.data[0].id'
)

echo "$CHAPTER_ID"
```

### 6. 执行章节级 Phase 2 验收

```bash
node scripts/phase2-audio-validation.js \
  --base-url "$BASE_URL" \
  --provider voxcpm \
  --type chapter \
  --book-id "$BOOK_ID" \
  --chapter-id "$CHAPTER_ID" \
  --batch-size 1 \
  --repeat-count 1 \
  --review-path docs/review/2026-03-18-phase-2-runtime-validation.md
```

### 7. 整书级验证（可选）

章节级稳定后，再跑整书：

```bash
node scripts/phase2-audio-validation.js \
  --base-url "$BASE_URL" \
  --provider voxcpm \
  --type book \
  --book-id "$BOOK_ID" \
  --batch-size 1 \
  --repeat-count 1 \
  --review-path docs/review/2026-03-18-phase-2-runtime-validation.md
```

## 这次已经固定下来的代码修复

本地仓库提交：`0939f4a Improve script generation stability`

包含三处和稳定性直接相关的修复：

1. `apps/web/src/lib/llm/*`（当前运行时真相源；已替代旧 `llm-service.ts`）
   - `max_tokens` 从 `4000` 提高到 `8000`
2. `apps/web/src/lib/agent-runtime/runtime/script-production/options.ts`
   - `maxDialogueLength` 从 `200` 提高到 `800`
3. `apps/web/src/lib/agent-runtime/runtime/script-production/helpers/metadata.ts`
   - 段落失败信息统一收敛为 `segmentPreview` 摘要，避免整段原文淹没关键信息

说明：
- 上述第 2、3 项最初落在旧 `script-generator/*` 管线中，当前仓库已经完成 runtime 收口，真相源以 `agent-runtime/runtime/script-production/*` 为准。

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
2. 文本处理成功，参数为 `maxSegmentLength=1800, minSegmentLength=600`。
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
