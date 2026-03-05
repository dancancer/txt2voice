# Remote TTS Stack（192.168.88.9）

## 目标

在现有 `IndexTTS` 服务（`8001`）之外，补齐两条开源模型能力：

- `CosyVoice`（偏综合质量与多场景生成）
- `VoxCPM`（偏低延迟流式与表达力）

## 服务端口

- `http://192.168.88.9:8001`：IndexTTS（现有）
- `http://192.168.88.9:8011`：CosyVoice API（新增）
- `http://192.168.88.9:8012`：VoxCPM API（新增）

## 目录结构

```text
/root/code/tts-openstack/
  docker-compose.yml
  cosyvoice-api/
  voxcpm-api/
  data/
    cosyvoice/{uploads,outputs,models}
    voxcpm/{uploads,outputs,models}
```

## 快速部署

```bash
cd /root/code/tts-openstack
docker compose build
docker compose up -d
```

## 健康检查

```bash
curl http://127.0.0.1:8011/api/health
curl http://127.0.0.1:8012/api/health
```

## 统一调用约定（两个服务都支持）

- `GET /api/health`
- `GET /api/audio/list`
- `POST /api/audio/upload`
- `POST /api/tts/synthesize`
- 生成音频静态地址：`/files/outputs/<filename>`

## 注意

- 模型首次调用会自动下载，首个请求耗时较长。
- GPU 分配：CosyVoice 绑定 `GPU0`，VoxCPM 绑定 `GPU1`。
