# IndexTTS FastAPI 服务文档

## 🚀 概述

为 IndexTTS 项目新增了完整的 FastAPI 服务，提供 RESTful API 接口用于语音合成、参考音频浏览和上传功能。

## 📁 新增文件

### 核心服务文件
- **`fastapi_server.py`** - FastAPI 应用主文件
- **`Dockerfile.fastapi`** - FastAPI 专用 Docker 配置
- **`docker-compose.fastapi.yml`** - FastAPI 服务编排配置
- **`start_fastapi.sh`** - FastAPI 启动脚本

### 客户端和测试文件
- **`fastapi_client_examples.py`** - Python 客户端示例代码
- **`test_fastapi.py`** - API 接口测试脚本

## 🔗 API 接口总览

### 基础接口
| 端点 | 方法 | 描述 |
|------|------|------|
| `/` | GET | 服务根信息 |
| `/docs` | GET | Swagger API 文档 |
| `/redoc` | GET | ReDoc API 文档 |
| `/api/health` | GET | 健康检查 |

### 音频管理接口
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/audio/list` | GET | 获取所有参考音频文件列表 |
| `/api/audio/upload` | POST | 上传参考音频文件 |
| `/api/audio/{filename}` | DELETE | 删除上传的音频文件 |
| `/api/audio/analyze` | POST | 分析音频文件，提取说话人特征 |
| `/api/audio/compare-speakers` | POST | 比较两个音频的说话人相似度 |

### 语音合成接口
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/tts/synthesize` | POST | 语音合成（支持多种情感控制） |
| `/api/tts/tasks/{task_id}` | GET | 获取任务状态 |

## 🎯 主要功能特性

### 1. 参考音频浏览
- 自动发现内置示例音频 (`examples/`)
- 支持用户上传音频 (`uploads/`)
- 返回文件信息和下载链接
- 区分音频类型：example, uploaded, emotion

### 2. 参考音频上传
- 支持多种音频格式：wav, mp3, flac, m4a, ogg
- 自动生成唯一文件名
- 文件大小和格式验证
- 返回上传文件信息

### 3. 音频分析
- **说话人识别**: 基于 CampPlus 模型提取说话人嵌入向量
- **音频特征**: 提取时长、采样率、振幅等基础信息
- **说话人ID**: 生成唯一的说话人标识符
- **置信度评估**: 提供分析结果的可信度分数

### 4. 说话人比较
- **相似度计算**: 余弦相似度和欧氏距离
- **同一说话人判断**: 基于相似度阈值判断是否为同一说话人
- **概率评估**: 提供同一说话人的概率分数

### 5. 语音合成
- **基础合成**：使用参考音频生成语音
- **情感控制**：三种情感控制方式
  - 与参考音频情感相同
  - 使用单独的情感参考音频
  - 使用情感向量控制（8维情感空间）
- **高级参数**：采样、温度、beam search 等参数调节

## 🛠️ 部署方式

### 方式 1：独立部署（推荐）
```bash
# 构建并启动 FastAPI 服务
docker compose -f docker-compose.fastapi.yml up --build -d

# 查看服务状态
docker compose -f docker-compose.fastapi.yml ps

# 查看日志
docker compose -f docker-compose.fastapi.yml logs -f
```

### 方式 2：在现有容器中运行
```bash
# 复制 FastAPI 服务文件
docker cp fastapi_server.py index-tts-gpu:/app/

# 安装依赖
docker exec index-tts-gpu bash -c "cd /app && uv add fastapi uvicorn python-multipart"

# 启动服务（需要足够 GPU 内存）
docker exec index-tts-gpu bash -c "cd /app && uv run python fastapi_server.py"
```

## 📖 使用示例

### Python 客户端示例
```python
import requests

# 基础语音合成
response = requests.post("http://192.168.88.9:8001/api/tts/synthesize", json={
    "text": "你好，这是 FastAPI 语音合成测试！",
    "reference_audio": "voice_01.wav",
    "emo_control_method": "Same as the voice reference",
    "emotion_weight": 0.65
})

result = response.json()
print(f"合成结果: {result}")
print(f"音频URL: http://192.168.88.9:8001{result['audio_url']}")
```

### 情感向量控制示例
```python
# 开心情感
response = requests.post("http://192.168.88.9:8001/api/tts/synthesize", json={
    "text": "今天天气真好，我感到很开心！",
    "reference_audio": "voice_01.wav",
    "emo_control_method": "Use emotion vectors",
    "emotion_vector": {
        "happy": 0.8,
        "angry": 0.0,
        "sad": 0.0,
        "afraid": 0.0,
        "disgusted": 0.0,
        "melancholic": 0.0,
        "surprised": 0.3,
        "calm": 0.2
    },
    "emotion_weight": 0.7
})
```

### 音频文件上传示例
```python
files = {'file': ('test.wav', open('test.wav', 'rb'), 'audio/wav')}
data = {'description': '测试音频'}

response = requests.post("http://192.168.88.9:8001/api/audio/upload", files=files, data=data)
uploaded_file = response.json()
print(f"上传成功: {uploaded_file['url']}")
```

### 音频分析示例
```python
# 分析单个音频文件
response = requests.post("http://192.168.88.9:8001/api/audio/analyze", json={
    "audio_file": "voice_01.wav"
})

result = response.json()
print(f"文件名: {result['filename']}")
print(f"时长: {result['duration']:.2f} 秒")
print(f"说话人ID: {result['speaker_id']}")
print(f"置信度: {result['confidence']:.4f}")
print(f"嵌入向量维度: {result['embedding_shape']}")
```

### 说话人比较示例
```python
# 比较两个音频的说话人相似度
response = requests.post("http://192.168.88.9:8001/api/audio/compare-speakers", json={
    "audio_file1": "voice_01.wav",
    "audio_file2": "voice_02.wav"
})

comparison = response.json()
print(f"余弦相似度: {comparison['cosine_similarity']:.4f}")
print(f"欧氏距离: {comparison['euclidean_distance']:.4f}")
print(f"同一说话人概率: {comparison['same_speaker_probability']:.4f}")
print(f"是否同一说话人: {'是' if comparison['is_same_speaker'] else '否'}")
```

## 🎛️ 情感向量参数

FastAPI 接口提供了完整的 8 维情感向量控制：

| 维度 | 情感 | 范围 | 说明 |
|------|------|------|------|
| happy | 喜 | 0.0-1.0 | 开心、愉快 |
| angry | 怒 | 0.0-1.0 | 愤怒、生气 |
| sad | 哀 | 0.0-1.0 | 悲伤、难过 |
| afraid | 惧 | 0.0-1.0 | 害怕、恐惧 |
| disgusted | 厌恶 | 0.0-1.0 | 厌恶、反感 |
| melancholic | 低落 | 0.0-1.0 | 低落、沮丧 |
| surprised | 惊喜 | 0.0-1.0 | 惊喜、吃惊 |
| calm | 平静 | 0.0-1.0 | 平静、冷静 |

## 🔧 配置说明

### 服务端口
- **FastAPI 服务**: 8001
- **API 文档**: http://192.168.88.9:8001/docs
- **ReDoc 文档**: http://192.168.88.9:8001/redoc

### GPU 配置
- **默认**: CUDA_VISIBLE_DEVICES=1
- **建议**: 与现有 WebUI 服务使用不同的 GPU
- **内存优化**: 启用 FP16 减少内存占用

### 目录映射
- `/uploads` - 用户上传的音频文件
- `/outputs` - 生成的语音文件
- `/examples` - 内置示例音频（只读）
- `/checkpoints` - 模型文件（只读）

## ⚠️ 注意事项

1. **GPU 内存**: FastAPI 服务需要独立的 GPU 内存，建议与 WebUI 使用不同 GPU
2. **文件大小**: 上传音频文件大小建议不超过 100MB
3. **并发限制**: 由于 GPU 内存限制，同时处理大量请求可能需要排队
4. **模型初始化**: 首次启动需要加载模型，可能需要较长时间

## 🧪 测试

运行提供的测试脚本：

```bash
# 运行完整接口测试
python test_fastapi.py

# 运行客户端示例
python fastapi_client_examples.py
```

## 🔄 与 WebUI 对比

| 功能 | WebUI | FastAPI |
|------|-------|---------|
| 交互方式 | 图形界面 | REST API |
| 批量处理 | 手动 | 程序化 |
| 情感控制 | ✅ 完整 | ✅ 完整 |
| 音频上传 | ✅ | ✅ |
| 参数调节 | ✅ | ✅ 更灵活 |
| 集成性 | ❌ | ✅ 易于集成 |

## 🎉 总结

FastAPI 服务为 IndexTTS 提供了完整的程序化接口，支持：

- ✅ 完整的语音合成功能
- ✅ 灵活的情感控制
- ✅ 参考音频管理
- ✅ RESTful API 设计
- ✅ 自动 API 文档
- ✅ Docker 容器化部署
- ✅ 丰富的客户端示例

现在你可以通过 API 轻松集成 IndexTTS 到各种应用中了！