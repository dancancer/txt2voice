# Docker 镜像拉取问题分析与解决方案

## 🔍 问题诊断结果

经过全面检查，当前环境无法拉取 Docker 镜像的根本原因是：

### 1. 网络连接问题
- **官方 Docker Hub**: 100% 丢包，无法连接
- **配置的镜像源**: `docker.1panel.live` 返回 "only support mainland China" 错误

### 2. 地理位置限制
- 当前服务器 IP 可能被识别为非中国大陆地区
- 1panel 镜像源仅支持中国大陆 IP 访问

### 3. DNS 解析正常
- `registry-1.docker.io` DNS 解析正常 (199.59.149.136)
- 问题出在网络连接层面，可能是防火墙或代理阻断

## 🛠️ 解决方案

### 方案 1: 配置国内可用的镜像源

创建或编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
    "https://ccr.ccs.tencentyun.com"
  ],
  "insecure-registries": [],
  "debug": false,
  "experimental": false
}
```

重启 Docker：
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方案 2: 使用代理服务器

如果使用代理，配置 Docker 代理：

```bash
# 创建 systemd 目录
sudo mkdir -p /etc/systemd/system/docker.service.d

# 创建代理配置文件
sudo tee /etc/systemd/system/docker.service.d/proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:8080"
Environment="HTTPS_PROXY=http://proxy.example.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF

# 重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方案 3: 本地开发替代方案

#### 3.1 使用本地 Python 环境

既然无法使用 Docker，可以直接使用本地 Python 环境：

```bash
# 安装依赖
cd apps/character-recognition
pip install -r requirements.txt

# 启动服务
python main.py
```

#### 3.2 修改 requirements.txt 兼容当前环境

由于 TensorFlow 2.10.1 版本不可用，创建兼容版本：

```txt
# Web Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-multipart==0.0.6

# NLP Core
hanlp[full]==2.1.0b54
tensorflow>=2.16.0  # 使用可用版本
transformers==4.35.2
safetensors==0.4.1

# Text Embedding & Similarity
sentence-transformers==2.3.1
text2vec==1.2.1

# Vector Search - CPU 版本
faiss-cpu==1.7.4

# 其他依赖保持不变...
```

### 方案 4: 预下载镜像文件

在能够访问外网的环境下载镜像，然后传输：

```bash
# 在有网络的环境
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker save postgres:16-alpine redis:7-alpine -o images.tar

# 传输到目标服务器并加载
docker load -i images.tar
```

## 🚀 立即可用的测试方案

### 1. 使用本地 Python 进行角色识别测试

```bash
# 安装必要的依赖
pip install fastapi uvicorn hanlp sentence-transformers loguru

# 启动角色识别服务
cd apps/character-recognition
python main.py &

# 测试 API
curl -X POST "http://localhost:8001/recognize" \
  -H "Content-Type: application/json" \
  -d '{"text": "二娘和小然在街上说话"}'
```

### 2. 使用简化版识别脚本

创建一个简化的测试脚本：

```python
# test_recognition.py
import sys
import os
sys.path.append('apps/character-recognition')

from src.recognizer import CharacterRecognizer

def test_recognition():
    recognizer = CharacterRecognizer()

    with open('1.txt', 'r', encoding='utf-8') as f:
        text = f.read()

    result = recognizer.recognize(text)

    print("识别结果:")
    for char in result:
        print(f"- {char.name}: {char.aliases}")

if __name__ == "__main__":
    test_recognition()
```

## 📊 性能对比 (CPU vs GPU)

| 环境 | 优势 | 劣势 |
|------|------|------|
| **Docker + GPU** | 最高性能，环境隔离 | 需要网络拉取镜像 |
| **本地 Python + GPU** | 高性能，无网络依赖 | 环境配置复杂 |
| **本地 Python + CPU** | 无网络依赖，简单 | 性能较低但可用 |

## 🎯 推荐执行步骤

1. **立即测试**: 使用本地 Python 环境进行角色识别
2. **短期方案**: 配置国内镜像源尝试修复 Docker
3. **长期方案**: 考虑使用云服务商的容器服务

## 📝 预期测试结果分析

无论使用哪种环境，角色识别的差异通常来源于：

### 算法层面差异
- **模型版本**: 不同版本的 HanLP 模型可能产生不同结果
- **相似度阈值**: 设定的阈值影响角色聚类
- **文本预处理**: 不同的分词和清理策略

### 数据层面差异
- **训练数据**: 模型训练数据的差异
- **领域适配**: 通用模型 vs 特定领域模型
- **上下文理解**: 对特定语境的理解能力

### 配置层面差异
- **参数设置**: 最小角色出现次数、相似度阈值等
- **别名生成**: 不同的人名识别和别名提取策略
- **后处理**: 结果过滤和合并逻辑

通过对比不同环境的识别结果，可以更好地理解算法的鲁棒性和局限性。